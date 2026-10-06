---
id: 177
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 18:37:50"
updated_at: "2026-10-06 18:37:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "T6 completo: gap real era el catch de las 3 rutas de mutacion"
---

# T6 completo: gap real era el catch de las 3 rutas de mutacion

**What**: T6 del plan de Fase 2 cerrado. 3 tests nuevos (no los que se suponian). Los tests de ordenes sin tocar: 705 en 69 archivos, base 702.

**Why**: El gap real de T6 no era "faltan suites": las 9 de §9.1 existen salvo `reactivate.test.ts`, y los 3 cross-tenant de §9.2 ya estaban cubiertos. El hueco concreto era que `cancel`, `pause` y `resume` rendian 71.42% de lineas, las tres con el mismo unico hueco: el `catch` que llama a `serverError`. Un 500 en esas tres rutas no lo ejercitaba nadie.

**Where**: `apps/admin/app/api/subscriptions/__tests__/mutations.test.ts` (nuevo describe "mutaciones - fallo de infraestructura (T6)"), `package.json` + `pnpm-lock.yaml` (`@vitest/coverage-v8`), `vault/03_Deuda/deuda-tecnica.md` (items 58, 59, 60), `vault/02_Bitacora/bitacora.md`.

**Learned**:
- **La cobertura nunca fue medible en este repo.** `vitest.config.ts` declara `coverage.provider: 'v8'` desde siempre, pero `@vitest/coverage-v8` no estaba declarado en NINGUN package.json ni en el store de pnpm. Configurar un provider que no esta instalado es una configuracion que no puede funcionar: `MISSING DEPENDENCY`. Por eso ningun criterio de aceptacion de los ultimos PRs (que pedian ">= 80%") pudo verificarse nunca.
- **`pnpm test --coverage` no mide nada**: pnpm se come el flag (`Unknown option: 'coverage'`). Hay que usar `pnpm exec vitest run --coverage`. Son dos fallas distintas que se confunden en una.
- **El reporter de texto de coverage oculta archivos bien cubiertos.** Con cancel/pause/resume al 100%, sus filas desaparecen de la tabla: los directorios largos se truncan (`...iptions/cancel`) y el agrupamiento los colapsa. Los archivos SI estan en `coverage-final.json`, y `--coverage.include` tampoco arregla la tabla. Consecuencia real: si uno lee la tabla, concluye "no se cubre" cuando es al reves. Los numeros hay que leerlos del JSON.
- **`reactivate.test.ts` no es un gap, es divergencia plan-implementacion:** T0 reemplazo `reactivate` por `pause` + `resume`, asi que la suite de §9.1 apunta a un endpoint que nunca se construyo. Lo que existe es `canReactivate` en la capa de dominio.
- **El gap de §9.2 #2 ("la query incluye eq(tenantId)") es una asercion estructural, no de comportamiento.** No corresponde a un test unitario; el RLS real ya lo cubre (`rls-cross-tenant.test.ts`, 8 casos contra Neon).
- **Cobertura final de Fase 2:** cancel/pause/resume 100%, plan 94.67%, preapproval 92.16%, GET 90.91%, mutate 100%, handlers 96.88%, webhook 81.28%, mp-amounts/mp-webhook-events/subscription-permissions 100%, proration 92.86%, signature 95.92%, mp-subscriptions 81.40%. Global 77.90% -> 78.11%.
- **Flakiness conocido:** las dos suites de Neon (rls-cross-tenant y preapproval-tenant-resolution) corren en paralelo con 69 workers y pueden fallar en `beforeAll` bajo contencion. 1 fallo en ~4 corridas completas. No afecta CI porque ahi ambas se saltean.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
