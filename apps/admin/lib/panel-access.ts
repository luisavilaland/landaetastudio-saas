import {
  ASSUMED_STATUS_WITHOUT_SUBSCRIPTION,
  deriveTenantPermissions,
  type PanelAccess,
  type SubscriptionStatus,
  type TenantStatus,
} from '@repo/commerce'

/**
 * Decision de acceso al panel, derivada de las dos columnas que la gobiernan.
 *
 * Este modulo es **puro** (sin DB, sin request, sin cookies) para que la
 * decision se pueda probar sin montar un proxy. El proxy de `apps/admin` es
 * solo el transporte: resolver el token, hacer la query y traducir la decision
 * a una respuesta HTTP.
 */

export type PanelAccessReason =
  | 'matrix'
  | 'missing_tenant'
  | 'missing_subscription'

export interface PanelAccessDecision {
  access: PanelAccess
  tenantStatus: TenantStatus | 'unknown'
  subscriptionStatus: SubscriptionStatus | 'unknown'
  reason: PanelAccessReason
}

export interface PanelAccessInput {
  tenantStatus: string | null | undefined
  subscriptionStatus: string | null | undefined
}

/**
 * Sin `tenants.status` no hay nada que derivar.
 *
 * El LEFT JOIN trae `tenants` como lado izquierdo, asi que una fila ausente no
 * significa "tenant sin suscripcion": significa que la query no encontro el
 * tenant (borrado, o RLS no lo expuso). Devolver permisos por defecto aca
 * abriria el panel de un tenant que no existe.
 */
const MISSING_TENANT: PanelAccessDecision = {
  access: 'none',
  tenantStatus: 'unknown',
  subscriptionStatus: 'unknown',
  reason: 'missing_tenant',
}

/**
 * Cuando el tenant **no tiene fila** en `subscriptions`, la matriz se evalua
 * igual con `ASSUMED_STATUS_WITHOUT_SUBSCRIPTION` (S4c, en `@repo/commerce`).
 *
 * La fila ausente **no puede saltear la matriz**: un tenant `suspended` sin
 * suscripcion tiene que seguir bloqueado, porque el eje del tenant es un bloqueo
 * de plataforma (`TENANT_STATUS_OVERRIDE`), no una deuda. Resolver ese caso como
 * `readonly` antes de mirar los overrides era un bypass: suspendias el tenant y
 * el panel seguia abierto porque ademas nunca habia pagado.
 *
 * Para un tenant `active` sin fila, el resultado sigue siendo `readonly` (ver sin
 * operar), que es lo que corresponde a un onboarding cuyo insert de suscripcion
 * fallo: es justo el momento en que necesita ver por que no puede operar. Un 503
 * aca lo dejaria afuera.
 *
 * Lo que **no** se hace es inventar `canWrite: true`: `readonly` en el panel y
 * los endpoints de escritura (S4c) siguen siendo el gate real de escritura.
 */

/**
 * Traduce las dos columnas del join a una decision de acceso.
 *
 * Ambos estados llegan como `string` porque `subscriptions.status` es una
 * columna `text` (schema.ts:101), no un enum de Postgres: el unico validador en
 * runtime es el `Object.hasOwn` de `deriveTenantPermissions`, que **lanza** con
 * un estado desconocido. El cast existe solo para llegar a ese guard; no relaja
 * nada, porque un valor invalido sigue explotando y el proxy lo convierte en
 * 503.
 *
 * La matriz se evalua **siempre**, con o sin fila de suscripcion. El `reason`
 * distingue el caso para logs y headers, pero no cambia el camino de decision.
 */
export function decidePanelAccess(
  input: PanelAccessInput,
): PanelAccessDecision {
  const { tenantStatus, subscriptionStatus } = input

  if (!tenantStatus) return MISSING_TENANT

  const permissions = deriveTenantPermissions(
    tenantStatus as TenantStatus,
    (subscriptionStatus ?? ASSUMED_STATUS_WITHOUT_SUBSCRIPTION) as SubscriptionStatus,
  )

  return {
    access: permissions.canAccessPanel,
    tenantStatus: tenantStatus as TenantStatus,
    subscriptionStatus: subscriptionStatus
      ? (subscriptionStatus as SubscriptionStatus)
      : 'unknown',
    reason: subscriptionStatus ? 'matrix' : 'missing_subscription',
  }
}
