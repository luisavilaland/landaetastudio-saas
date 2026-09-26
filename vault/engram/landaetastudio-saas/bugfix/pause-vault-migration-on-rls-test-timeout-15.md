---
id: 15
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: docs/vault-migration-inventory
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-25 12:50:51"
updated_at: "2026-09-26 12:38:17"
revision_count: 2
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Pause vault migration on RLS test timeout"
---

# Pause vault migration on RLS test timeout

**What**: Inicié la migración narrativa al vault en `chore/vault-migrate-docs`; moví ADRs, bitácora, deuda, auditoría, arquitectura, brief y blueprint, renombré AGENTS.MD a AGENTS.md y actualicé referencias operativas/stub de docs.
**Why**: Preparar el PR de migración solicitada.
**Where**: `develop` → rama `chore/vault-migrate-docs`; archivos bajo `vault/`, `docs/README.md`, `AGENTS.md`, `PROMPTS.md`, `README.md`, `SETUP.md`, `.github/PULL_REQUEST_TEMPLATE.md`, migraciones README.
**Learned**: Las cuatro verificaciones comprehensivas noOUNT中找到 refs huérfanas reales; matches restantes son históricos de bitacora, `docs/superpowers/` (paths que permanecen), `pr-body.md` scratch o referencias válidas a superpowers. DoD se detuvo porque `pnpm test` falló 1/474: `rls-cross-tenant.test.ts:330` timeout de 5s en el caso sin `set_tenant_id`; lint/typecheck y `check-migrations.sh` pasaron. No se hizo staging/commit/push/PR.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-docs]]
