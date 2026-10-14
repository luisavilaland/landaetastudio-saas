---
id: 298
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec4f8dba7ffehYHgc3dN4OLjv7
created_at: "2026-10-14 15:47:10"
updated_at: "2026-10-14 15:47:10"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "25 tests de DB nunca corren en CI (dummy URL + E2E incompleto)"
---

# 25 tests de DB nunca corren en CI (dummy URL + E2E incompleto)

**What**: CI ejecuta siempre con las 39 pruebas de integracion contra Neon saltadas, y 25 de ellas no se ejecutan en NINGUN workflow (solo 14 se recuperan en E2E).
**Why**: auditoria de fase 3 verificando el item 98 de deuda-tecnica.
**Where**: `.github/workflows/ci.yml:45-55` (escribe `DATABASE_URL`/`DATABASE_APP_URL` dummy en `.env.local` antes de `pnpm test`), `.github/workflows/e2e.yml:125-136` (solo corre `rls-cross-tenant` + `preapproval-tenant-resolution`), y los 5 guards `isUsableUrl` (rechazan `/localhost|127\.0\.0\.1|dummy/i`).
**Learned**: los guards NO dependen de env ausente sino de la URL dummy → el skip es determinista en cada corrida de CI. Los 3 archivos que faltan en el paso E2E son `register-tenant/__tests__/route.test.ts` (15), `tenant-lifecycle.test.ts` (5) y `subscription-transition.test.ts` (5) = 25 tests con cobertura efectiva cero en CI. El propio comentario de `e2e.yml:129-130` avisa que todo archivo nuevo que dependa de DB hay que agregarlo ahi. Correccion adicional: si faltara SOLO `DATABASE_APP_URL`, `register-tenant` y `tenant-lifecycle` (que guardan con `DATABASE_URL`) seguirian corriendo y su `beforeAll` revienta con el throw de `packages/db/src/index.ts:6-11` → 20 tests en ROJO, no skip silencioso.

---
*Session*: [[session-ses_ec4f8dba7ffehYHgc3dN4OLjv7]]
