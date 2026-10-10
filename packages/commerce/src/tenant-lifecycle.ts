import { dbTenants } from '@repo/db'
import { and, eq } from 'drizzle-orm'

import type { DbLike } from '@repo/db'

/**
 * Activacion de un tenant (T5, SDD Fase 3).
 *
 * Companion de `transitionSubscription`, con la misma forma y por la misma
 * razon: la funcion posee el `WHERE`, y quien la llama no puede omitir el filtro
 * porque no tiene como escribirlo.
 *
 * **Por que una funcion y no reusar `transitionSubscription`.** El diseno del
 * item 61 (§9) lo dice: si una transicion necesita otra forma, **se agrega otra
 * funcion**, no un flag. Un flag es exactamente el filtro volviendo a ser codigo
 * escrito a mano. Tres funciones hoja que dicen que hacen son mejores que una
 * que puede hacer todo, y la firma deja de ser el lugar donde hay que
 * adivinar si el `WHERE` incluye el status.
 *
 * **Por que el test es de UNA sola capa, a diferencia del de
 * `transitionSubscription`.** Este es el hallazgo de D5 y vale la pena tenerlo
 * presente:
 *
 * - `subscriptions` TIENE RLS. Con la mutacion del filtro, el test de una
 *   sola capa pasaba en verde: `withTenantContext(A)` mas la policy bloqueaban
 *   la escritura a la fila de B. La policy **enmascaraba** el defecto, y por
 *   eso hacen falta dos capas - una con rol sin BYPASSRLS que prueba el
 *   comportamiento real, y otra con owner que observa el `WHERE` porque no hay
 *   nada que lo tape.
 * - `tenants` NO tiene RLS: es tabla raiz, y el checklist de RLS del repo lo
 *   prohibe sin `tenantId` + policy. **No hay segunda capa que enmascare nada**,
 *   asi que un filtro mal escrito cambia la fila del otro tenant y el test lo
 *   ve en una sola pasada.
 *
 * O sea: **la ausencia de una capa de proteccion hace el test MAS simple, no mas
 * dificil.** El enmascaramiento venia de *haber* una capa, no de la falta de
 * ella.
 *
 * El riesgo es el reciproco y conviene dejarlo escrito: `tenants` sin RLS
 * significa que un `UPDATE` a esa tabla desde cualquier endpoint admin es
 * cross-tenant por definicion si no filtra. Esta funcion es la frontera.
 */

type TenantTx = DbLike

/**
 * Campos opcionales que la activacion escribe ademas del status.
 *
 * `updatedAt` es obligatorio porque toda escritura de `tenants` tiene que
 * actualizarlo; no hacerlo deja la fila con una fecha de modificacion que no
 * corresponde.
 */
export interface TenantActivationPatch {
  updatedAt: Date
}

/**
 * Resultado de la activacion.
 *
 * `reason` distingue el caso esperado -el tenant ya no estaba `pending`, que
 * incluye que no exista- de un fallo de infraestructura, que no se representa
 * aca: una excepcion de la base sube, no se degrada a `applied: false`.
 */
export type TenantActivationResult =
  | { applied: true; id: string }
  | { applied: false; reason: 'not_pending' | 'concurrent_update' }

/**
 * Activa un tenant: `pending` -> `active`.
 *
 * El `WHERE` es `tenantId AND status = 'pending'`. El status funciona como
 * condicion de concurrencia (item 70): si otra transicion movio la fila entre
 * la lectura y este `UPDATE`, el `WHERE` no matchea, `.returning()` viene vacio,
 * y se devuelve sin sobrescribir. Activar dos veces no es un error: la segunda
 * no hace nada.
 *
 * @param tenantId Tenant a activar. Va al `WHERE` si o si.
 */
export async function activateTenant(
  tx: TenantTx,
  tenantId: string,
  patch: TenantActivationPatch,
): Promise<TenantActivationResult> {
  // El `WHERE` se construye ACUI y no se expone. No hay forma de que el caller
  // lo escriba mal, y no hay forma de que se le pase sin el filtro.
  const written = await tx
    .update(dbTenants)
    .set({ status: 'active', ...patch })
    .where(and(eq(dbTenants.id, tenantId), eq(dbTenants.status, 'pending')))
    .returning({ id: dbTenants.id })

  if (written.length === 0) {
    // No se distingue "no existia" de "ya estaba active" sin una lectura extra.
    // No se hace: el caller sabe si viene de un alta recien creada, y la
    // lectura costaria una query para cerrar un caso que no cambia la
    // consecuencia (el tenant no quedo activo).
    return { applied: false, reason: 'not_pending' }
  }

  return { applied: true, id: written[0].id }
}
