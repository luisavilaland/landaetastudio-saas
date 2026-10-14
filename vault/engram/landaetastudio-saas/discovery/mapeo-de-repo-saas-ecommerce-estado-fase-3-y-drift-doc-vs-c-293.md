---
id: 293
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:06:29"
updated_at: "2026-10-14 15:06:29"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Mapeo de repo saas-ecommerce — estado Fase 3 y drift doc vs código"
---

# Mapeo de repo saas-ecommerce — estado Fase 3 y drift doc vs código

**What**: Mapeo read-only de docs + código del monorepo. Estado real: Fase 3 (Autoservicio de tenants) en curso. Docs de fase: `docs/superpowers/plans/2026-10-09-fase3.md` (T0-T16, slices S1-S6), spec `2026-10-09-fase3-autoservicio-tenants.md`, design `2026-10-09-fase3-design.md` (D1-D18).
**Why**: handoff para dev senior que se reincorpora.
**Where**: HEAD = `develop`, último commit `ef401aa` (S4b/#251). Migraciones: `0000_baseline.sql` + 0001_dapper_revanche, 0002_resolve_tenant_by_preapproval, 0003_tenants_status_enum, 0004_tenants_logo_url. 78 archivos `.test.ts` (admin 28, storefront 16, commerce 16, validation 5, db 4, superadmin 4, auth/logger/storage/test-utils 1 c/u, scripts 1) + 15 specs E2E.
**Learned**:
- Hecho en Fase 3: T1 (PLATFORM_HOST, S2), T2-T5 (S1: pgEnum tenants.status + filtro proxy + activateTenant), T6 (items 65/67), T7 (S3: POST /api/register-tenant), T9+T11 (S4a), T10 (S4b: deriveTenantPermissions). Pendiente: T8 (MP tenant, S3b), T12-T14 (S5 UI), T15-T16 (S6).
- Drift verificado: README.md L515 dice "889 tests, 78 archivos" pero su propio L548 dice "769 tests, 73 archivos"; TESTING.md L295/L298 repite 889/78. Las únicas mediciones en el vault son 837 (item 98, 2026-10-13) y 853 (item 100).
- README L234 dice `docs/adr/` ADR-001..022 — no existe; los ADR viven en `vault/01_ADRs/` (ADR-001..ADR-028).
- README tabla Roadmap marca Fase 2 "Pendiente" aunque cerró el 2026-10-06 (arquitectura.md L76-78).
- Deuda: 101 ítems con 2 huecos de numeración (item 99 inexistente; item 17 con heading `###` en vez de `##`).
- `@repo/db`, `@repo/auth`, `@repo/commerce`, `@repo/storage` NO tienen script `lint` → `pnpm lint` cubre 6 workspaces (item 10 abierto, confirmado).
- `PLATFORM_HOST` y `ENABLE_DEFAULT_TENANT_FALLBACK` están en `packages/validation/src/env.ts` pero NO en `turbo.json > tasks.build.env`.
- `withTenantContext(` medido: admin 44 ocurrencias/17 archivos, storefront 18/12, commerce 7/5 (el design D14 dice "45 call sites").
- Mojibake presente en comentarios del código (p.ej. `packages/auth/src/index.ts` L8, `packages/commerce/src/index.ts` línea "Suscripciones ?", `packages/db/seed.ts:845`) pese a que `check:encoding` está cableado.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
