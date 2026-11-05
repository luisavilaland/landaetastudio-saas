import {
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
 * Tenant sin fila en `subscriptions`.
 *
 * Verificado contra la base el 2026-11-05 (LEFT JOIN `tenants` vs
 * `subscriptions`, rol owner): 3 tenants, 1 sin fila (`test-1793899083356`,
 * artefacto de test). `tienda1` y `tienda2` estan `active/active`.
 *
 * Se resuelve como `readonly` y no como bloqueo total por dos motivos:
 * - `expired` y `abandoned` ya son `readonly` por decision de producto (item
 *   97): ver es menos malo que no ver. Un tenant sin fila de cobro esta mas
 *   cerca de "nunca pago" que de "la plataforma lo suspendio".
 * - Un 503 aca dejaria fuera del panel a un onboarding cuyo insert de
 *   suscripcion fallo, que es justo el momento en que el tenant necesita ver
 *   por que no puede operar.
 *
 * Lo que **no** se hace es inventar `canWrite: true`: `readonly` en el panel y
 * los endpoints de escritura (S4c) siguen siendo el gate real de escritura.
 */
const MISSING_SUBSCRIPTION: PanelAccessDecision = {
  access: 'readonly',
  tenantStatus: 'active',
  subscriptionStatus: 'unknown',
  reason: 'missing_subscription',
}

/**
 * Traduce las dos columnas del join a una decision de acceso.
 *
 * Ambos estados llegan como `string` porque `subscriptions.status` es una
 * columna `text` (schema.ts:101), no un enum de Postgres: el unico validador en
 * runtime es el `Object.hasOwn` de `deriveTenantPermissions`, que **lanza** con
 * un estado desconocido. El cast existe solo para llegar a ese guard; no relaja
 * nada, porque un valor invalido sigue explotando y el proxy lo convierte en
 * 503.
 */
export function decidePanelAccess(
  input: PanelAccessInput,
): PanelAccessDecision {
  const { tenantStatus, subscriptionStatus } = input

  if (!tenantStatus) return MISSING_TENANT

  if (!subscriptionStatus) {
    return { ...MISSING_SUBSCRIPTION, tenantStatus: tenantStatus as TenantStatus }
  }

  const permissions = deriveTenantPermissions(
    tenantStatus as TenantStatus,
    subscriptionStatus as SubscriptionStatus,
  )

  return {
    access: permissions.canAccessPanel,
    tenantStatus: tenantStatus as TenantStatus,
    subscriptionStatus: subscriptionStatus as SubscriptionStatus,
    reason: 'matrix',
  }
}
