import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { requireTenantId, serverError } from '@/lib/subscriptions/handlers'
import { mutateSubscriptionStatus } from '@/lib/subscriptions/mutate'

const logger = createLogger('admin-subscriptions-cancel')

/**
 * Cancela la suscripcion del tenant.
 *
 * **IRREVERSIBLE.** MercadoPago responde 400 a cualquier intento de volver de
 * `cancelled` a `authorized` (verificado 2026-10-03). No hay reacion: un tenant
 * que cancela tiene que crear una suscripcion nueva.
 *
 * Desde `active` y desde `paused`. Decision de producto (Luis, 2026-10-04):
 * `paused` es "suspender el cobro", no "bloquear acciones"; MP acepta
 * `paused -> cancelled`, asi que obligar al tenant a reanudar para cancelar
 * seria burocracia sin beneficio. Coherente con `canCancel: true` en
 * `derivePermissions`.
 *
 * Cancelar desde `past_due` se rechaza: con la factura impaga, MP no procesa la
 * baja. El tenant tiene que resolver el impago primero.
 *
 * Devuelve **202, no 200**: la mutacion es asincrona. El estado local lo
 * escribe el webhook cuando MP confirma.
 */
export async function POST() {
  try {
    const tenantId = await requireTenantId()
    if (tenantId instanceof NextResponse) return tenantId

    return await mutateSubscriptionStatus({
      tenantId,
      target: 'cancelled',
      allowedFrom: ['active', 'paused'],
      conflictMessage:
        'Solo se puede cancelar una suscripcion activa o pausada. Resolvi primero el impago si corresponde.',
      conflictField: 'status',
      successBody: {
        message: 'Cancelacion solicitada. El acceso sigue hasta el fin del periodo pagado.',
      },
    })
  } catch (err) {
    logger.error({ err }, '[subscriptions/cancel] Error')
    return serverError('Error al cancelar la suscripcion', err)
  }
}