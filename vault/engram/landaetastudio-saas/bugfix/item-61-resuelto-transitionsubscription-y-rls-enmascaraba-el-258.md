---
id: 258
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/item-61-transition-subscription
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 22:45:01"
updated_at: "2026-10-08 22:45:01"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 61 resuelto: transitionSubscription, y RLS enmascaraba el WHERE"
---

# Item 61 resuelto: transitionSubscription, y RLS enmascaraba el WHERE

**What**: Item 61 (H-T6-1) resuelto. `transitionSubscription` en `packages/commerce/src/subscription-transition.ts`, con el `WHERE` construido internamente. `applyTransition` ya no escribe el `UPDATE`. Test de integracion contra Neon con 2 tenants en dos capas. +5 tests (754 -> 759).

**Why**: Los tests mock-based no observan el `WHERE`. Quitar `eq(dbSubscriptions.tenantId, ...)` del `UPDATE` de `applyTransition` dejaba la suite completa en verde.

**Where**: `packages/commerce/src/subscription-transition.ts` (nuevo), `packages/commerce/src/index.ts` (export), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (refactor), `packages/commerce/src/__tests__/subscription-transition.test.ts` (nuevo).

**Learned**:
- **RLS ENMASCARA EL `WHERE`, y eso casi hace el fix indetectable.** Con la mutacion aplicada, los tests en contexto de produccion pasaban 4/4. No faltaba una asercion: **otra capa detenia la escritura** — el UPDATE corre dentro de `withTenantContext(A)` -> `set_tenant_id(A)` -> la policy bloquea la fila de B. Por eso el test tiene dos capas: capa 1 con rol sin BYPASSRLS (comportamiento real + CAS del item 70), y **capa 2 con owner BYPASSRLS**, donde el WHERE es el unico guard y por lo tanto observable. **Sin la capa 2 el test no probaria nada.**
- **La verificacion en rojo fue quirurgica:** con la mutacion aplicada fallan **exactamente los 2 tests de la capa 2** y los 3 de la capa 1 siguen verdes. Ese patron es la prueba de que las dos capas hacen trabajos distintos.
- **El primer test fallo por una razon correcta:** use el cliente de `app_user` para las lecturas "sin proteccion", asi que RLS devolvia 0 filas y yo observaba `undefined`. Hizo falta un segundo cliente owner solo para poder VER la fila ajena, que es justo lo que el test necesita observar.
- **Quitar `id` del WHERE es mas seguro, no menos.** `subscriptions_tenant_idx` es UNIQUE sobre `tenantId`, asi que `tenantId AND status` alcanza y elimina una segunda fuente de verdad que puede estar equivocada sin que nadie lo note.
- **La funcion vive en `@repo/commerce`, no en `@repo/db`:** `SubscriptionStatus` es de dominio y `@repo/db` no depende de nada interno; importarlo desde alla seria dependencia circular. Mismo criterio que ya usan `health.ts` y `encryption.ts`.
- **El CAS del item 70 intacto:** `from` viaja como parametro, `.returning()` vacio -> `concurrent_update`. Los 2 tests del webhook que lo cubren siguen verdes.
- Los 30 call sites restantes de `withTenantContext` quedan fuera de scope, por decision explicita de Luis.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
