import { NextResponse } from 'next/server'
import { db, dbSubscriptions, dbPlans, withTenantContext } from '@repo/db'
import { eq } from 'drizzle-orm'
import { derivePermissions } from '@repo/commerce'
import { createLogger } from '@/lib/logger'
import {
  notFoundError,
  requireTenantId,
  serverError,
} from '@/lib/subscriptions/handlers'

const logger = createLogger('admin-subscriptions-get')

/**
 * Estado de la suscripcion del tenant + los permisos que tiene.
 *
 * La UI consume `permissions` para decidir que botones mostrar. Es la unica
 * fuente de verdad: la UI no debe reimplementar la matriz de estados.
 *
 * `paused` y `cancelled` requieren tratamiento especial en la UI:
 * - `paused`: se puede `resume`. El cobro esta detenido (doc de MP).
 * - `cancelled`: **irreversible**. MP responde 400 a cualquier intento de
 *   volver a `authorized`. La UI tiene que avisarlo antes de confirmar.
 */
export async function GET() {
  try {
    const tenantId = await requireTenantId()
    if (tenantId instanceof NextResponse) return tenantId

    const result = await withTenantContext(tenantId, async (tx) => {
      const subRows = await tx
        .select({
          id: dbSubscriptions.id,
          status: dbSubscriptions.status,
          planId: dbSubscriptions.planId,
          currentPeriodEnd: dbSubscriptions.currentPeriodEnd,
          mpPreapprovalId: dbSubscriptions.mpPreapprovalId,
          lastProcessedPaymentId: dbSubscriptions.lastProcessedPaymentId,
          createdAt: dbSubscriptions.createdAt,
          updatedAt: dbSubscriptions.updatedAt,
        })
        .from(dbSubscriptions)
        .where(eq(dbSubscriptions.tenantId, tenantId))
        .limit(1)

      if (subRows.length === 0) return null

      // `plans` es catalogo global (sin RLS). El nombre del plan va aca para
      // que la UI no tenga que hacer un segundo fetch.
      const planRows = await tx
        .select({
          id: dbPlans.id,
          slug: dbPlans.slug,
          displayName: dbPlans.displayName,
          priceUyu: dbPlans.priceUyu,
        })
        .from(dbPlans)
        .where(eq(dbPlans.id, subRows[0].planId))
        .limit(1)

      return { subscription: subRows[0], plan: planRows[0] ?? null }
    })

    if (!result) {
      return notFoundError('No hay suscripcion para este tenant')
    }

    const { subscription, plan } = result
    const status = subscription.status as Parameters<
      typeof derivePermissions
    >[0]

    // Una subscription con un estado que no conhecemos no debe devolver
    // permisos: se registra y se degrada a 'none'.
    let permissions
    try {
      permissions = derivePermissions(status)
    } catch (err) {
      logger.error(
        { err, status },
        '[subscriptions GET] estado desconocido, derivo a none',
      )
      return serverError('Estado de suscripcion no soportado', null)
    }

    return NextResponse.json({
      id: subscription.id,
      status,
      planId: subscription.planId,
      planName: plan?.displayName ?? null,
      planSlug: plan?.slug ?? null,
      priceUyu: plan?.priceUyu ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd,
      hasPreapproval: Boolean(subscription.mpPreapprovalId),
      permissions,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    })
  } catch (err) {
    logger.error({ err }, '[subscriptions GET] Error')
    return serverError('Error al obtener la suscripcion', err)
  }
}