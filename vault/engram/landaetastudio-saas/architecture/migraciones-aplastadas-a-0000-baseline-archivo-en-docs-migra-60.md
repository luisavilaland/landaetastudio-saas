---
id: 60
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 21:49:27"
updated_at: "2026-09-26 21:49:27"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Migraciones aplastadas a 0000_baseline + archivo en docs/migrations-archive"
---

# Migraciones aplastadas a 0000_baseline + archivo en docs/migrations-archive

**What**: El proyecto se **aplasta** a una sola migración `0000_baseline.sql`. Las migraciones incrementales 0005-0015 se movieron a `docs/migrations-archive/2026-09-24/`.

**Why**: Decisión de consolidación del 2026-09-24 (documentada en `packages/db/migrations/README.md`).

**Where**: `packages/db/migrations/` (solo `0000_baseline.sql` + `meta/0000_snapshot.json` + `meta/_journal.json`), `docs/migrations-archive/2026-09-24/`

**Learned**:
- Las 3 tablas de Fase 1 (plans, subscriptions, tenant_mp_config) y su RLS/grants ya están dentro del baseline, junto con 0013 (ensure_rls_and_grants) y 0015 (revoke_plans_dml).
- `scripts/check-migrations.sh` sigue existiendo y sigue siendo válido.
- `packages/db/backup-pre-t7-2026-09-21T21-19-29-984Z.sql` vive en el árbol pero NO está trackeado (`.gitignore`: `backup-*.sql`).
- **Docs desactualizadas tras el squash**: AGENTS.md todavía cita migraciones 0010/0013 por número como si vivieran en `packages/db/migrations/`.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
