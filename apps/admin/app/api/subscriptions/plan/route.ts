import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, dbSubscriptions, dbPlans, withTenantContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import {
  calculateProration,
  getPreapproval,
  toMpAmount,
  updatePreapproval,
} from '@repo/commerce'
import { createLogger } from '@/lib/logger'
import {
  getPlatformToken,
  notFoundError,
  requireTenantId,
  serverError,
  validationError,
} from '@/lib/subscriptions/handlers'

const logger = createLogger('admin-subscriptions-plan')

const bodySchema = z.object({
  planId: z.string().uuid('El planId debe ser un UUID valido'),
})

/**
 * Cambia el plan del tenant.
 *
 * Decisiones que parecen arbitrarias:
 *
 * - **El upgrade no se cobra en el momento.** Devolvemos 402 con el monto a
 *   cobrar y que la UI arme el checkout de MercadoPago (Approval/Preference).
 *   Meter un cobro tarjeta a tarjeta aca seria una operacion financiada que
 *   este endpoint no tiene permiso de hacer.
 * - **El prorrateo es informativo, no se persiste.** El saldo a favor de un
 *   downgrade se aplica en la facturacion siguiente, no como un saldo en la DB:
 *   no hay tabla de creditos y AGENTS.md prohibe inventar una en este PR.
 * - **`transactionAmount` va en centavos?** NO. La API de MP espera el monto en
 *   la unidad de la moneda; `priceUyu` viene de la DB en centavos (contrato
 *   interno nuestro) y hay que dividir por 100 antes de mandarlo.
 * - **El plan no se escribe en la DB.** Lo hace el webhook, como toda transicion
 *   de estado.
 */
