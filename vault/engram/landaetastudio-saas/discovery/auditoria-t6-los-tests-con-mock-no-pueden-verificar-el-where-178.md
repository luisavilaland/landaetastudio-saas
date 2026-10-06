---
id: 178
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 19:09:44"
updated_at: "2026-10-06 19:09:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoria T6: los tests con mock no pueden verificar el WHERE de una query"
---

# Auditoria T6: los tests con mock no pueden verificar el WHERE de una query

**What**: Mini auditoria de calidad de T6. 3 hallazgos: 1 HIGH (los tests con mock no pueden verificar el WHERE de una query), 2 LOW. Veredicto: T6 pasa. Mutation-lite 7/7, vi.mock 83/88, expect 454/455.

**Why**: El mock de H3 (`@/lib/logger` cuando el codigo importaba `@repo/logger`) hizo que 9 tests pasaras sin testear, y se encontro de pasada porque los tests nuevos daban 0 warns. Esa caza accidental no es reproducible; esta auditoria la vuelve un paso explicito.

**Where**: `vault/04_Fases/auditoria-t6-test-quality.md` (nuevo), `vault/03_Deuda/deuda-tecnica.md` (item 61 nuevo), `vault/02_Bitacora/bitacora.md`.

**Learned**:
- **HALLAZGO PRINCIPAL: con mocks, la semantica del `WHERE` es invisible por construccion.** Se removio `eq(dbSubscriptions.tenantId, resolved.tenantId)` del SELECT y del UPDATE de `applyTransition`, y los **705 tests siguieron verdes**. Con el filtro del SELECT en tautologia, `row` pasa a ser una fila arbitraria y el UPDATE por `row.id` escribe la que sea: fuga cross-tenant completa que ningun test ve. No es que falte un test: con `withTenantContext` mockeado no hay forma de distinguir `WHERE tenantId = X` de `WHERE true`.
- **Los tests cross-tenant existentes verifican que se PASE el tenant a `withTenantContext`, no que la query FILTRE por tenant.** Son cosas distintas y la segunda es la que evita la fuga. Un asercion sobre la forma del `WHERE` seria debil (verifica que escribiste un filtro, no que filtre).
- **La unica red real hoy es RLS en Postgres** (`rls-cross-tenant.test.ts`, 8 casos contra Neon), que protege la DB pero no el codigo que escribe mal la query.
- **La clase de bug de H3 aparece 5 veces mas**: `config/settings`, `config/tenant`, `config/tenant/domain`, `products/[id]/variants` y `shipping` mockean `@/lib/logger` mientras sus rutas importan `@repo/logger`. Como `apps/admin/lib/logger.ts` es un shim de re-export, son dos modulos distintos y el mock no tiene efecto. aqui es LOW (ningun test afirma sobre logs) pero es el mismo defecto.
- **Mutation-lite 7/7 detectadas.** Los 3 tests de T6 son efectivos: cada uno detecta exactamente la perdida que cubre (cancel/pause/resume 1/1/1, H3 2, H1 fallback 2, H1 resolver null 11, H2 decideTarget 1).
- **Regla util: un check de targets de mock debe resolver alias y normalizar relativos.** Mi primera version dio 9 falsos positivos (comparaba `'../redis'` contra `'./redis'`, y no resolvia los alias `@/` y `@repo/`). Con normalizacion a path absoluto: 83/88 correctos, 5 defectos reales.
- **Falso positivo propio corregido antes de reportar**: el check de branches mostraba `0%` en `mp-amounts.ts` por un bug del script (0/0 impreso como 0% en vez de "sin ramas"). Un hallazgo de cobertura inventado es peor que ninguno.
- **Flake de Neon**: 0/3 en esta auditoria (historico ~1 cada 4-5 corridas). No se registra como deuda porque no se reprodujo y el arreglo excede una auditoria de calidad de tests.
- No se hizo segunda pasada templada. Segun el precedente de #197, ahi es donde aparecen errores que la primera no ve.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
