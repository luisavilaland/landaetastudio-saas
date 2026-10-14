---
id: 299
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec4f8dba7ffehYHgc3dN4OLjv7
created_at: "2026-10-14 15:47:14"
updated_at: "2026-10-14 15:47:14"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "T11 logo de tenant inerte: columna escrita, nadie la lee"
---

# T11 logo de tenant inerte: columna escrita, nadie la lee

**What**: el feature T11/D16 (logo del tenant) no esta cableado: la migracion 0004 y el endpoint POST /api/config/tenant/branding existen, pero nadie llama al endpoint y nadie lee la columna `tenants.logoUrl`.
**Why**: auditoria de fase 3 (2da pasada); no estaba registrado en vault/03_Deuda ni en la auditoria de la primera pasada.
**Where**: `apps/admin/app/api/config/tenant/branding/route.ts` (unico escritor de `dbTenants.logoUrl`), `packages/db/src/schema.ts:52`, `packages/db/migrations/0004_tenants_logo_url.sql`; lector real = `apps/storefront/app/layout.tsx:67,83` que lee `settings.logoUrl` (jsonb), y la UI admin escribe por `/api/config/settings` (`apps/admin/app/(dashboard)/store/settings/page.tsx:59,100`).
**Learned**: grep `tenant/branding` en `apps/` devuelve solo su propio test; grep `logoUrl` en `packages/` no muestra ningun lector de la columna. Hay DOS fuentes de verdad para el logo (`tenants.logoUrl` vs `tenants.settings.logoUrl`) y la visible es la jsonb vieja. Patron a buscar en features nuevos: columna nueva + endpoint nuevo sin llamador ni lector = feature inerte con tests verdes.

---
*Session*: [[session-ses_ec4f8dba7ffehYHgc3dN4OLjv7]]
