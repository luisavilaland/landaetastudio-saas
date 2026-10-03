import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { requireTenantId, serverError } from '@/lib/subscriptions/handlers'
import { mutateSubscriptionStatus } from '@/lib/subscriptions/mutate'

const logger = createLogger('admin-subscriptions-resume')

/**
 * Reanuda una suscripcion pausada: `paused -> authorized`.
 *
 * Es el unico camino de vuelta. Como `cancel` es terminal en MP (400 al volver
 * de `cancelled` a `authorized`), la pausa es la unica suspension reversible.
 *
 * Solo desde `paused`.
 *
 * NO reactiva desde `cancelled` ni `expired`: ese caso es un flujo distinto
 * (crear una suscripcion nueva) y mezclarlo aca daria un falso exito.
 */
export async function POST() {
  try {
    const tenantId = await requireTenantId()
    if (tenantId instanceof NextResponse) return tenantId

    return await mutateSubscriptionStatus({
      tenantId,
      target: 'authorized',
      allowedFrom: ['paused'],
      conflictMessage:
        'Solo se puede reanudar una suscripcion pausada.',
      conflictField: 'status',
      successBody: {
        message: 'Reanudacion solicitada. MercadoPago volvera a debitar.',
      },
    })
  } catch (err) {
    logger.error({ err }, '[subscriptions/resume] Error')
    return serverError('Error al reanudar la suscripcion', err)
  }
}