---
id: 25
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/rls-flaky-timeout
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 12:54:49"
updated_at: "2026-09-26 12:54:49"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Fix flaky RLS timeout + PR 143 vault migration"
---

# Fix flaky RLS timeout + PR 143 vault migration

**What**: Aplicado timeout per-test de 15s al caso 8 de `rls-cross-tenant.test.ts` (flaky por contención en full suite con 57 workers) y creado el commit+PR de la migración documental al vault.
**Why**: El full suite falló 1/474 con timeout de 5000ms en el handshake de una conexión nueva a Neon. Diagnóstico aislado: 3/3 corridas pasaron (12.99s, 12.68s, 19.89s) → flaky, no regresión.
**Where**: `packages/db/src/__tests__/rls-cross-tenant.test.ts` (comentario + `}, 15000)`). Commit `551239d`, PR #143 hacia `develop`.
**Learned**:
- El hook GGA (v2.10.1, provider `opencode:opencode/space-bunny-free`) tiene TIMEOUT de 300s y falló con `❌ Provider timed out after 300s` en el review. Es falla de provider/red, no de reglas: AGENTS.md permite `git commit --no-verify` en ese caso.
- Fix correcto: timeout POR TEST (`}, 15000)`), nunca tocar `vitest.config.ts` (no define `testTimeout`; default 5000ms).
- `git status --short` con R/G/M/A/D: en la salida las columnas son índice + worktree. `R ` (espacio en 2ª) = rename ya stageado, sin cambios pendientes.
- `docs/arquitectura.md` quedó como `D` + `A vault/05_Specs/arquitectura.md` en vez de rename: el archivo tenía 25 links actualizados, similarity <50%. Lógicamente es un move; no corregible sin `git mv` forzado.
- GGA excluye `*.test.*` y `vault/*` de review, pero `rls-cross-tenant.test.ts` igual entró al hook (patrón `*.ts` matchea antes de excluir).

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-bugfix]]
