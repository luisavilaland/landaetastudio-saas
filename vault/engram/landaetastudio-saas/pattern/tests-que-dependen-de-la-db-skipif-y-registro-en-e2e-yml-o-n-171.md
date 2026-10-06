---
id: 171
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 15:57:32"
updated_at: "2026-10-06 15:57:32"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Tests que dependen de la DB: skipIf y registro en e2e.yml o no existen en CI"
---

# Tests que dependen de la DB: skipIf y registro en e2e.yml o no existen en CI

**What**: Patron para tests de DB en este repo: `describe.skipIf(!hasAppUrl)` y registro explicito en el paso de RLS de `.github/workflows/e2e.yml`. Un test que depende de la DB tiene cero cobertura en el job `build` y solo corre si esta en esa lista.

**Why**: H1 sobrevivio a la auditoria porque la cobertura RLS es un no-op en `build` (URL dummy) y solo corre en un paso de `e2e.yml` que nominaba un solo archivo. Al agregar `preapproval-tenant-resolution.test.ts` casi repito eso, y empeore: use `if (!hasAppUrl) return` en vez de `skipIf`, asi que los 6 tests reportaban **PASSED** sin ejecutar nada. Detectado leyendo el log de CI, donde la suite nueva aparecia `passed` y `rls-cross-tenant.test.ts` aparecia `skipped`.

**Where**: `packages/db/src/__tests__/preapproval-tenant-resolution.test.ts`, `.github/workflows/e2e.yml` (paso "Run RLS integration tests"), `packages/db/src/__tests__/rls-cross-tenant.test.ts` (el ejemplo a seguir).

**Learned**:
- `if (!hasAppUrl) return` reporta **PASSED**; `describe.skipIf(!hasAppUrl)` reporta **SKIPPED**. La diferencia es un verde falso. El mismo codigo pasa o se saltea segun como se escriba el guard.
- `describe.skipIf` no le da narrowing a TypeScript: `appUrl` queda `string | undefined` y `postgres(appUrl)` no compila. Resolver con un helper explicito (`dbUrl()`) en lugar de un inline `appUrl!`, que ademas es ambiguo si le sigue un parametro de tipo.
- `ci.yml` inyecta `DATABASE_URL`/`DATABASE_APP_URL` dummy con `localhost`, asi que todo test que use `isUsableUrl` queda sin efecto ahi. La unica corrida con DB real es el paso de RLS en `e2e.yml`, con `secrets.NEON_DATABASE_APP_URL`.
- **Regla para cualquier test nuevo que toque la DB: agregarlo a la lista del paso de RLS de `e2e.yml`.** Si no, su cobertura existe solo en la maquina de quien lo escribio.
- Verificar el comportamiento en los dos sentidos antes de commitear: con URL real debe pasar, y con URL dummy debe **saltar**. Un solo lado no alcanza.
- Al correr dos suites de Neon en paralelo con 69 workers hay contencion: se observo 1 fallo intermitente en `rls-cross-tenant.test.ts` (1 de 8) en 5 corridas completas del suite; aislado pasa 8/8, y 3 corridas completas seguidas dieron 694/694. No afecta CI (ahi ambos se saltean), solo la experiencia local.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
