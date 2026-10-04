import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { requireTenantId, serverError } from '@/lib/subscriptions/handlers'
import { mutateSubscriptionStatus } from '@/lib/subscriptions/mutate'

const logger = createLogger('admin-subscriptions-pause')

/**
 * Pausa la suscripcion del tenant: MercadoPago **deja de debitar**.
 *
 * Segun la doc oficial, "Mercado Pago deje de debitar los pagos de ese cliente
 * hasta que decidas reactivarlo". El tenant conserva el acceso al storefront y
 * al panel: lo que se suspende es el cobro, no el servicio.
 * (https://www.mercadopago.com.ar/developers/es/docs/subscription-plans/manage-subscription-plan)
 *
 * Solo desde `active`. Reversible con `POST /resume`.
 */
export async function POST() {
  try {
    const tenantId = await requireTenantId()
    if (tenantId instanceof NextResponse) return tenantId

    return await mutateSubscriptionStatus({
      tenantId,
      target: 'paused',
      allowedFrom: ['active'],
      conflictMessage:
        'Solo se puede pausar una suscripcion activa.',
      conflictField: 'status',
      successBody: {
        message:
          'Pausa solicitada. MercadoPago dejara de debitar hasta que reanudes la suscripcion.',
      },
    })
  } catch (err) {
    logger.error({ err }, '[subscriptions/pause] Error')
    return serverError('Error al pausar la suscripcion', err)
  }
}