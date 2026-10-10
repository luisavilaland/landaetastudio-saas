---
id: 277
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 18:30:09"
updated_at: "2026-10-10 18:30:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "S1 tenants.status enum con filtro active en proxy"
---

# S1 tenants.status enum con filtro active en proxy

**What**: `tenants.status` paso de boolean-ish/inferido a `pgEnum` (`pending | active | suspended | cancelled`) con default `pending`. El proxy del storefront filtra `status = 'active'` en los TRES caminos de resolucion (subdominio, customDomain, cookie `tenant-slug`). Se agrego `activateTenant` en `@repo/commerce` como funcion hoja con compare-and-set (`WHERE tenantId AND status='pending'`). `proxy.test.ts` fue reescrito para importar el proxy real (item 93). El wrapper `scripts/check-migrations-applied.mjs` ahora verifica tambien que la columna use el enum.

**Why**: sin el filtro, un tenant `pending` o `suspended` era indistinguible de uno `active` para el storefront: podia publicar, cobrar y recibir pedidos.

**Where**: `packages/db/migrations/0003_tenants_status_enum.sql`, `packages/db/src/schema.ts`, `packages/validation/src/schemas.ts`, `apps/storefront/proxy.ts`, `packages/commerce/src/tenant-lifecycle.ts`, `apps/storefront/__tests__/proxy.test.ts`, `scripts/check-migrations-applied.mjs`.

**Learned**:
(1) La cookie `tenant-slug` es user-controlled y tambien necesita el filtro de status; no era solo el subdominio ni el customDomain.
(2) Una transicion que necesita otra forma se agrega como funcion nueva, no como flag de la existente. Un flag devuelve el WHERE a ser codigo escrito a mano (item 61).
(3) `tenants` NO tiene RLS (tabla raiz; el checklist prohibe RLS sin tenantId + policy). Por eso el test de `activateTenant` puede ser de una sola capa: no hay nada que enmascare el WHERE. La ausencia de proteccion hace el test mas simple, no mas debil.
(4) `queryChunks.length > 1` NO discrimina un filtro ausente: tanto `eq(a,b)` como `and(a,b)` dan dos chunks. Serializar el SQL con `PgDialect` si discrimina.
(5) Los lookups de tenant se cortan en cadena: si customDomain resuelve, el lookup por slug nunca corre. "El ultimo where" no es el que uno creye.
(6) El fallback `ENABLE_DEFAULT_TENANT_FALLBACK` se evalua DESPUES de los dos lookups con base; cualquier host con punto consulta la base antes.
(7) `ALTER TABLE ... TYPE` toma ACCESS EXCLUSIVE: no verificar el wrapper revirtiendo columnas en produccion. Ejercitar la rama de comparacion alterando el valor esperado.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