export async function PUT(request: NextRequest) {
  try {
    const tenantId = await requireTenantId()
    if (tenantId instanceof NextResponse) return tenantId

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return validationError('Body JSON invalido', 'body')
    }

    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return validationError(
        first?.message ?? 'Datos invalidos',
        String(first?.path[0] ?? 'body'),
      )
    }
    const { planId } = parsed.data

    const token = getPlatformToken()
    if (!token) {
      return NextResponse.json(
        { error: 'MercadoPago no configurado' },
        { status: 500 },
      )
    }

    const data = await withTenantContext(tenantId, async (tx) => {
      const subRows = await tx
        .select({
          id: dbSubscriptions.id,
          status: dbSubscriptions.status,
          planId: dbSubscriptions.planId,
          currentPeriodEnd: dbSubscriptions.currentPeriodEnd,
          mpPreapprovalId: dbSubscriptions.mpPreapprovalId,
        })
        .from(dbSubscriptions)
        .where(eq(dbSubscriptions.tenantId, tenantId))
        .limit(1)

      if (subRows.length === 0) return null

      const planRows = await tx
        .select({
          id: dbPlans.id,
          slug: dbPlans.slug,
          displayName: dbPlans.displayName,
          priceUyu: dbPlans.priceUyu,
          isActive: dbPlans.isActive,
        })
        .from(dbPlans)
        .where(eq(dbPlans.id, planId))
        .limit(1)

      const currentPlanRows = await tx
        .select({
          id: dbPlans.id,
          slug: dbPlans.slug,
          displayName: dbPlans.displayName,
          priceUyu: dbPlans.priceUyu,
        })
        .from(dbPlans)
        .where(eq(dbPlans.id, subRows[0].planId))
        .limit(1)

      return {
        subscription: subRows[0],
        newPlan: planRows[0] ?? null,
        currentPlan: currentPlanRows[0] ?? null,
      }
    })

    if (!data) {
      return notFoundError('No hay suscripcion para este tenant')
    }

    if (!data.newPlan) {
      return notFoundError('El plan no existe', 'planId')
    }

    if (!data.newPlan.isActive) {
      return NextResponse.json(
        { error: 'El plan no esta disponible', field: 'planId' },
        { status: 409 },
      )
    }

    if (data.newPlan.id === data.subscription.planId) {
      return NextResponse.json(
        { error: 'Ya tenes ese plan', field: 'planId' },
        { status: 409 },
      )
    }

    // Solo `active` cambia de plan. Los demas estados tienen su propio flujo y
    // mezclarlos dejaria al tenant en un estado incoherente con MP.
    if (data.subscription.status !== 'active') {
      return NextResponse.json(
        {
          error: 'Solo una suscripcion activa puede cambiar de plan',
          field: 'status',
          status: data.subscription.status,
        },
        { status: 409 },
      )
    }

    if (!data.subscription.mpPreapprovalId) {
      return NextResponse.json(
        {
          error: 'La suscripcion no tiene preapproval en MercadoPago',
          field: 'preapproval',
        },
        { status: 409 },
      )
    }

    // Sin `currentPeriodEnd` no hay prorrateo posible. No es bloqueante: se
    // avisa con 0 dias y se cobra el precio completo en el proximo ciclo.
    const currentPeriodEnd = data.subscription.currentPeriodEnd

    let proration: ReturnType<typeof calculateProration> | null = null
    let prorationExpired = false

    if (currentPeriodEnd && data.currentPlan) {
      try {
        proration = calculateProration({
          currentPriceUyu: data.currentPlan.priceUyu,
          newPriceUyu: data.newPlan.priceUyu,
          currentPeriodEnd,
          now: new Date(),
        })
      } catch (err) {
        // El unico throw posible es el periodo vencido.
        if (err instanceof Error && err.message.includes('periodo ya vencio')) {
          prorationExpired = true
        } else {
          throw err
        }
      }
    }

    if (prorationExpired) {
      return NextResponse.json(
        {
          error:
            'El periodo ya vencio. No se puede calcular el prorrateo; espera al siguiente ciclo de facturacion.',
          field: 'currentPeriodEnd',
        },
        { status: 409 },
      )
    }

    // Upgrade: hay que cobrar la diferencia (importe negativo). No lo hacemos
    // aca: devolvemos el monto y que la UI arme el checkout.
    if (proration && proration.direction === 'upgrade') {
      const amountDueCents = Math.abs(proration.proratedAmountCents)

      return NextResponse.json(
        {
          error: 'El upgrade requiere un pago adicional',
          field: 'planId',
          code: 'upgrade_requires_payment',
          direction: proration.direction,
          daysRemaining: proration.daysRemaining,
          proratedAmountCents: amountDueCents,
          currency: 'UYU',
          newPlan: {
            id: data.newPlan.id,
            slug: data.newPlan.slug,
            displayName: data.newPlan.displayName,
            priceUyu: data.newPlan.priceUyu,
          },
        },
        { status: 402 },
      )
    }

    // Downgrade o mismo precio: se actualiza el monto del preapproval y el
    // webhook confirma.
    try {
      // Solo `transactionAmount`: `updatePreapproval` ya lo envuelve en
      // `auto_recurring.transaction_amount` por nosotros. Pasarlo aqui seria
      // duplicarlo y el wrapper no lo tipa.
      await updatePreapproval(
        data.subscription.mpPreapprovalId,
        {
          transactionAmount: toMpAmount(data.newPlan.priceUyu),
        },
        token,
      )
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const message = err instanceof Error ? err.message : String(err)

      if (name === 'MercadoPagoApiError' && !message.includes('timeout')) {
        logger.error({ err }, '[subscriptions/plan] MP rechazo el cambio')
        return NextResponse.json(
          { error: 'MercadoPago rechazo el cambio de plan', detail: message },
          { status: 502 },
        )
      }

      return NextResponse.json(
        { error: 'No se pudo comunicar con MercadoPago' },
        { status: 503 },
      )
    }

    // Verificacion post-escritura, misma razon que en `mutate.ts`: un 2xx de MP
    // no prueba que el monto haya quedado aplicado.
    let verifiedAmount: number | null = null
    try {
      const fresh = await getPreapproval(data.subscription.mpPreapprovalId, token)
      // `getPreapproval` devuelve `Record<string, unknown>`: MP puede no mandar
      // el campo, y no es un error.
      const rawAmount = fresh.transaction_amount
      verifiedAmount = typeof rawAmount === 'number' ? rawAmount : null
    } catch (err) {
      logger.warn({ err }, '[subscriptions/plan] no pude verificar el monto')
    }

    const expectedAmount = toMpAmount(data.newPlan.priceUyu)
    if (verifiedAmount !== null && verifiedAmount !== expectedAmount) {
      logger.error(
        { expectedAmount, verifiedAmount },
        '[subscriptions/plan] MP acepto el PUT pero el monto no cambio',
      )
      return NextResponse.json(
        {
          error:
            'MercadoPago acepto la operacion pero el monto no se actualizo',
          field: 'planId',
        },
        { status: 502 },
      )
    }

    return NextResponse.json(
      {
        message: 'Cambio de plan solicitado.',
        direction: proration?.direction ?? 'same',
        daysRemaining: proration?.daysRemaining ?? 0,
        // Positivo = credito a favor, aplicado en la proxima facturacion.
        creditCents: proration ? proration.proratedAmountCents : 0,
        newPlan: {
          id: data.newPlan.id,
          slug: data.newPlan.slug,
          displayName: data.newPlan.displayName,
          priceUyu: data.newPlan.priceUyu,
        },
      },
      { status: 202 },
    )
  } catch (err) {
    logger.error({ err }, '[subscriptions/plan] Error')
    return serverError('Error al cambiar de plan', err)
  }
}