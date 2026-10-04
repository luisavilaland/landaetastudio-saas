import { NextResponse } from 'next/server'
import { db, dbSubscriptions, withTenantContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { getPreapproval, updatePreapproval } from '@repo/commerce'
import { createLogger } from '@/lib/logger'
import {
  getPlatformToken,
  mpError,
  notFoundError,
  serverError,
} from './handlers'

const logger = createLogger('admin-subscriptions-mutate')

export type MutationTarget = 'cancelled' | 'paused' | 'authorized'

export interface MutateParams {
  tenantId: string
  /** Estado que se le pide a MP. */
  target: MutationTarget
  /** Estados locales desde los que la operacion tiene sentido. */
  allowedFrom: readonly string[]
  /** 409 cuando el estado local no esta en `allowedFrom`. */
  conflictMessage: string
  /** Campo que se devuelve en el 409 para que la UI lo resalte. */
  conflictField: string
  /** Cuerpo del 202. */
  successBody: Record<string, unknown>
}

/**
 * Aplica una mutacion de estado en el preapproval de MP.
 *
 * **No escribe el estado local.** La transicion la hace el webhook: el tenant
 * deberia ver el estado nuevo cuando MP lo confirma, no cuando lo pedimos.
 * Escribirlo aca daria un estado optimista que podria no llegar nunca.
 *
 * **Verifica con GET despues del PUT.** Leccion del spike T0: un 2xx de MP no
 * prueba que la operacion se aplico. `PUT /preapproval/{id}` con
 * `notification_url` devuelve 200 y el campo ni siquiera aparece en la
 * respuesta. Por eso, despues del PUT se relee el preapproval y se compara el
 * estado: si no quedo como pedimos, es un 502 y no un falso 202.
 */
export async function mutateSubscriptionStatus(
  params: MutateParams,
): Promise<NextResponse> {
  const { tenantId, target, allowedFrom } = params

  const token = getPlatformToken()
  if (!token) {
    return NextResponse.json(
      { error: 'MercadoPago no configurado' },
      { status: 500 },
    )
  }

  const existing = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: dbSubscriptions.id,
        status: dbSubscriptions.status,
        mpPreapprovalId: dbSubscriptions.mpPreapprovalId,
      })
      .from(dbSubscriptions)
      .where(eq(dbSubscriptions.tenantId, tenantId))
      .limit(1)

    return rows[0] ?? null
  })

  if (!existing) {
    return notFoundError('No hay suscripcion para este tenant')
  }

  if (!existing.mpPreapprovalId) {
    return NextResponse.json(
      {
        error: 'La suscripcion no tiene preapproval en MercadoPago',
        field: 'preapproval',
      },
      { status: 409 },
    )
  }

  if (!allowedFrom.includes(existing.status)) {
    return NextResponse.json(
      {
        error: params.conflictMessage,
        field: params.conflictField,
        status: existing.status,
      },
      { status: 409 },
    )
  }

  try {
    await updatePreapproval(existing.mpPreapprovalId, { status: target }, token)
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    const message = err instanceof Error ? err.message : String(err)

    if (name === 'MercadoPagoApiError' && !message.includes('timeout')) {
      logger.error({ err, preapprovalId: existing.mpPreapprovalId }, `[subscriptions/${target}] MP rechazo`)
      return mpError('MercadoPago rechazo la operacion', message)
    }

    logger.error({ err }, `[subscriptions/${target}] Error de MP`)
    return NextResponse.json(
      { error: 'No se pudo comunicar con MercadoPago' },
      { status: 503 },
    )
  }

  // Verificacion post-escritura: el spike demostro que un 2xx no prueba nada.
  try {
    const fresh = await getPreapproval(existing.mpPreapprovalId, token)

    if (fresh.status !== target) {
      logger.error(
        { requested: target, actual: fresh.status },
        '[subscriptions/mutate] MP acepto el PUT pero el estado no cambio',
      )
      return mpError(
        'MercadoPago acepto la operacion pero el estado no se actualizo',
        { requested: target, actual: fresh.status },
      )
    }
  } catch (err) {
    // El PUT ya salio bien. Fallar aca seria tirar por la borda una operacion
    // valida que si se aplico.
    logger.warn(
      { err },
      '[subscriptions/mutate] no pude verificar el estado, confio en el PUT',
    )
  }

  return NextResponse.json({ ...params.successBody, status: target }, { status: 202 })
}