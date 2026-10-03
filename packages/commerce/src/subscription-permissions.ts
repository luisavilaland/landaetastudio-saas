/**
 * Permisos por estado de suscripcion.
 *
 * Fuente de verdad: `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
 * seccion 2 ("Reglas de negocio por estado", tabla "Estado x Permisos").
 * Si cambia la politica, actualizar el spec y este archivo en el MISMO PR.
 *
 * Funcion pura: sin DB, sin red, sin reloj. El "quien" (el tenant) lo resuelve
 * el handler; aqui solo se responde "que puede hacer un tenant en este estado".
 */

/**
 * Estados del ciclo de vida. Transcripcion de la seccion 1 del transversal.
 *
 * Nota: en `packages/db/src/schema.ts` la columna `subscriptions.status` es
 * `text`, no un enum de Postgres. Este tipo es el unico lugar donde se fija el
 * conjunto de valores validos, asi que hay que mantenerlo sincronizado con el
 * transversal si se agrega un estado.
 *
 * `paused` de MercadoPago NO esta aca a proposito: el transversal lo declara
 * como no modelado (seccion 1, nota del 2026-10-01).
 */
export type SubscriptionStatus =
  | 'pending_first_payment'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'abandoned'

/** Nivel de acceso al panel de administracion del tenant. */
export type PanelAccess = 'full' | 'limited' | 'readonly' | 'none'

export interface SubscriptionPermissions {
  /** Crear o editar productos, categorias y configuracion. */
  canWrite: boolean
  /** Cambiar de plan (upgrade o downgrade). */
  canChangePlan: boolean
  /** Pedir la cancelacion de la suscripcion. */
  canCancel: boolean
  /** Volver desde `cancelled` o `expired` a un estado activo. */
  canReactivate: boolean
  /** La tienda publica sigue respondiendo. */
  canAccessStorefront: boolean
  /** Nivel de acceso al panel. */
  canAccessPanel: PanelAccess
}

/**
 * Matriz de permisos por estado.
 *
 * `canAccessPanel`, `canAccessStorefront`, `canWrite` y `canChangePlan` son
 * transcripcion directa de la tabla del transversal seccion 2.
 *
 * `canCancel` y `canReactivate` NO tienen fila propia en esa tabla (la tabla no
 * lista "cancelar" ni "reactivar"), asi que se derivan del detalle por estado
 * de la misma seccion:
 *   - cancelar: solo `active`. En `past_due` la seccion 2 dice "acciones de
 *     escritura bloqueadas" y cancelar es una transicion de estado, no lectura.
 *   - reactivar: `cancelled` (si se arrepiente antes de `current_period_end`) y
 *     `expired` (el panel muestra "Cuenta suspendida" + boton Reactivar).
 *     `abandoned` NO cuenta: su boton es "Completar pago", que es el flujo de
 *     alta (preapproval), no una reactivacion.
 */
const PERMISSIONS_BY_STATUS: Record<SubscriptionStatus, SubscriptionPermissions> =
  {
    pending_first_payment: {
      canAccessPanel: 'none',
      canAccessStorefront: false,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: false,
    },
    active: {
      canAccessPanel: 'full',
      canAccessStorefront: true,
      canWrite: true,
      canChangePlan: true,
      canCancel: true,
      canReactivate: false,
    },
    past_due: {
      canAccessPanel: 'limited',
      canAccessStorefront: true,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: false,
    },
    cancelled: {
      canAccessPanel: 'readonly',
      canAccessStorefront: true,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: true,
    },
    expired: {
      canAccessPanel: 'none',
      canAccessStorefront: false,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: true,
    },
    abandoned: {
      canAccessPanel: 'none',
      canAccessStorefront: false,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: false,
    },
  }

/**
 * Devuelve los permisos correspondientes a un estado de suscripcion.
 *
 * @throws si el estado no pertenece al ciclo de vida conocido. Un estado
 * desconocido debe fallar ruidosamente: devolver permisos por defecto abriria
 * el panel de un tenant en un estado que no entendemos.
 */
export function derivePermissions(
  status: SubscriptionStatus,
): SubscriptionPermissions {
  const permissions = PERMISSIONS_BY_STATUS[status]

  if (!permissions) {
    throw new Error(`derivePermissions: unknown subscription status "${status}"`)
  }

  return permissions
}