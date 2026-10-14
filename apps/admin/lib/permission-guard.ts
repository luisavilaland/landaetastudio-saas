import { NextResponse } from 'next/server'
import { withTenantContext } from '@repo/db'
import { getPermissions } from '@repo/commerce'

/**
 * Guard de permisos para endpoints de escritura (S4c, item 103).
 *
 * El item 103 dice: `deriveTenantPermissions` no lo leia nadie que pudiera
 * rechazar una request. Este archivo es el primer consumidor que puede.
 *
 * **Por que un wrapper y no el chequeo inline.** La resolucion de estado vive
 * en `getPermissions` (`@repo/commerce`), que es la unica que la implementa. Si
 * cada endpoint escribiera el `if` por su cuenta, seriam 13 lugares donde una
 * copia puede desviaerse del original - y el item 61 es exactamente eso: el
 * defecto no es el codigo original, es la copia que se desvia.
 *
 * **Por que se llama ANTES del trabajo y no adentro de `withTenantContext`.**
 * Tres motivos concretos, no_esteticos:
 *
 * 1. Cuatro handlers usan el callback para RETORNAR DATOS, no una
 *    `NextResponse`. No hay donde insertar un `return 403`.
 * 2. `products` POST sube la imagen a R2 **antes** de abrir la transaccion. Un
 *    guard adentro dejaria el objeto subido cuando el permiso falta.
 * 3. `products/import` lee categorias en un `withTenantContext` propio y
 *    despues escribe en otro.
 *
 * Un solo patron, aplicado antes de cualquier efecto secundario.
 */

type Permission = 'canWrite' | 'canSell'

const MESSAGES: Record<Permission, string> = {
  canWrite: 'La suscripción no permite publicar contenido',
  canSell: 'La tienda no está disponible',
}

/**
 * Devuelve una `NextResponse` 403 si el tenant no tiene el permiso, o `null`
 * si lo tiene.
 *
 * El `null` es lo ergonomicamente correcto: el caller no tiene que desarmar una
 * respuesta para seguir, y un `instanceof` con `NextResponse` se puede olvidar
 * de escribir.
 *
 * Un estado desconocido **no degrada**: `getPermissions` tira, y el `catch` del
 * handler lo convierte en 500. Un permiso por defecto abriria el panel de un
 * tenant en un estado que nadie sabe que existe.
 */
export async function denyIfNoPermission(
  tenantId: string,
  permission: Permission,
): Promise<NextResponse | null> {
  const permissions = await withTenantContext(tenantId, (tx) =>
    getPermissions(tx, tenantId),
  )

  if (permissions[permission]) return null

  return NextResponse.json(
    {
      error: MESSAGES[permission],
      permission,
    },
    { status: 403 },
  )
}