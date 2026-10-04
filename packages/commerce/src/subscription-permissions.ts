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
 * `paused` es el unico estado que el transversal todavia NO lista (ver el TODO
 * en el test). Se agrega porque MP lo expone, la transicion funciona en ambas
 * direcciones (verificado 2026-10-03) y `cancel` es terminal: sin `paused` el
 * tenant no tendria ninguna forma de volver. La doc oficial de MP define
 * `paused` como "suscripcion con cobro temporalmente interrumpido".
 *
 * Nota: en `packages/db/src/schema.ts` la columna `subscriptions.status` es
 * `text`, no un enum de Postgres. Este tipo es el unico lugar donde se fija el
 * conjunto de valores validos, asi que hay que mantenerlo sincronizado con el
 * transversal si se agrega un estado.
 *
 * `paused` de MercadoPago NO es el mismo concepto que una hipotetica pausa por
 * impago: `past_due` cubre el impago (periodo de gracia de 7 dias, §3) y
 * `paused` cubre la suspension voluntaria del tenant.
 */
export type SubscriptionStatus =
  | 'pending_first_payment'
  | 'active'
  | 'past_due'
  | 'paused'
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
/** Pedir la cancelacion de la suscripcion. Es IRREVERSIBLE en MP. */
  canCancel: boolean
  /** Volver desde `cancelled` o `expired` a un estado activo. */
  canReactivate: boolean
  /**
   * Suspender el cobro de forma reversible (`authorized -> paused`).
   * Solo tiene sentido desde `active`.
   */
  canPause: boolean
  /** Reanudar una suscripcion pausada (`paused -> authorized`). */
  canResume: boolean
  /** La tienda publica sigue respondiendo. */
  canAccessStorefront: boolean
  /** Nivel de acceso al panel de administracion del tenant. */
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
 *   - pausar: solo `active`. Es la suspension voluntaria del tenant.
 *   - reanudar: solo `paused`.
 *
 * `paused` NO es una transcripcion del transversal (que lista 6 estados y no lo
 * incluye). Es una decision tomada el 2026-10-03 con evidencia:
 *   - `authorized -> paused` devuelve 200 y el GET posterior devuelve `paused`.
 *   - `paused -> authorized` devuelve 200 y el GET posterior devuelve `authorized`.
 *   - La doc oficial de MP confirma que `paused` detiene el cobro.
 * Se eligio `canAccessPanel: 'limited'` y no `'readonly'` porque el tenant
 * pausado tiene una accion util: `resume`. No se pierde acceso al panel ni al
 * storefront: lo que se suspende es el cobro.
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
      canPause: false,
      canResume: false,
    },
    active: {
      canAccessPanel: 'full',
      canAccessStorefront: true,
      canWrite: true,
      canChangePlan: true,
      canCancel: true,
      canReactivate: false,
      canPause: true,
      canResume: false,
    },
    past_due: {
      canAccessPanel: 'limited',
      canAccessStorefront: true,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: false,
      canPause: false,
      canResume: false,
    },
    paused: {
      canAccessPanel: 'limited',
      canAccessStorefront: true,
      canWrite: false,
      canChangePlan: false,
// `paused` es "suspender el cobro", no "bloquear acciones". La API expone
    // `canCancel: true` porque MercadoPago acepta `paused -> cancelled`
    // (verificado 2026-10-03) y obligar al tenant a "reanudar para cancelar"
    // seria burocracia sin beneficio. Decision de producto de Luis.
    canCancel: true,
    canReactivate: false,
    canPause: false,
    canResume: true,
    },
    cancelled: {
      canAccessPanel: 'readonly',
      canAccessStorefront: true,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: true,
      canPause: false,
      canResume: false,
    },
    expired: {
      canAccessPanel: 'none',
      canAccessStorefront: false,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: true,
      canPause: false,
      canResume: false,
    },
    abandoned: {
      canAccessPanel: 'none',
      canAccessStorefront: false,
      canWrite: false,
      canChangePlan: false,
      canCancel: false,
      canReactivate: false,
      canPause: false,
      canResume: false,
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