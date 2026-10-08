import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, dbSubscriptions, dbPlans, withTenantContext } from '@repo/db'
import { eq, and, isNull, like, lt, or } from 'drizzle-orm'
import { createPreapproval, toMpAmount } from '@repo/commerce'
import { getAdminBaseUrl } from '@/lib/get-admin-base-url'
import { createLogger } from '@/lib/logger'
import {
  checkRateLimit,
  clientIp,
  getPlatformToken,
  notFoundError,
  requireAuthContext,
  serverError,
  validationError,
} from '@/lib/subscriptions/handlers'

const logger = createLogger('admin-subscriptions-preapproval')

// El body va vacio: el plan que se quiere contratar se deduce de la
// suscripcion del tenant. Un body con `planId` permitiria contratar un plan
// distinto al que la suscripcion dice.
const bodySchema = z.object({})

const RATE_LIMIT = 10

/**
 * Prefijo del valor centinela que ocupa el slot mientras se crea el preapproval.
 *
 * Item 69 (H-F2-7): `mpPreapprovalId` guarda un valor que NO es un id de MP
 * durante la ventana entre "decido crear" y "MP me devolvio el id". No puede
 * ser un id real (no existe todavia) ni NULL (no ocuparia el slot).
 */
const RESERVATION_PREFIX = 'pending:'

/**
 * Quanto vive una reserva antes de poder tomarse de nuevo.
 *
 * Es la ventana en la que un proceso puede estar entre la reserva y el cierre.
 * Pasada, se asume que el proceso murio a mitad de camino y otro puede tomar el
 * lugar — el tenant no queda bloqueado por un crash.
 *
 * El costo asumido: si MP rechaza la creacion, la reserva sigue viva hasta que
 * vence el TTL y el tenant recibe un 409 con "reintenta en unos minutos" en vez
 * de poder reintentar al instante. Es fail-closed con una ventana de espera, y
 * se prefiere a crear un preapproval huerfano que hay que cancelar a mano.
 */
const PENDING_RESERVATION_TTL_MS = 5 * 60_000

function reservationFor(subscriptionId: string): string {
  return `${RESERVATION_PREFIX}${subscriptionId}`
}

function isReservation(value: string): boolean {
  return value.startsWith(RESERVATION_PREFIX)
}

/** Respuesta 409 para una reserva viva. El `retryInSeconds` es actionable. */
function reservationInFlight(retryInSeconds: number) {
  return NextResponse.json(
    {
      error: 'La creacion del preapproval esta en curso. Reintenta en unos minutos.',
      field: 'preapproval',
      retryInSeconds,
    },
    { status: 409 },
  )
}

