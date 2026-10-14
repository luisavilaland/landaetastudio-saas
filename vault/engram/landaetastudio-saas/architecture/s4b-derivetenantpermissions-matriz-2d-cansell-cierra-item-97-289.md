---
id: 289
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-14 14:17:50"
updated_at: "2026-10-14 14:17:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "S4b deriveTenantPermissions: matriz 2D, canSell, cierra item 97"
---

# S4b deriveTenantPermissions: matriz 2D, canSell, cierra item 97

**What**: `deriveTenantPermissions(tenantStatus, subscriptionStatus)` en `packages/commerce/src/subscription-permissions.ts`. Combina `tenants.status` con `subscriptions.status` via un override que se aplica ENCIMA. `canSell` nuevo, separado de `canAccessStorefront`. Tres filas de la matriz cambiaron: `pending_first_payment`, `expired` y `abandoned` pasaron de `canAccessPanel: 'none'` a `'readonly'`. `GET /api/subscriptions` ahora lee tambien `tenants.status`.

**Why**: `derivePermissions` ya existia con 8 permisos pero era de UNA dimension. Un tenant `suspended` con suscripcion `active` era indistinguible de uno sano: podia vender y publicar con el negocio bloqueado por la plataforma. El item 97 existia porque la tabla de D17 no tenia fila para `abandoned`.

**Where**: `packages/commerce/src/subscription-permissions.ts`, `packages/commerce/src/index.ts`, `apps/admin/app/api/subscriptions/route.ts` + test, `packages/commerce/src/__tests__/tenant-permissions.test.ts` (nuevo, 34 tests), los 2 specs.

**Learned**:
(1) **NO se creo `permissions.ts`.** El existente era mas rico (8 permisos, `PanelAccess` de 4 niveles), ya exportado y consumido por 2 callers. Crear un segundo `derivePermissions` daba colision de export y dos tablas contradiciendose en 3 de 7 estados.
(2) **El item 96 estaba cerrado en papel desde S3 y contradicho en el codigo.** Decia que el owner de un tenant pending entra al panel; el codigo devolvia `'none'`. No se detecto porque el snapshot de la matriz consagrava el valor viejo y el test pasaba en verde. Un item cerrado es una decision; que el codigo la contradiga es un bug silencioso.
(3) **La conclusion original del item 97 era incorrecta.** Decia que `abandoned` "si deberia cortar el acceso de entrada". Lo decidido es lo contrario.
(4) **`canSell` tiene que existir separado de `canAccessStorefront`.** `cancelled` responde en read-only y NO vende; `past_due` vende y NO publica. Fusionar "responde" y "vende" pierde la asimetria deliberada de D17.
(5) **El override de tenant `cancelled` lleva `canReactivate: false` EXPLICITO, no heredado.** Omitirlo en un `Partial<...>` lo deja venir de la suscripcion, y un tenant cancelado con suscripcion `expired` heredaria `true`.
(6) **El codigo declara que el spec es la fuente de verdad**, asi que cambiar el codigo obliga a cambiar los specs. Habia DOS tablas (2026-09 y 2026-10-09) y las dos se actualizaron.
(7) **Agregar un `select` en el medio de un mock secuencial rompe por forma, no por tipo.** `makeTxMock` consume la cola en orden; insertar la consulta de tenants entre suscripcion y plan hace que el plan se lea de la fila equivocada. Sintoma: 500, no error de TypeScript.
(8) El patron de los 3 cambios es uno solo: **bloquear el acceso a un panel es siempre peor que dejarlo ver en modo lectura**.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
