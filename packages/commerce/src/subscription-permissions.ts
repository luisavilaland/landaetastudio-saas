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

/**
 * Estados del tenant (D4, S1).
 *
 * Es un tipo local y no una reexportacion de `@repo/db`: `@repo/commerce` ya
 * depende de `@repo/db`, pero declarar aqui la lista de valores mantiene la
 * funcion pura -no importa el schema para calcular permisos- y hace que un
 * cambio en la DB tenga que reflejarse aca a proposito, no por accidente.
 */
export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled'

export interface SubscriptionPermissions {
  /** Crear o editar productos, categorias y configuracion. */
  canWrite: boolean
  /**
   * Vender: aceptar pedidos y procesar pagos.
   *
   * **Distinto de `canAccessStorefront` y de `canWrite`.** Los tres son ejes
   * separados y el diseno D17 depende de que no se confundan:
   *
   * - `past_due` tiene `canWrite: false` y `canSell: true`. El tenant no puede
   *   cambiar su catalogo pero su tienda sigue vendiendo durante la gracia: el
   *   comprador no fallo el pago, el tenant si, y cortarle la tienda castiga al
   *   que no corresponde.
   * - `cancelled` tiene `canAccessStorefront: true` (la tienda responde, en
   *   read-only, hasta fin de periodo) y `canSell: false`.
   *
   * Sin este permiso separado, "la tienda responde" y "la tienda vende" son la
   * misma respuesta, y `past_due` pierde su asimetria.
   */
  canSell: boolean
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
const PERMISSIONS_BY_STATUS: Record<
  SubscriptionStatus,
  SubscriptionPermissions
> = {
  pending_first_payment: {
    // Item 96 (decidido en S3, 2026-10-10): el onboarding exige configurar
    // subdominio, branding y MP **antes** de pagar (spec Fase 3 seccion 1, paso
    // 2). Con `'none'` ese paso es inejecutable y el item era papel mojado.
    //
    // `'readonly'` y no `'limited'`: lo unico que el tenant puede hacer antes
    // de pagar es dejar cosas listas. No cambia plan ni pausa.
    //
    // `canAccessStorefront` sigue en `false`: D2, el subdominio no resuelve
    // hasta que el pago activa el tenant. El comprador no entra; el owner si
    // a su panel.
    canAccessPanel: 'readonly',
    canAccessStorefront: false,
    canSell: false,
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
    canSell: true,
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
    // D17: la asimetria deliberada. Vende durante la gracia, no publica.
    canSell: true,
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
    canSell: true,
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
    // La tienda sigue respondiendo en read-only hasta fin de periodo, pero no
    // acepta pedidos: por eso `canAccessStorefront: true` y `canSell: false`.
    // `canAccessStorefront` responde "responde", `canSell` responde "vende".
    canAccessStorefront: true,
    canSell: false,
    canWrite: false,
    canChangePlan: false,
    canCancel: false,
    canReactivate: true,
    canPause: false,
    canResume: false,
  },
  expired: {
    // Item 97 (decidido 2026-10-10): read-only en vez de 'none'.
    //
    // Bloquear el acceso deja al tenant sin poder ver que perdio, y `expired`
    // es un tenant que tuvo tienda. Ver es siempre menos malo que no ver.
    // Escribir, no: por eso `readonly` y no `limited`.
    canAccessPanel: 'readonly',
    canAccessStorefront: false,
    canSell: false,
    canWrite: false,
    canChangePlan: false,
    canCancel: false,
    // Puede volver desde `expired`: el panel ofrece "Reactivar".
    canReactivate: true,
    canPause: false,
    canResume: false,
  },
  abandoned: {
    // Item 97 (decidido 2026-10-10): read-only, por el mismo motivo que
    // `expired`. `abandoned` es "se dio de alta y no pago" (7 dias desde el
    // registro) - cortarle el acceso no agrega nada: la deuda es deMP, no
    // del tenant.
    canAccessPanel: 'readonly',
    canAccessStorefront: false,
    canSell: false,
    canWrite: false,
    canChangePlan: false,
    canCancel: false,
    // NO cuenta como reactivacion: su boton es "Completar pago", que es el
    // flujo de alta (preapproval), no volver de un estado terminal.
    canReactivate: false,
    canPause: false,
    canResume: false,
  },
}

/**
 * Ajuste por `tenants.status` (S4b, T10).
 *
 * La matriz de arriba responde "que puede hacer un tenant **con esta
 * suscripcion**". Esta responde "y si ademas el tenant esta suspendido o
 * cancelado".
 *
 * Son ejes ortogonales y **el tenant manda**: un tenant `suspended` por la
 * plataforma no vende ni aunque su suscripcion diga `active`. Por eso el
 * ajuste se aplica encima y no al lado.
 *
 * `pending` y `active` no cambian nada: la suscripcion ya describe al tenant.
 */
const TENANT_STATUS_OVERRIDE: Record<
  TenantStatus,
  Partial<SubscriptionPermissions> | null
> = {
  pending: null,
  active: null,
  // Bloqueo de plataforma, no deudor: no entra al panel ni publica ni vende.
  suspended: {
    canAccessPanel: 'none',
    canAccessStorefront: false,
    canSell: false,
    canWrite: false,
    canChangePlan: false,
    canCancel: false,
    canReactivate: false,
    canPause: false,
    canResume: false,
  },
  // El tenant dio de baja su tienda: mismo corte que `suspended`, pero deja la
  // reactivacion, que es la unica accion util que queda.
  //
  // `canReactivate: false` es explicito, no heredado. Omitirlo en un
  // `Partial<...>` lo dejaria venir de la suscripcion, y un tenant `cancelled`
  // con suscripcion `expired` heredaria `canReactivate: true` - un tenant que
  // dio de baja su tienda podria "reactivarse". Fallar cerrado es lo unico
  // defendible mientras ese flujo no exista.
  cancelled: {
    canAccessPanel: 'readonly',
    canAccessStorefront: false,
    canSell: false,
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
    throw new Error(
      `derivePermissions: unknown subscription status "${status}"`,
    )
  }

  return permissions
}

/**
 * Permisos efectivos de un tenant, combinando `tenants.status` con
 * `subscriptions.status`.
 *
 * El ajuste por tenant se aplica **encima** del de suscripcion. La
 * suscripcion describe el estado del cobro; el tenant describe si existe un
 * negocio al que ese cobro pertenece.
 *
 * @throws si alguno de los dos estados no es conocido. Igual que la version de
 * una dimension: un estado desconocido no puede devolver permisos por defecto.
 */
export function deriveTenantPermissions(
  tenantStatus: TenantStatus,
  subscriptionStatus: SubscriptionStatus,
): SubscriptionPermissions {
  const bySubscription = derivePermissions(subscriptionStatus)
  const override = TENANT_STATUS_OVERRIDE[tenantStatus]

  if (override === undefined) {
    throw new Error(
      `deriveTenantPermissions: unknown tenant status "${tenantStatus}"`,
    )
  }

  if (override === null) return bySubscription

  return { ...bySubscription, ...override }
}
