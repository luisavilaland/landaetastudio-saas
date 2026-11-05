/**
 * Nombres de cookie de sesion, en un modulo **sin efectos secundarios**.
 *
 * Existe por una razon concreta: el proxy de `apps/admin` tiene que saber como
 * se llama la cookie **antes** de tener sesion, porque `getToken()` deriva la
 * clave del JWE con `salt === nombre de la cookie` (ver `@auth/core`
 * `lib/actions/session.js`, `lib/actions/callback/index.js`). Si el nombre esta
 * duplicado y un dia divergen, la decodificacion falla **en silencio**:
 * `getToken()` devuelve `null`, el proxy trata la request como anonima y el gate
 * deja pasar a todos. Un control que no verifica.
 *
 * No importa `next-auth` ni `@repo/db` a proposito: el proxy lo carga en el
 * camino caliente y no necesita arrastrar el runtime de Auth.js ni el cliente
 * de base de datos para leer dos strings.
 */

const isProduction = process.env.NODE_ENV === 'production'

export const ADMIN_SESSION_COOKIE_NAME = isProduction
  ? '__Secure-authjs.session-token-admin'
  : 'authjs.session-token-admin'

export const SUPERADMIN_SESSION_COOKIE_NAME = isProduction
  ? '__Secure-authjs.session-token-superadmin'
  : 'authjs.session-token-superadmin'
