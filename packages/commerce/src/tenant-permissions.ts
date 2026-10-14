import { dbSubscriptions, dbTenants } from '@repo/db'
import type { DbLike } from '@repo/db'
import { eq } from 'drizzle-orm'

import {
  deriveTenantPermissions,
  type SubscriptionPermissions,
  type SubscriptionStatus,
  type TenantStatus,
} from './subscription-permissions'

type TenantTx = DbLike

/**
 * Resolucion de permisos efectivos del tenant (S4c, T10).
 *
 * Companion de `tenant-lifecycle` y `subscription-transition`, por la misma
 * razon: **la funcion posee la resolucion** y el caller no puede omitirla ni
 * equivocarse. Aplicar el guard a 13 endpoints sin esto seria la misma
 * resolucion escrita 13 veces, y 13 copias divergen (item 61: el defecto no es
 * el original, es la copia que se desvía).
 *
 * `deriveTenantPermissions` es pura y ya existe desde S4b. Lo que faltaba era
 * el paso de "estado guardado" a "permisos": este archivo.
 */

/**
 * Permisos de un tenant que no existe, o de un estado que no entendemos.
 *
 * **Fallar cerrado.** Es el unico default de este repo: un permiso por defecto
 * abriria el panel de un tenant en un estado que no existe.
 *
 * `canAccessPanel` es `PanelAccess`, no booleano: el equivalente de "no" es
 * `'none'`.
 */
const NO_ACCESS: SubscriptionPermissions = {
  canWrite: false,
  canSell: false,
  canChangePlan: false,
  canCancel: false,
  canReactivate: false,
  canPause: false,
  canResume: false,
  canAccessStorefront: false,
  canAccessPanel: 'none',
}

/**
 * Estado asumido cuando el tenant no tiene suscripcion.
 *
 * `pending_first_payment` es el estado real de toda susc recien creada
 * (`schema.ts:101`), asi que un tenant sin fila esta en el mismo lugar que uno
 * que todavia no pago: puede dejar cosas listas pero no publicar ni vender.
 *
 * Se elige ese estado y no `NO_ACCESS` a proposito: un tenant en onboarding sin
 * suscripcion **puede** entrar a su panel en read-only (item 96) y configurar su
 * branding. Devolverle `NO_ACCESS` le romperia el alta.
 */
const ASSUMED_STATUS_WITHOUT_SUBSCRIPTION: SubscriptionStatus =
  'pending_first_payment'

/**
 * Permisos efectivos de un tenant.
 *
 * Resuelve `tenants.status` y `subscriptions.status` y delega en
 * `deriveTenantPermissions`, que es pura. Esta funcion solo junta el estado.
 *
 * @param tx.Tx de `withTenantContext`. **Requerido**: la lectura de
 * `subscriptions` tiene RLS y sin el contexto veria cero filas.
 * @param tenantId Tenant a resolver.
 *
 * @throws si alguno de los dos estados no es conocido. No degrada: un estado
 * que no entendemos tiene que ser ruidoso, porque devolver permisos por defecto
 * abriria el panel de un tenant en un estado que nadie sabe que existe.
 */
export async function getPermissions(
  tx: TenantTx,
  tenantId: string,
): Promise<SubscriptionPermissions> {
  const [tenantRows, subscriptionRows] = await Promise.all([
    tx
      .select({ status: dbTenants.status })
      .from(dbTenants)
      .where(eq(dbTenants.id, tenantId))
      .limit(1),
    tx
      .select({ status: dbSubscriptions.status })
      .from(dbSubscriptions)
      .where(eq(dbSubscriptions.tenantId, tenantId))
      .limit(1),
  ])

  const tenant = tenantRows[0]
  if (!tenant) return NO_ACCESS

  const subscriptionStatus = (subscriptionRows[0]?.status ??
    ASSUMED_STATUS_WITHOUT_SUBSCRIPTION) as SubscriptionStatus
  const tenantStatus = tenant.status as TenantStatus

  return deriveTenantPermissions(tenantStatus, subscriptionStatus)
}

export { NO_ACCESS, ASSUMED_STATUS_WITHOUT_SUBSCRIPTION }