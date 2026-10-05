---
id: 147
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/test-pasa-local-por-credencial-de-env-local
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 22:46:30"
updated_at: "2026-10-04 22:46:30"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Test que pasa local por credencial filtrada de .env.local falla en CI"
---

# Test que pasa local por credencial filtrada de .env.local falla en CI

**What**: `route.test.ts` (tests del stub de T5-prep) falló en CI con 503 en 2 tests y fue eliminado, migrando antes 1 caso que faltaba a `handler.test.ts`. CI re-corrido en verde sobre `31d276c`.

**Why**: Los 2 tests esperaban 200 y recibieron 503. El diagnostico inicial proponia "no mockean la resolucion de tenant". Era **incorrecto**.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/__tests__/` — se elimino `route.test.ts` (193 lineas) y se migro 1 caso a `handler.test.ts`

**Learned**:
- **CAUSA REAL:** `route.test.ts` nunca seteaba `MP_PLATFORM_ACCESS_TOKEN`. Localmente pasaba porque `vitest.config.ts` hace `dotenv.config({ path: '.env.local' })` y la credencial real entraba sola. En CI el `.env.local` tiene 5 vars y esa no esta → el handler responde 503 en su rama de token faltante.
- **Por que solo fallaban 2 de 6:** los otros 4 cortan antes del chequeo de token (401 por firma, 503 por secret ausente, 413 por body grande). Solo los 2 que esperan 200 llegan a esa rama.
- **PATRON REUTILIZABLE: un test que pasa localmente porque una credencial real se filtra desde `.env.local` tiene confianza falsa.** Para verificar autonomia hay que simular el entorno de CI: quitar la var de `.env.local` manteniendo `DATABASE_APP_URL` (si se quita el archivo entero, `@repo/db` lanza por `DATABASE_APP_URL` ausente y el archivo de test ni carga — error distinto).
- `handler.test.ts` no tenia el problema: su `beforeEach` setea las tres vars (secrets + token). Por eso paso en CI.
- **Cobertura comparada antes de borrar (6 casos):** 5 cubiertos, **1 faltaba** — el fallback al secret del tenant cuando el de plataforma NO esta configurado, que es la otra mitad de la regresion del PR #187. Sin migrarlo, borrar `route.test.ts` perdia esa cobertura y cambiar el `??` por `||` pasaria los tests.
- **Verificar que un test de regresion真的 muerde:** rompi el fallback a proposito, el test migrado fallo, lo restauré y paso. Un test que no falla cuando el codigo esta roto no es un test.
- CI log delata el diagnostico: `◇ injected env (5) from .env.local` + `✓ handler.test.ts (37 tests)` frente a `❯ route.test.ts (6 tests | 2 failed)`.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-pattern]]
