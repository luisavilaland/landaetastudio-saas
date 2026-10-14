import { NextResponse } from 'next/server'
import { withTenantContext } from '@repo/db'
import { getPermissions } from '@repo/commerce'

/**
 * Guard de permisos del storefront (S4c, item 103).
 *
 * Gemelo de `apps/admin/lib/permission-guard.ts`, con el mismo criterio:
 * la resolucion de estado vive UNA vez en `getPermissions` y aca solo se
 * decide que responder cuando falta.
 *
 * **Por que vive aca y no en `@repo/commerce`.** La razon que devuelve el 403
 * es una `NextResponse`, y `NextResponse` es de la app. Lo que SI es de dominio
 * -resolver el estado y calcular los permisos- ya esta en commerce.
 *
 * **Por que NO va en el proxy.** El proxy de S1 filtra
 * `tenants.status = 'active'` para resolver el host, y eso esta bien. Pero un
 * tenant `past_due` tiene `tenants.status = 'active'` y
 * `subscriptions.status = 'past_due'`: el proxy lo deja pasar y el guard lo
 * autoriza. El proxy no ve la suscripcion, asi que no puede decidir por D17.
 */

type Permission = 'canWrite' | 'canSell'

const MESSAGES: Record<Permission, string> = {
  canWrite: 'La suscripción no permite publicar contenido',
  canSell: 'La tienda no está disponible',
}

export async function denyIfNoPermission(
  tenantId: string,
  permission: Permission,
): Promise<NextResponse | null> {
  const permissions = await withTenantContext(tenantId, (tx) =>
    getPermissions(tx, tenantId),
  )

  if (permissions[permission]) return null

  return NextResponse.json(
    { error: MESSAGES[permission], permission },
    { status: 403 },
  )
}