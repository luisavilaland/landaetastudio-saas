import { dbSubscriptions, withTenantContext } from '@repo/db'
import { and, eq } from 'drizzle-orm'

import type { SubscriptionStatus } from './subscription-permissions'
import type { DbLike } from '@repo/db'

/**
 * Transicion de estado de una suscripcion, con el aislamiento por tenant
 * garantizado por construccion.
 *
 * Item 61 (H-T6-1). Antes de esta funcion, el `UPDATE` vivia escrito a mano
 * dentro de `applyTransition` (`apps/admin/.../webhooks/mercadopago/subscriptions/route.ts`).
 * Quitarle el `eq(dbSubscriptions.tenantId, ...)` del `WHERE` dejaba **la suite
 * completa en verde**: con `withTenantContext` mockeado, ninguna asercion observa
 * el `WHERE`. Ese era el agujero, y no era un problema de tipos: era que el
 * unico lugar donde el filtro estaba escrito era un lugar que nadie verificaba.
 *
 * **Por que una funcion y no un tipo.** Un `TenantFilteredRow<T>` o un branded
 * `TenantId` habrian movido el filtro a donde el typecheck lo vigila, pero el
 * test seguiria sin poder observar la query: con mocks, ninguna asercion ve el
 * `WHERE`. Esta funcion ademas es **testeable contra Neon con dos tenants
 * reales**, y ahi el `WHERE` deja de ser invisible porque hay filas de verdad
 * que pueden o no aparecer. Diseno completo en
 * `vault/04_Fases/diseno-item-61-cross-tenant.md` (PR #233).
 *
 * **Por que `tenantId AND status` y no `id AND tenantId AND status`.**
 * `subscriptions_tenant_idx` es UNIQUE sobre `tenantId` (`schema.ts`), asi que hay
 * exactamente una suscripcion por tenant y el par `tenantId + status` ya alcanza
 * para identificar la fila. Dejar `id` en el `WHERE` agrega una segunda fuente de
 * verdad que puede estar equivocada sin que nadie lo note. Con el indice unico,
 * filtrar solo por tenant y status es **estrictamente mas seguro**: si el
 * `SELECT` devolviera la fila de otro tenant, el `WHERE` ya no la alcanza.
 *
 * **Por que recibe `tx`.** El `SELECT`, la verificacion de monto y el `UPDATE`
 * ocurren en una sola transaccion a proposito (ver el item 70: no hay locks de
 * fila en el proyecto). Esta funcion posee el `WHERE`, no la transaccion: quien
 * llama decide el ambito, y no puede omitir el filtro porque no tiene como
 * escribirlo.
 *
 * **Sin escape hatch.** No expone la query cruda ni acepta un `WHERE` del
 * caller. Si una transicion futura necesita otra forma, se agrega **otra
 * funcion**, no un flag ni un parametro opcional: un flag es exactamente como
 * el filtro vuelve a ser codigo escrito a mano.
 */

/**
 * El tipo de la transaccion que abre `withTenantContext`.
 *
 * Viene exportado de `@repo/db` en vez de derivarse con
 * `Parameters<Parameters<typeof withTenantContext>[1]>[0]`: esa derivacion
 * estaba duplicada en dos archivos y no la valida el compilador contra la forma
 * real del callback.
 */
type TenantTx = DbLike

/**
 * Campos opcionales que la transicion escribe ademas del status.
 *
 * `currentPeriodEnd` solo lo escribe la activacion desde un estado que lo habia
 * perdido; reanudar desde `paused` NO lo renueva porque el tenant nunca perdio
 * el periodo. `lastProcessedPaymentId` solo lo escriben los eventos de tipo
 * `payment`, y por eso es opcional.
 */
export interface SubscriptionTransitionPatch {
  currentPeriodEnd?: Date
  lastProcessedPaymentId?: string
  updatedAt: Date
}

/**
 * Resultado de la transicion.
 *
 * `reason` distingue el caso de concurrencia de los demas, que es lo que el
 * caller necesita para loguear de forma distinta: una transicion perdida es
 * esperable (MP reintenta y converge), una no-aplicada por `no_transition` no
 * lo es.
 */
export type SubscriptionTransitionResult =
  | { applied: true; id: string }
  | { applied: false; reason: 'concurrent_update' }

/**
 * Aplica una transicion de estado sobre la suscripcion del `tenantId` indicado.
 *
 * `from` es la **condicion de concurrencia**: el `UPDATE` solo escribe si el
 * status actual sigue siendo `from` (item 70). Si otra transicion movio la fila
 * entre el `SELECT` y este `UPDATE`, el `WHERE` no matchea, `.returning()` viene
 * vacio, y se devuelve `concurrent_update` en vez de sobrescribir.
 *
 * @param tenantId Tenant cuya suscripcion se transiciona. Va al `WHERE` si o si.
 * @param from Status que se espera encontrar. Es la condicion de concurrencia.
 * @param to Status a escribir.
 * @param patch Campos adicionales y `updatedAt`.
 */
export async function transitionSubscription(
  tx: TenantTx,
  tenantId: string,
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  patch: SubscriptionTransitionPatch,
): Promise<SubscriptionTransitionResult> {
  // El `WHERE` se construye ACUI y no se expone. No hay forma de que el caller
  // lo escriba mal, y no hay forma de que se le pase sin el filtro.
  const written = await tx
    .update(dbSubscriptions)
    .set({ status: to, ...patch })
    .where(
      and(
        eq(dbSubscriptions.tenantId, tenantId),
        eq(dbSubscriptions.status, from),
      ),
    )
    .returning({ id: dbSubscriptions.id })

  if (written.length === 0) {
    return { applied: false, reason: 'concurrent_update' }
  }

  return { applied: true, id: written[0].id }
}