/**
 * Crea el preapproval de MercadoPago para el tenant y devuelve el
 * `init_point` para que el tenant complete el pago.
 *
 * Decisiones que parecen arbitrarias y no lo son:
 *
 * - **NO se manda `notification_url`.** Verificado el 2026-10-03 que MP lo
 *   acepta y lo descarta en silencio: el campo ni siquiera aparece en la
 *   respuesta del PUT. La URL del webhook se registra en el panel de MP.
 * - **El `UPDATE` de `mpPreapprovalId` es una segunda transaccion.** Si
 *   fallara, MP ya tiene el preapproval creado y la DB no lo sabria; dos
 *   transacciones lo hacen explicito y se puede reconciliar por logs.
 * - **Doble click → 409 con el `initPoint` existente**, no un 500. Volver a
 *   crear un preapproval cada vez que el usuario toca el boton genera
 *   suscripciones huerfanas en MP que hay que cancelar a mano.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext()
    if (ctx instanceof NextResponse) return ctx
    const { tenantId, email } = ctx

    const parsed = bodySchema.safeParse(
      (await request.json().catch(() => ({}))) ?? {},
    )
    if (!parsed.success) {
      return validationError('Body invalido', 'body')
    }

    const allowed = await checkRateLimit(
      `subscription_preapproval:${clientIp(request)}`,
      RATE_LIMIT,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera un minuto.' },
        { status: 429 },
      )
    }

    const token = getPlatformToken()
    if (!token) {
      return NextResponse.json(
        { error: 'MercadoPago no configurado' },
        { status: 500 },
      )
    }

    // Toda lectura de negocio dentro del contexto de tenant.
    const subscription = await withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: dbSubscriptions.id,
          status: dbSubscriptions.status,
          mpPreapprovalId: dbSubscriptions.mpPreapprovalId,
          planId: dbSubscriptions.planId,
          // Item 69: la edad de la reserva se decide con `updatedAt`, porque no
          // hay columna de reserva y no se quiere una migracion por esto.
          updatedAt: dbSubscriptions.updatedAt,
        })
        .from(dbSubscriptions)
        .where(eq(dbSubscriptions.tenantId, tenantId))
        .limit(1)

      if (rows.length === 0) return null

      // `plans` es catalogo global: no tiene RLS y no necesita tenantId.
      const planRows = await tx
        .select({
          id: dbPlans.id,
          displayName: dbPlans.displayName,
          priceUyu: dbPlans.priceUyu,
          isActive: dbPlans.isActive,
        })
        .from(dbPlans)
        .where(eq(dbPlans.id, rows[0].planId))
        .limit(1)

      return { subscription: rows[0], plan: planRows[0] ?? null }
    })

    if (!subscription) {
      return notFoundError('No hay suscripcion para este tenant')
    }

    if (!subscription.plan) {
      return notFoundError('El plan de la suscripcion no existe', 'planId')
    }

    if (!subscription.plan.isActive) {
      return NextResponse.json(
        { error: 'El plan no esta disponible', field: 'planId' },
        { status: 409 },
      )
    }

    // Item 69: tres casos distintos y la confusion entre ellos es el bug.
    const currentPreapprovalId = subscription.subscription.mpPreapprovalId

    if (currentPreapprovalId && !isReservation(currentPreapprovalId)) {
      // Preapproval real pendiente de pago: devolver el mismo, no crear otro.
      // Que sea viejo no lo cambia — un id de MP no es una reserva.
      return NextResponse.json(
        {
          error: 'Ya existe una suscripcion pendiente de pago',
          field: 'preapproval',
          preapprovalId: currentPreapprovalId,
        },
        { status: 409 },
      )
    }

    if (currentPreapprovalId && isReservation(currentPreapprovalId)) {
      const ageMs =
        Date.now() - new Date(subscription.subscription.updatedAt).getTime()

      if (ageMs < PENDING_RESERVATION_TTL_MS) {
        // Otra peticion esta creando el preapproval ahora mismo. Todavia no
        // existe un id de MP, asi que decir "ya tenes un preapproval" seria
        // mandar al tenant a uno que no existe.
        return reservationInFlight(
          Math.ceil((PENDING_RESERVATION_TTL_MS - ageMs) / 1000),
        )
      }
      // Reserva vencida: se sigue y la nueva la reemplaza. Es el camino de
      // recuperacion cuando el proceso anterior murio con la reserva viva.
    }

    // `pending_first_payment` es el unico estado desde el que se puede iniciar
    // un alta. Cualquier otro (incluido `paused`) tiene su propio flujo.
    if (subscription.subscription.status !== 'pending_first_payment') {
      return NextResponse.json(
        {
          error: 'La suscripcion no esta en un estado que permita iniciar el alta',
          field: 'status',
          status: subscription.subscription.status,
        },
        { status: 409 },
      )
    }

    // --- Item 69: RESERVA. Ocupa el slot de forma condicional, ANTES de llamar
    // a MP. Dos POST concurrentes: uno gana la reserva, el otro recibe 0 filas
    // y devuelve 409 sin haber creado nada en MP.
    //
    // Es un compare-and-set, no un lock: la condicion va en el WHERE de la
    // escritura. No se usa `FOR UPDATE` ni advisory lock porque la llamada a MP
    // ocurre FUERA de esta transaccion — un lock de fila seria inútil para
    // protegerla y solo agrega contención.
    //
    // INVARIANTE: el centinela solo existe mientras el status es
    // `pending_first_payment` (el check de arriba lo garantiza antes de llegar
    // acá). De eso depende que sea seguro: `mutate.ts` (cancel/pause/resume) y
    // `plan/route.ts` leen `mpPreapprovalId` y lo mandan a MP, y solo lo hacen
    // con status `active` o `paused`. Si alguien agrega `pending_first_payment`
    // a un `allowedFrom`, el centinela llegaría a MP como si fuera un preapproval
    // y el síntoma sería un 502 de MP, no algo evidente.
    // Cubierto por el test de invariante en `subscriptions/__tests__/mutations.test.ts`.
    const reservation = reservationFor(subscription.subscription.id)
    const staleBefore = new Date(Date.now() - PENDING_RESERVATION_TTL_MS)

    const reserved = await withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .update(dbSubscriptions)
        .set({ mpPreapprovalId: reservation, updatedAt: new Date() })
        .where(
          and(
            eq(dbSubscriptions.id, subscription.subscription.id),
            eq(dbSubscriptions.tenantId, tenantId),
            or(
              isNull(dbSubscriptions.mpPreapprovalId),
              and(
                like(dbSubscriptions.mpPreapprovalId, `${RESERVATION_PREFIX}%`),
                lt(dbSubscriptions.updatedAt, staleBefore),
              ),
            ),
          ),
        )
        .returning({ id: dbSubscriptions.id })
      return rows.length
    })

    if (reserved === 0) {
      // Perdimos la carrera contra otra peticion que reservo entre nuestra
      // lectura y nuestra escritura. No se llamo a MP: no hay huerfano.
      return reservationInFlight(
        Math.ceil(PENDING_RESERVATION_TTL_MS / 1000),
      )
    }

    const adminBase = getAdminBaseUrl(request)

    const created = await createPreapproval(
      {
        reason: `Suscripcion ${subscription.plan.displayName}`,
        payerEmail: email ?? '',
        // El cruce con MP es por `external_reference` (ver design §6.5).
        externalReference: tenantId,
        backUrl: `${adminBase}/suscripcion`,
        // Sin notification_url: ver la nota del encabezado.
        autoRecurring: { frequency: 1, frequencyType: 'months' },
// La API de MP espera el monto en la UNIDAD de la moneda, no en
        // centavos. `toMpAmount` centraliza la conversion (item 48): antes era
        // un `/100` a mano y produjo un cobro 100x mayor.
        transactionAmount: toMpAmount(subscription.plan.priceUyu),
        currencyId: 'UYU',
      },
      token,
    )

    const preapprovalId = typeof created.id === 'string' ? created.id : null
    const initPoint = typeof created.init_point === 'string' ? created.init_point : null

    if (!preapprovalId || !initPoint) {
      logger.error(
        { created },
        'MP respondio sin id o sin init_point',
      )
      return serverError('Respuesta inesperada de MercadoPago', null)
    }

    // Cierre de la reserva: se reemplaza el centinela por el id real de MP. Tambien
    // condicional — si la reserva dejo de ser nuestra, otro proceso la tomó y el
    // preapproval que acabamos de crear queda huerfano en MP.
    const finalized = await withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .update(dbSubscriptions)
        .set({ mpPreapprovalId: preapprovalId, updatedAt: new Date() })
        .where(
          and(
            eq(dbSubscriptions.id, subscription.subscription.id),
            eq(dbSubscriptions.tenantId, tenantId),
            eq(dbSubscriptions.mpPreapprovalId, reservation),
          ),
        )
        .returning({ id: dbSubscriptions.id })
      return rows.length
    })

    if (finalized === 0) {
      // El preapproval existe en MP pero la DB no lo apunta: hay que
      // reconciliarlo a mano. El log lo deja explicito en vez de devolver 201 y
      // hacer creer que quedo bien.
      logger.error(
        { preapprovalId, tenantId },
        'Orphaned preapproval: the reservation was taken over while MP was called',
      )
      return NextResponse.json(
        {
          error:
            'La creacion del preapproval se completo en MercadoPago pero no pudo confirmarse. Contacta a soporte.',
          field: 'preapproval',
          preapprovalId,
        },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { preapprovalId, initPoint },
      { status: 201 },
    )
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'MercadoPagoApiError'
        ? `MercadoPago: ${err.message}`
        : 'Error al crear la suscripcion'

    if (err instanceof Error && err.name === 'MercadoPagoApiError') {
      // 5xx de MP -> 502. Error de red/timeout -> 503 (mas honesto que 502:
      // no hubo respuesta, no una respuesta mala).
      const status = err.message.includes('timeout') ? 503 : 502
      logger.error({ err }, '[subscriptions/preapproval] Error de MP')
      return NextResponse.json({ error: message }, { status })
    }

    logger.error({ err }, '[subscriptions/preapproval] Error')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
