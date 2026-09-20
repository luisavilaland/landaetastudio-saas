# Bitácora de cambios — saas-ecommerce

## 2026-09-19 — T6: helper de cifrado/descifrado con pgcrypto

- Implementado: `packages/commerce/src/encryption.ts`
  - `encryptToken(tenantId, key, values)` → upsert cifrado con pgcrypto.
  - `decryptToken(tenantId, key, column)` → descifra en memoria.
  - Clave como bind param directo (ADR-024 enmienda 2026-09-18).
  - `EncryptionError` tipado: `EMPTY_KEY`, `ENCRYPTION_FAILED`, `DECRYPTION_FAILED`, `INVALID_COLUMN`.
- Exportado como `@repo/commerce/encryption`.
- Tests: 19 (roundtrip, cross-tenant, bind params encrypt/decrypt, fail-closed, INVALID_COLUMN).
- Auditoría (@QA + @Diseñador): 1 ALTO resuelto (try/catch en decryptToken) + 1 bug funcional detectado en review humano (decryptToken usaba `${column}` como bind param string, no como nombre de columna). Fix: mapa hardcodeado via `COLUMN_NAMES` + `getColumnRef()` (evita SQL injection de `sql.raw` directo).
- Deuda registrada: ítems 11-13 en `docs/deuda-tecnica.md` (ítem 11 resuelto en este PR).
- PR #123.

---

## 2026-09-19 — T6: lección de proceso (subagentes)

**Contexto**: por cuarta vez consecutiva (T2, T4, T5, T6), el agente no usó subagentes de construcción cuando el prompt lo indicaba explícitamente, y no avisó antes de empezar.

**Justificación del agente**: "T6 es una única tarea cohesiva sin partes independientes paralelas." No es válida: el prompt dividía T6 en 3 partes (implementación, tests, verificación).

**Consecuencia**: el código se verifica por auditoría (con subagentes) antes del merge, pero el proceso de construcción no fue el acordado.

**Regla reforzada**: ver AGENTS.md sección "Subagentes — roles y obediencia". Confirmación obligatoria antes de empezar.

**Detalle de la desviación**:
- Prompt T6 instruía: "Subagentes — roles y obediencia" → "Con instrucción explícita del usuario: usar la cantidad y patrón exacto indicado... Reportar al inicio qué subagentes se despacharán y con qué scope"
- El agente NO despachó subagentes A/B/C (implementación, tests, verificación) ni reportó nada al inicio
- El agente procedió directamente a implementar en serie

**Correctivo**: en T7, confirmar explícitamente al usuario los subagentes a despachar ANTES de empezar, según el patrón solicitado.