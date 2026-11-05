# S4d — Gate de acceso al panel de admin

**Estado:** implementado (2026-11-05). **Issues:** #254. **Deuda:** item 101
(cerrado). **Depende de:** S4b (#251, matriz de permisos), S4c (guards de
escritura).

> Este spec se escribio **junto con** la implementacion, no antes. El item
> H-F3-3 registraba que S4c y S4d no existian en el plan ni en los specs; la
> fuente de requisitos hasta ahora era el issue #254 y la deuda. Documenta las
> decisiones tal como quedaron, con la evidencia que las sostiene.

## Problema

`deriveTenantPermissions` devuelve `canAccessPanel` desde S4b, y el unico lector
era `GET /api/subscriptions`: un dato en un JSON que el cliente puede ignorar.
Un tenant `suspended` recibia `canAccessPanel: 'none'` y entraba igual. Es el
item 61 aplicado a la autorizacion: un control que acompana y no verifica.

## Restriccion de plataforma

Next 16 renombro `middleware.ts` a `proxy.ts` y lo corre en **Node.js** por
defecto (la opcion `runtime` ya no existe). Eso es lo que hace viable el gate:
se puede abrir una transaccion con RLS dentro del proxy, sin resolver el tenant
antes de que exista la sesion.

## Decisiones

| Tema                                                            | Decision                                                           | Motivo                                                                                                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alcance                                                         | Paginas **y** APIs                                                 | El panel es donde el usuario ve lo que puede hacer; cubrir solo APIs deja la puerta abierta.                                                                |
| Origen del tenant                                               | `getToken()` del JWT                                               | Es el mismo dato que usa `requireTenantId()`; no hay que duplicar la resolucion de sesion.                                                                  |
| Matriz                                                          | `deriveTenantPermissions`                                          | Una sola fuente. El proxy no reimplementa estados ni permisos.                                                                                              |
| `suspended`                                                     | Redirect a `/suspended` en paginas; **403 con `field`** en APIs    | Un redirect le devuelve HTML al `fetch` del cliente, que lo lee como error de parseo, no como "sin acceso".                                                 |
| `expired` / `abandoned` / `cancelled` / `pending_first_payment` | Pasan en readonly                                                  | Item 97: ver es menos malo que no ver. Escribir lo bloquea S4c.                                                                                             |
| Estado desconocido                                              | **503**                                                            | Distingue "no podes" de "no sabemos". `deriveTenantPermissions` ya lanza; el proxy lo traduce.                                                              |
| Sin fila de tenant                                              | **503** + Sentry                                                   | El LEFT JOIN trae `tenants` a la izquierda: fila ausente es un tenant que la query no encontro, no un tenant sin suscripcion.                               |
| Sin fila de suscripcion                                         | Matriz con `pending_first_payment`; `reason: missing_subscription` | La fila ausente **no** corta la decision: un tenant `suspended` sin cobro tiene que seguir bloqueado. Verificado en base: 1 tenant asi (artefacto de test). |
| Webhooks de MercadoPago                                         | **Fuera** del matcher                                              | MP no manda cookie de sesion. Si pasara por el gate, el pago se cobraria y la orden no se confirmaria.                                                      |

### Matcher

Intercepta todo salvo: `_next/static`, `_next/image`, `favicon.ico`, `api/auth`,
`api/health`, `api/webhooks`, `/login` y `/suspended` (estas dos ultimas para que
el redirect no rebote contra si mismo).

Cada prefijo va anclado con `(?:/|$)`. Sin el anclaje, `/login` a secas dejaba
fuera del gate a `/login-historial`: la exclusion pasaba a ser del texto y no del
arbol de la ruta, y bastaba crear una pagina con ese prefijo para no ser
interceptada.

## Cookie de sesion

`getToken()` deriva la clave del JWE con `salt === nombre de la cookie`
(`@auth/core` `lib/actions/session.js`). El nombre se movio a
`packages/auth/src/session-cookie.ts` y tanto la config de NextAuth como el proxy
lo importan de ahi. Si los dos strings divergieran, `getToken()` devolveria
`null`, el proxy trataria la request como anonima y **el gate dejaria pasar a
todos en silencio**.

No se expone como subruta del paquete: el resolver de los workspaces no sigue el
mapa `exports` (`@repo/auth/session-cookie` no resuelve: el alias `@repo/*` lo
traduce a `packages/auth/session-cookie`, sin extension). Se importa por el mismo
alias que ya usa `@repo/commerce/*`.

## Costo medido

Transaccion del proxy = **4 roundtrips** (BEGIN, `set_tenant_id`, SELECT, COMMIT).

| Medicion (Neon, desde una maquina residencial) | Median |
| ---------------------------------------------- | ------ |
| Piso de red (`SELECT 1`)                       | 82 ms  |
| `BEGIN` + `COMMIT` vacio                       | 166 ms |
| `BEGIN` + `SET LOCAL` + `COMMIT`               | 250 ms |
| Transaccion completa del proxy                 | 332 ms |
| Solo el LEFT JOIN                              | 83 ms  |

La query cuesta lo mismo que `SELECT 1`: **todo el costo son roundtrips**.
Estimación, pendiente de medir en preview: en Vercel, con la funcion en la
region de Neon, el gate deberia rondar 5-15 ms. Los numeros de la tabla son de
una maquina residencial contra Neon, no de Vercel. El riesgo no es la query: es
sumarle 4 roundtrips a requests de pagina y prefetch que antes no tocaban la
base.

## Fuera de alcance

- Escritura (`canWrite`, `canPublish`): S4c.
- Cache de la decision: hoy cada request la recalcula. Cachear abriria una
  ventana en la que un tenant recien suspendido sigue entrando.
- Pagina de pago: `/suspended` explica el estado y pide contactar soporte; no
  ofrece un flujo de pago porque no existe uno en el admin.
- `/suspended` ofrece salida: boton de logout (sin el, el tenant bloqueado queda
  atrapado en una pagina sin acciones y su unica salida es borrar la cookie a
  mano) y, si `SUPPORT_EMAIL` esta configurada, un `mailto:`. Sin la variable la
  pagina cae a un texto sin enlace: no hay ningun canal de soporte definido en
  el repo y un `mailto:` inventado es peor que ninguno.

## Verificacion

- `apps/admin/__tests__/proxy.test.ts`: 34 tests (redirect, 403 en API, 503 en
  estado desconocido y en fila ausente, headers de acceso, matcher anclado con
  casi-coincidencias, limpieza de headers sin sesion, nombre de cookie).
- `apps/admin/__tests__/proxy-session.test.ts`: 2 tests con un JWE **real**
  firmado con `encode` de Auth.js y el mismo `salt` que el proxy. `getToken` no
  se mockea: si el `salt`, el `secret` o el `cookieName` divergen, el token no
  descifra, la request se trata como anonima y el test falla con un 200 donde
  espera el redirect. Verificado por mutacion: cambiando el `salt` a proposito
  fallan los dos.
- `apps/admin/lib/__tests__/panel-access.test.ts`: 16 tests de la matriz pura,
  incluido `suspended` + fila de suscripcion ausente.
- LEFT JOIN en base real (rol owner): 3 tenants, `tienda1`/`tienda2` en
  `active/active`, 1 sin fila de suscripcion (`test-1793899083356`), 0
  `suspended`, 0 `cancelled`, 0 tenants con mas de una suscripcion.
