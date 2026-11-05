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

| Tema                                                            | Decision                                                        | Motivo                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Alcance                                                         | Paginas **y** APIs                                              | El panel es donde el usuario ve lo que puede hacer; cubrir solo APIs deja la puerta abierta.                                  |
| Origen del tenant                                               | `getToken()` del JWT                                            | Es el mismo dato que usa `requireTenantId()`; no hay que duplicar la resolucion de sesion.                                    |
| Matriz                                                          | `deriveTenantPermissions`                                       | Una sola fuente. El proxy no reimplementa estados ni permisos.                                                                |
| `suspended`                                                     | Redirect a `/suspended` en paginas; **403 con `field`** en APIs | Un redirect le devuelve HTML al `fetch` del cliente, que lo lee como error de parseo, no como "sin acceso".                   |
| `expired` / `abandoned` / `cancelled` / `pending_first_payment` | Pasan en readonly                                               | Item 97: ver es menos malo que no ver. Escribir lo bloquea S4c.                                                               |
| Estado desconocido                                              | **503**                                                         | Distingue "no podes" de "no sabemos". `deriveTenantPermissions` ya lanza; el proxy lo traduce.                                |
| Sin fila de tenant                                              | **503** + Sentry                                                | El LEFT JOIN trae `tenants` a la izquierda: fila ausente es un tenant que la query no encontro, no un tenant sin suscripcion. |
| Sin fila de suscripcion                                         | Pasa en **readonly**                                            | Verificado en base: 1 tenant asi (artefacto de test). Un 503 dejaria afuera a un onboarding cuyo insert fallo.                |
| Webhooks de MercadoPago                                         | **Fuera** del matcher                                           | MP no manda cookie de sesion. Si pasara por el gate, el pago se cobraria y la orden no se confirmaria.                        |

### Matcher

Intercepta todo salvo: `_next/static`, `_next/image`, `favicon.ico`, assets de
imagen, `api/auth`, `api/health`, `api/webhooks`, `/login` y `/suspended` (estas
dos ultimas para que el redirect no rebote contra si mismo).

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

La query cuesta lo mismo que `SELECT 1`: **todo el costo son roundtrips**. En
Vercel, con la funcion en la region de Neon, el gate ronda 5-15 ms. El riesgo no
es la query: es sumarle 4 roundtrips a requests de pagina y prefetch que antes no
tocaban la base.

## Fuera de alcance

- Escritura (`canWrite`, `canPublish`): S4c.
- Cache de la decision: hoy cada request la recalcula. Cachear abriria una
  ventana en la que un tenant recien suspendido sigue entrando.
- Pagina de pago: `/suspended` explica el estado y pide contactar soporte; no
  ofrece un flujo de pago porque no existe uno en el admin.

## Verificacion

- `apps/admin/__tests__/proxy.test.ts`: 22 tests (redirect, 403 en API, 503 en
  estado desconocido y en fila ausente, headers de acceso, matcher, nombre de
  cookie).
- `apps/admin/lib/__tests__/panel-access.test.ts`: 14 tests de la matriz pura.
- LEFT JOIN en base real (rol owner): 3 tenants, `tienda1`/`tienda2` en
  `active/active`, 1 sin fila de suscripcion (`test-1793899083356`), 0
  `suspended`, 0 `cancelled`, 0 tenants con mas de una suscripcion.
