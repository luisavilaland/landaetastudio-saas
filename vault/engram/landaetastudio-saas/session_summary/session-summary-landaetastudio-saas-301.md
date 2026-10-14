---
id: 301
type: session_summary
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec4f8dba7ffehYHgc3dN4OLjv7
created_at: "2026-10-14 15:47:48"
updated_at: "2026-10-14 15:47:48"
revision_count: 1
tags:
  - landaetastudio-saas
  - session_summary
aliases:
  - "Session summary: landaetastudio-saas"
---

# Session summary: landaetastudio-saas

## Goal
Segunda pasada de auditoria QA/seguridad de Fase 3 mid-phase en `landaetastudio-saas`: verificar cada claim de la auditoria consolidada de la primera pasada (rama `audit/fase3-midphase`) y buscar hallazgos nuevos de codigo/seguridad que la primera pasada no vio. READ-ONLY sobre `apps/` y `packages/`; entregable solo texto.

## Instructions
- Scope PASO 3 = codigo/seguridad; el analisis de plan/proceso lo hace OTRO agente (no duplicar su scope ni sus archivos).
- Sin `pnpm build`, sin `pnpm test` completo (889/889 ya verdes); corridas de archivo unico permitidas.
- Anti-duplicacion contra `vault/03_Deuda/deuda-tecnica.md` antes de reportar cualquier hallazgo.
- Nunca reportar mojibake de salida de PowerShell (decodifica UTF-8 como ANSI); medir bytes solo con Node o `git diff --numstat`.
- Deliverable: 4 secciones (Claims verificadas / Errores en la primera pasada / Hallazgos nuevos / Limitaciones).

## Discoveries
- **CI salta siempre las 39 pruebas de DB**: `ci.yml:48-49` escribe `DATABASE_URL`/`DATABASE_APP_URL` dummy y los 5 guards `isUsableUrl` rechazan `/localhost|127\.0\.0\.1|dummy/i`. En `e2e.yml:131-136` solo se recuperan `rls-cross-tenant` (8) + `preapproval` (6) → **25 tests nunca corren en ningun workflow**: `register-tenant` (15), `tenant-lifecycle` (5), `subscription-transition` (5). El propio comentario de `e2e.yml:129-130` avisa que todo archivo nuevo dependiente de DB hay que agregarlo.
- Si faltara SOLO `DATABASE_APP_URL`: `register-tenant` y `tenant-lifecycle` (guard con `DATABASE_URL`) correrian y su `beforeAll` revienta con el throw de `packages/db/src/index.ts:6-11` → 20 tests en ROJO, no skip silencioso. La claim de la primera pasada sobre el mecanismo es imprecisa.
- **T11 (logo) inerte**: nadie llama a `POST /api/config/tenant/branding` (grep en `apps/` solo da su test) y nadie lee `tenants.logoUrl`; storefront lee `settings.logoUrl` (jsonb) en `layout.tsx:67,83` y la UI admin escribe por `/api/config/settings`. Dos fuentes de verdad para el logo.
- **Item 100 refutado**: solo `apps/admin/tsconfig.json` excluye `**/__tests__/**`; storefront/superadmin si los incluyen (`tsc --listFiles`: 0 / 16 / 4). Los 28 test files de `apps/admin` no los chequea NI typecheck NI next build.
- Item 103/104 confirmados; `encryptToken` sin llamadores productivos y `EncryptionError('TENANT_NOT_FOUND')` (`encryption.ts:113`) declarado y nunca usado.
- Migraciones Fase 3 en regla: `0003`/`0004` presentes, `_journal.json` completo, `check-migrations-applied.mjs` EXPECT cubre ambas y esta cableado en `db:migrate`.
- `tenants` es tabla raiz sin `tenantId` (id, no tenantId) → RLS inaplicable por checklist; `tenant_mp_config` tiene columna + ENABLE/FORCE + policy `tenant_isolation` (`0000_baseline.sql:137,179,201,219,230,250`).

## Accomplished
- Verificadas las 5 familias de claims de la primera pasada (items 103, 104, 16 discrepancias doc↔codigo, item 98, cobertura de la matriz de permisos) con evidencia de lineas.
- Verificado en vivo: `rls-cross-tenant` 8/8 y las otras 4 suites 31/31 (39/39 total) contra Neon con `.env.local` del worktree.
- Hallazgos nuevos detectados y confirmados como no registrados en deuda: 25 tests nunca corren en CI, T11 inerte, sin rate limit en endpoint publico de alta de tenant (bcrypt 10 rounds por request + enumeracion de emails con 409), branding sin limite de tamano ni sanitizado de `file.name` en la key de R2, `/api/register-tenant` detras del matcher del proxy (404 si falta `PLATFORM_HOST`), 28 test files de `apps/admin` fuera de todo typecheck.
- Memoria guardada: 3 observaciones (CI dummy+e2e, T11 inerte, refutacion item 100) con sus conflictos juzgados `related`.

## Next Steps
- Entregar el reporte final en texto con las 4 secciones requeridas.
- Registrar los hallazgos nuevos en `vault/03_Deuda/deuda-tecnica.md` (el audit es READ-ONLY: los fixes van en PRs separados).
- Si el humano lo pide: PR para agregar los 3 archivos faltantes al paso E2E de `e2e.yml`, y para cablear lectura de `tenants.logoUrl` en storefront (o eliminar la columna/endpoint redundante).

## Relevant Files
- `.github/workflows/ci.yml:45-55` — `.env.local` dummy antes de `pnpm test`.
- `.github/workflows/e2e.yml:125-136` — paso "Run RLS integration tests" con solo 2 archivos.
- `apps/admin/app/api/config/tenant/branding/route.ts` — unico escritor de `tenants.logoUrl`, sin llamador.
- `apps/storefront/app/layout.tsx:67,83` — lee `settings.logoUrl` (jsonb), no la columna nueva.
- `apps/storefront/app/api/register-tenant/route.ts` — endpoint publico sin rate limit; 15 tests que nunca corren en CI.
- `apps/admin/tsconfig.json` vs `apps/storefront|superadmin/tsconfig.json` — exclude de `__tests__` desigual (item 100).
- `scripts/check-migrations-applied.mjs` (EXPECTED 0000-0004) — senales de migracion en regla.
- `vault/03_Deuda/deuda-tecnica.md` y `vault/04_Fases/auditoria-fase3-midphase.md` (rama `audit/fase3-midphase`) — fuentes verificadas.

---
*Session*: [[session-ses_ec4f8dba7ffehYHgc3dN4OLjv7]]
