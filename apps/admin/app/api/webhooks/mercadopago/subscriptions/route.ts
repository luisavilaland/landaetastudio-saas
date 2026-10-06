import { NextRequest, NextResponse } from 'next/server'
import { db, dbSubscriptions, withTenantContext } from '@repo/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  classifyMpEvent,
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
  verifyMercadoPagoSignature,
  type MpTopic,
  type SubscriptionStatus,
} from '@repo/commerce'
import { createLogger } from '@repo/logger'

/**
 * Webhook de suscripciones de MercadoPago (Flujo A — cuenta de plataforma).
 *
 * Decisiones que parecen arbitrarias y no lo son:
 *
 * - **Event order B (Luis, 2026-10-03):** el alta se activa desde
 *   `subscription_preapproval`, NO desde `subscription_authorized_payment`. Es
 *   el tercer evento del flujo y llega ~2.5 s despues, a cambio de que la fuente
 *   de verdad sea el estado del preapproval y no el del cobro.
 * - **`data.id` significa tres cosas distintas segun el topic** (verificado en
 *   el spike #188): en `payment` es un id de pago, en
 *   `subscription_authorized_payment` es un id de **invoice**, y en
 *   `subscription_preapproval` es el id del preapproval. No hay un unico
 *   `dataId` que sirva para los tres.
 * - **`live_mode` solo viene en el topic `payment`.** Los topics de suscripcion
 *   no lo incluyen, asi que "ausente" se trata como no-live. Un guard
 *   `live_mode === false` Strict NO pondria ningun topic de suscripcion en el
 *   camino de "produccion", que es donde hay que escribir.
 * - **UNKNOWN responde 200, no 5xx.** MercadoPago reintenta los 5xx. Un evento
 *   que no entendemos no se arregla reintentando: se loguea y se acepta.
 * - **Ningun endpoint escribe el estado local de las mutaciones.** Aqui es al
 *   reves: este handler ES la fuente de verdad. Los endpoints de T4 devuelven
 *   202 y esperan que este webhook confirme.
 */
const logger = createLogger('admin-subscriptions-webhook')

const MAX_BODY_BYTES = 100 * 1024

export const dynamic = 'force-dynamic'

/**
 * Acciones del topic payment que implican cobro fallido (§6.3).
 *
 * NO verificadas contra un payload real: el spike solo observo
 * payment.created. Por eso el handler NO decide solo por la action, sino
 * exigiendo que el status del pago tampoco diga approved.
 */
const FAILURE_ACTIONS = /^payment\.(rejected|cancelled|refunded|charged_back)$/

/** Estados desde los que un cobro aprobado (o un preapproval autorizado) revive. */
const REVIVABLE = ['pending_first_payment', 'past_due', 'expired'] as const

/** Estados desde los que se puede producir una cancelacion. */
const CANCELLABLE = ['active', 'past_due', 'paused'] as const

/**
 * Estados desde los que MP puede reportar `paused`.
 *
 * No incluye `expired` ni `abandoned`: una suscripcion vencida no se pausa, se
 * cancela o expira. Coincide con el diseno §6.3.
 */
const PAUSABLE = ['active', 'past_due'] as const

/**
 * Shape minimo del payload, validado con Zod.
 *
 * El stub del spike lo parseaba a mano a proposito ("el payload crudo es lo que
 * hay que descubrir"). Ese argumento servia para una sonda de un dia; este es
 * el handler de produccion, asi que la entrada externa se valida.
 *
 * `.passthrough()` porque MP manda campos que no nos interesan y pueden sumar
 * sin romper el handler.
 */
const eventSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    live_mode: z.unknown().optional(),
    data: z
      .object({
        id: z.string().min(1).optional(),
        status: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

type EventBody = z.infer<typeof eventSchema>

interface Resolved {
  tenantId: string
  preapprovalId: string
}


export async function POST(request: NextRequest) {
  try {
    // 1. Secret. Los webhooks de suscripciones los firma la cuenta de
    //    PLATAFORMA, no la del tenant (Flujo B). Validar contra el equivocado
    //    produce 401 sobre un webhook que si llego.
    //
    //    Acceso directo a process.env (no via packages/validation):
    //    validateEnv() corre en el layout.tsx de la app y ya valida que
    //    estas variables esten presentes y no vacias al arrancar. El fallback
    //    ?? al secret del tenant no se puede expresar en el schema, que exige
    //    min(1).
    const webhookSecret =
      process.env.MP_PLATFORM_WEBHOOK_SECRET ??
      process.env.MERCADOPAGO_WEBHOOK_SECRET

    if (!webhookSecret) {
      logger.error(
        'No webhook secret configured (MP_PLATFORM_WEBHOOK_SECRET or MERCADOPAGO_WEBHOOK_SECRET)',
      )
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 },
      )
    }

    const rawBody = await request.text()

    if (rawBody.length > MAX_BODY_BYTES) {
      logger.warn(
        { bytes: rawBody.length, limit: MAX_BODY_BYTES },
        'Body too large - rejected',
      )
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const signature = request.headers.get('x-signature')

    if (!signature) {
      logger.warn('Missing x-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // La firma se calcula sobre `data.id`, asi que hay que parsear antes de
    // verificar. El parseo NO se rechaza: un body invalido devuelve 200 mas
    // abajo, pero la firma se valida igual para no aceptar cuerpos arbitrarios.
    const parsed = safeParse(rawBody)
    const verification = verifyMercadoPagoSignature({
      signatureHeader: signature,
      xRequestId: request.headers.get('x-request-id') ?? '',
      dataId: parsed?.data?.id ?? '',
      secret: webhookSecret,
    })

    if (!verification.valid) {
      logger.warn({ reason: verification.reason }, 'Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (!parsed) {
      logger.warn('Body is not valid JSON')
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    const topic = classifyMpEvent(parsed.type, parsed.action)
    const dataId = parsed.data?.id

    if (topic === 'UNKNOWN' || !dataId) {
      logger.warn(
        { topic, type: parsed.type, action: parsed.action },
        'Unknown topic or missing data.id - accepted without writing',
      )
      return NextResponse.json({ ignored: true, topic }, { status: 200 })
    }

    // `live_mode` ausente en topics de suscripcion -> no-live.
    const liveMode = topic === 'payment' ? parsed.live_mode === true : false
    const token = process.env.MP_PLATFORM_ACCESS_TOKEN ?? null

    if (!token) {
      logger.error('MP_PLATFORM_ACCESS_TOKEN not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const outcome = await handleEvent({ topic, dataId, action: parsed.action ?? '', liveMode, token })

    logger.info({ topic, dataId, liveMode, ...outcome }, 'Subscription webhook handled')

    return NextResponse.json(outcome, { status: 200 })
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'Failed to process webhook',
    )
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Despacho por topic
// ---------------------------------------------------------------------------

interface HandleInput {
  topic: MpTopic
  dataId: string
  /** action del payload. El topic payment lo necesita para detectar fallos. */
  action: string
  liveMode: boolean
  token: string
}

async function handleEvent(input: HandleInput): Promise<Record<string, unknown>> {
  const { topic, dataId, action, token } = input

  if (topic === 'payment') {
    return handlePayment(dataId, action, input.liveMode, token)
  }

  if (topic === 'subscription_authorized_payment') {
    return handleAuthorizedPayment(dataId, token)
  }

  if (topic === 'subscription_preapproval') {
    return handlePreapproval(dataId, token)
  }

  // `subscription_preapproval_plan` no cambia el estado de la suscripcion: es un
  // aviso de que el PLAN cambio, no la suscripcion. Se acepta sin escribir.
  logger.warn({ topic }, 'Topic not applicable to subscription state')
  return { ignored: true, topic }
}

/**
 * Topic `payment`: `data.id` es un id de PAGO.
 *
 * El `action` del spike llega como `payment.created`, que no distingue aprobado
 * de rechazado. Por eso se lee el estado real con `GET /v1/payments/{id}` en vez
 * de confiar en el `action`: es la misma disciplina que aplica a los endpoints de
 * T4, donde un 2xx de MP no prueba que la operacion se aplico.
 */
async function handlePayment(
  paymentId: string,
  action: string,
  liveMode: boolean,
  token: string,
): Promise<Record<string, unknown>> {
  const payment = await safeGet(() => getPayment(paymentId, token))
  if (!payment) {
    logger.warn({ paymentId }, 'Could not read payment from MP')
    return { ignored: true, reason: 'mp_unavailable' }
  }

  const preapprovalId = str(payment.preapproval_id)
  if (!preapprovalId) {
    logger.warn({ paymentId }, 'Payment has no preapproval_id')
    return { ignored: true, reason: 'no_preapproval' }
  }

  const resolved = await resolveTenant(preapprovalId, token)
  if (!resolved) return { ignored: true, reason: 'tenant_unresolved' }

  const status = str(payment.status)
  const actionSaysFailed = FAILURE_ACTIONS.test(action)
  // Se consulta por AMBAS señales y se exige que ninguna diga "fallo".
  //
  // El spike solo observo `payment.created` en el topic `payment`: los literales
  // `payment.rejected` / `payment.cancelled` / `payment.refunded` de §6.3 NO
  // estan verificados. Mirar solo el `action` dejaria los fallos realessin
  // detectar; mirar solo el `status` dejaria pasar un `action` explicito de
  // fallo. Con las dos, cada señal cubre el punto ciego de la otra.
  const approved = !actionSaysFailed && status === 'approved'

  return applyTransition({
    resolved,
    eventKind: 'payment',
    paymentId,
    approved,
    liveMode,
  })
}

/**
 * Topic `subscription_authorized_payment`: `data.id` es un id de INVOICE.
 *
 * Este evento no produce ninguna de las 8 transiciones por si solo. Se registra
 * porque cruza la invoice con su preapproval, que es lo que permite saber que
 * un cobro ocurrio. Con event order B el alta la dispara `subscription_preapproval`.
 */
async function handleAuthorizedPayment(
  invoiceId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const invoice = await safeGet(() => getAuthorizedPayment(invoiceId, token))
  if (!invoice) {
    logger.warn({ invoiceId }, 'Could not read authorized payment from MP')
    return { ignored: true, reason: 'mp_unavailable' }
  }

  const preapprovalId = str(invoice.preapproval_id)
  if (!preapprovalId) {
    logger.warn({ invoiceId }, 'Invoice has no preapproval_id')
    return { ignored: true, reason: 'no_preapproval' }
  }

  const resolved = await resolveTenant(preapprovalId, token)
  if (!resolved) return { ignored: true, reason: 'tenant_unresolved' }

  logger.info(
    { invoiceId, preapprovalId, tenantId: resolved.tenantId },
    'Authorized payment observed (no state change under event order B)',
  )

  return { ignored: true, reason: 'no_transition_for_this_topic', invoiceId }
}

/**
 * Topic `subscription_preapproval`: `data.id` es el PREAPPROVAL.
 *
 * Es el que activa el alta (event order B). Para decidir entre `authorized` y
 * `cancelled` hay que conocer el estado real del preapproval: el `action` del
 * spike llega como `updated` en ambos casos, asi que no sirve.
 */
async function handlePreapproval(
  preapprovalId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const resolved = await resolveTenant(preapprovalId, token)
  if (!resolved) return { ignored: true, reason: 'tenant_unresolved' }

  const preapproval = await safeGet(() => getPreapproval(preapprovalId, token))
  if (!preapproval) {
    logger.warn({ preapprovalId }, 'Could not read preapproval from MP')
    return { ignored: true, reason: 'mp_unavailable' }
  }

  const mpStatus = str(preapproval.status)

  if (mpStatus === 'cancelled') {
    return applyTransition({
      resolved,
      eventKind: 'preapproval_cancelled',
      approved: false,
    })
  }

  // `authorized` es el unico estado que ACTIVA el alta. `paused` no activa, pero
  // tampoco es "nada": es un estado destino que hay que reflejar (H2). Antes
  // se colapsaba a `approved: false` y se perdia, con lo que `decideTarget` no
  // podia distinguirlo de cualquier otro estado no autorizante.
  const activating = mpStatus === 'authorized'

  return applyTransition({
    resolved,
    eventKind: 'preapproval',
    paymentId: null,
    approved: activating,
    mpStatus,
  })
}

// ---------------------------------------------------------------------------
// Resolucion de tenant: estrategia L (local) con fallback R (remota)
// ---------------------------------------------------------------------------

/**
 * Estrategia L (principal): indice unico parcial sobre `mpPreapprovalId`.
 *
 * Resuelve el tenant sin llamar a MP. Es la estrategia del design y la que
 * funciona en el camino caliente.
 *
 * Fallback R: si el preapproval no esta en la DB (p.ej. el alta todavia no se
 * habia guardado, o el indice se armo despues del alta), se lee el
 * `external_reference` del preapproval, que es el cruce que MP garantiza.
 */
async function resolveTenant(
  preapprovalId: string,
  token: string,
): Promise<Resolved | null> {
  const fromLocal = await withTenantContextByPreapproval(preapprovalId)
  if (fromLocal) return fromLocal

  logger.info(
    { preapprovalId },
    'Strategy L found nothing - falling back to external_reference (R)',
  )

  const remote = await safeGet(() => getPreapproval(preapprovalId, token))
  const externalReference = remote ? str(remote.external_reference) : null

  if (!externalReference) {
    logger.warn(
      { preapprovalId },
      'Could not resolve tenant by either strategy',
    )
    return null
  }

  return { tenantId: externalReference, preapprovalId }
}

/**
 * Busca la suscripcion por `mpPreapprovalId`.
 *
 * `withTenantContext` exige un tenantId, y aqui todavia no lo tenemos: es
 * justamente lo que estamos resolviendo. Por eso se consulta con la conexion
 * directa. Es seguro: solo se LEE y el filtro es el indice unico parcial, que
 * es por definicion de un solo tenant. La escritura posterior si va siempre
 * dentro de `withTenantContext`.
 */
async function withTenantContextByPreapproval(
  preapprovalId: string,
): Promise<Resolved | null> {
  const rows = await db
    .select({ tenantId: dbSubscriptions.tenantId })
    .from(dbSubscriptions)
    .where(eq(dbSubscriptions.mpPreapprovalId, preapprovalId))
    .limit(1)

  const row = rows[0]
  return row ? { tenantId: row.tenantId, preapprovalId } : null
}

// ---------------------------------------------------------------------------
// Transiciones
// ---------------------------------------------------------------------------

interface TransitionInput {
  resolved: Resolved
  eventKind: 'preapproval' | 'preapproval_cancelled' | 'payment'
  paymentId?: string | null
  approved: boolean
  /**
   * Estado crudo que reporta MP en el preapproval.
   *
   * Antes solo pasaba `approved`, que aplasta a un binario y vuelve
   * indistinguible `paused` de cualquier otro estado no autorizante. Esa
   * perdida de informacion es la causa de H2.
   */
  mpStatus?: string | null
  liveMode?: boolean
}

/**
 * Aplica la transicion de la matriz §6.3.
 *
 * Idempotencia por CONVERGENCIA, no por estado de evento: si el estado local ya
 * es el objetivo, no se escribe. Un replay del mismo webhook es un no-op, y
 * eso importa porque MP reintenta.
 */
/**
 * Campos que el handler escribe sobre `subscriptions`.
 *
 * Se declara en vez de `Record<string, unknown>` porque asi el compilador
 * avisa si un dia se agrega un campo a la transicion y se olvida de tiparlo.
 * `lastProcessedPaymentId` es opcional a proposito: solo lo escriben los
 * eventos de tipo `payment`.
 */
interface SubscriptionPatch {
  status: SubscriptionStatus
  currentPeriodEnd?: Date
  lastProcessedPaymentId?: string
  updatedAt: Date
}
async function applyTransition(
  input: TransitionInput,
): Promise<Record<string, unknown>> {
  const { resolved, eventKind } = input

  return await withTenantContext(resolved.tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: dbSubscriptions.id,
        tenantId: dbSubscriptions.tenantId,
        status: dbSubscriptions.status,
        currentPeriodEnd: dbSubscriptions.currentPeriodEnd,
        mpPreapprovalId: dbSubscriptions.mpPreapprovalId,
        lastProcessedPaymentId: dbSubscriptions.lastProcessedPaymentId,
      })
      .from(dbSubscriptions)
      // `subscriptions_tenant_idx` es UNIQUE sobre tenantId: hay exactamente una
      // suscripcion por tenant, asi que filtrar por tenant alcanza. No hace
      // falta el id.
      .where(eq(dbSubscriptions.tenantId, resolved.tenantId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      logger.warn(
        { tenantId: resolved.tenantId },
        'No subscription row for resolved tenant',
      )
      return { ignored: true, reason: 'no_subscription' }
    }

    const current = row.status as SubscriptionStatus
    const target = decideTarget(eventKind, input.approved, current, input.mpStatus)

    if (!target) {
      // Transiciones 2, 3, 5 y 7: sin cambio. No se escribe.
      logger.info(
        { tenantId: resolved.tenantId, current, eventKind },
        'No transition applies (already converged or not applicable)',
      )
      return { applied: false, from: current, reason: 'no_transition' }
    }

    if (target === current) {
      logger.info(
        { tenantId: resolved.tenantId, current },
        'Status already at target - idempotent no-op',
      )
      return { applied: false, from: current, to: target, reason: 'converged' }
    }

    // Guarda de pago ya procesado. `lastProcessedPaymentId` solo lo escriben los
    // eventos de tipo `payment`: para el resto, la idempotencia la da la
    // convergencia de estado.
    const paymentId = eventKind === 'payment' ? (input.paymentId ?? null) : null
    if (
      paymentId &&
      row.lastProcessedPaymentId === paymentId
    ) {
      logger.info(
        { tenantId: resolved.tenantId, paymentId },
        'Payment already processed - skipping',
      )
      return { applied: false, reason: 'duplicate_payment' }
    }

    const patch: SubscriptionPatch = {
      status: target,
      updatedAt: new Date(),
    }

    // El periodo se renueva SOLO al activar desde un estado que lo habia
    // perdido. Reanudar desde `paused` NO lo renueva: el tenant nunca perdio el
    // periodo, solo dejo de facturarse. Sin este guard, `POST /resume` regalaba
    // un mes gratis cada vez que se pausaba y reanudaba.
    const resuming = current === 'paused' && target === 'active'
    if (target === 'active' && !resuming) {
      patch.currentPeriodEnd = oneMonthFromNow()
    }

    if (paymentId) {
      patch.lastProcessedPaymentId = paymentId
    }

    await tx
      .update(dbSubscriptions)
      .set(patch)
      .where(
        and(
          eq(dbSubscriptions.id, row.id),
          eq(dbSubscriptions.tenantId, resolved.tenantId),
        ),
      )

    logger.info(
      { tenantId: resolved.tenantId, from: current, to: target, eventKind },
      'Subscription status transitioned',
    )

    return { applied: true, from: current, to: target }
  })
}

/**
 * Matriz de transiciones §6.3. Devuelve el estado objetivo o `null` si no
 * aplica ninguna transicion (y entonces no se escribe nada).
 */
function decideTarget(
  eventKind: TransitionInput['eventKind'],
  approved: boolean,
  current: string,
  mpStatus?: string | null,
): SubscriptionStatus | null {
  if (eventKind === 'preapproval_cancelled') {
    // Transicion 4 y 5.
    if ((CANCELLABLE as readonly string[]).includes(current)) return 'cancelled'
    return null
  }

  if (eventKind === 'preapproval') {
    // Decision item 38 superseded. Ver spike T0 (H1 confirmada, `paused`
    // reversible) y el PR que cierra H2.
    //
    // El item 38 decia "el webhook registra warn y no transiciona" porque se
    // tomo antes del spike, con informacion incompleta. El spike probo que
    // `paused` es reversible en ambas direcciones y que detiene el cobro.

    // Transicion 6: MP reporta `paused`. Es destino valido desde `active` y
    // desde `past_due` (diseno §6.3). No se toca `currentPeriodEnd`: pausar
    // suspende el cobro, no cancela el periodo.
    if (mpStatus === 'paused') {
      if ((PAUSABLE as readonly string[]).includes(current)) return 'paused'
      return null
    }

    // Transicion 7: `paused` -> `active`. El reanudar NO renueva el periodo:
    // el tenant nunca lo perdio, solo dejo de facturarse. Por eso se resuelve
    // aqui y no por `REVIVABLE`, que ademas no incluye `paused`.
    if (current === 'paused') {
      return approved ? 'active' : null
    }

    // Transiciones 1, 2 y 3. `approved === false` con un status que no es
    // `paused` significa que MP no esta en `authorized` y no hay transicion.
    if (!approved) return null
    if ((REVIVABLE as readonly string[]).includes(current)) return 'active'
    return null
  }

  // eventKind === 'payment'
  if (approved) {
    // Transiciones 6 y 7.
    if ((REVIVABLE as readonly string[]).includes(current)) return 'active'
    return null
  }

  // Transicion 8: fallo de cobro, solo desde `active`.
  if (current === 'active') return 'past_due'
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function oneMonthFromNow(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d
}

/**
 * Parseo tolerante: devuelve `null` si el body no es JSON valido o no cumple el
 * schema. `null` NO es un error fatal — se responde 200 sin escribir, porque
 * MercadoPago reintenta los 5xx y un payload que no entendemos no se arregla
 * reintentando.
 */
function safeParse(rawBody: string): EventBody | null {
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return null
  }
  const result = eventSchema.safeParse(json)
  return result.success ? result.data : null
}

/** Lee un string de un payload de MP sin asumir que existe. */
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * GET a MercadoPago que degrada a `null` en vez de tirar.
 *
 * Un 5xx de MP no debe convertirse en un 5xx nuestro: MP reintentaria nuestro
 * webhook y no cambiaria nada. Se acepta el evento sin escribir y se loguea.
 */
async function safeGet(
  fn: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown> | null> {
  try {
    return await fn()
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'MercadoPago read failed - degrading to no-write',
    )
    return null
  }
}