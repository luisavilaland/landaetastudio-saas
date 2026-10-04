import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, dbSubscriptions, dbPlans, withTenantContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { createPreapproval } from '@repo/commerce'
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
 * - **Doble click â†’ 409 con el `initPoint` existente**, no un 500. Volver a
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

    // Ya hay un preapproval sin pagar: devolver el mismo init_point en vez de
    // crear otro.
    if (subscription.subscription.mpPreapprovalId) {
      return NextResponse.json(
        {
          error: 'Ya existe una suscripcion pendiente de pago',
          field: 'preapproval',
          preapprovalId: subscription.subscription.mpPreapprovalId,
        },
        { status: 409 },
      )
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

    const adminBase = getAdminBaseUrl(request)

    const created = await createPreapproval(
      {
        reason: `Suscripcion ${subscription.plan.displayName}`,
        payerEmail: email ?? '',
        // El cruce con MP es por `external_reference` (ver design Â§6.5).
        externalReference: tenantId,
        backUrl: `${adminBase}/suscripcion`,
        // Sin notification_url: ver la nota del encabezado.
        autoRecurring: { frequency: 1, frequencyType: 'months' },
        // La API de MP espera el monto en la UNIDAD de la moneda, no en centavos.
// `priceUyu` viene de la DB en centavos (contrato interno nuestro), asi que
// hay que convertir: mandar 4900 en vez de 49 seria cobrar 100 veces mas.
        transactionAmount: subscription.plan.priceUyu / 100,
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

    // Segunda transaccion, deliberada: si esto falla, el preapproval ya existe
    // en MP y hay que reconciliarlo por logs.
    await withTenantContext(tenantId, (tx) =>
      tx
        .update(dbSubscriptions)
        .set({ mpPreapprovalId: preapprovalId, updatedAt: new Date() })
        .where(
          and(
            eq(dbSubscriptions.id, subscription.subscription.id),
            eq(dbSubscriptions.tenantId, tenantId),
          ),
        ),
    )

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