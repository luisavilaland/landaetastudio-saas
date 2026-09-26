---
id: 63
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 21:49:57"
updated_at: "2026-09-26 21:49:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Deuda técnica: 31 items, ~21 abiertos; bloqueantes son encryptToken UPDATE-only y T12"
---

# Deuda técnica: 31 items, ~21 abiertos; bloqueantes son encryptToken UPDATE-only y T12

**What**: Inventario de deuda técnica — 31 items numerados en `vault/03_Deuda/deuda-tecnica.md`; ~10 cerrados (8 RESUELTO, 2 IMPLEMENTADO), ~21 abiertos.

**Why**: El usuario pidió la deuda técnica visible en la reincorporación.

**Where**: `vault/03_Deuda/deuda-tecnica.md`

**Learned** — items abiertos que más pesan:
- **Bloqueantes de Fase 2/3 (código):**
  - 18: `encryptToken` es UPDATE-only, sin upsert. No hay ruta de INSERT para la primera fila de `tenant_mp_config`. Con un UPDATE que no matchea filas, no falla — el fallo es silencioso. Bloquea el autoservicio de Fase 3.
  - 22: T12 quedó mock-only; el roundtrip real de DB está diferido a Fase 3.
  - 21: `publicKey` e `isVerified` existen en el schema pero no están en ADR-024 (contrato desalineado).
- **Infra / proceso:**
  - 2: formalizar en CI la política de migraciones inmutables (el guard `scripts/check-migrations.sh` existe pero no está cableado en CI).
  - 24: `db:migrate` ejecuta `drizzle-kit up` y `setup` puede seedear sin schema.
  - 29: plugin `ponytail` roto en `opencode.json`.
  - 30: permisos de edición restringidos en worktrees de Paseo.
- **Datos / migraciones:**
  - 8: FKs RESTRICT en 5 tablas pre-existentes. 14: tracking Drizzle incompleto en la BD actual. 15: snapshot no refleja `isRLSEnabled`. 23: colisión de IDs en snapshots 0012-0014. 16: seed destructivo sin guard extra.
- **Históricos ya resueltos** (no re-abrir): 1, 3, 4, 6, 7, 11, 19, 31. El 28 pasó a nota informativa.
- Los items 25/26 son datos corruptos (U+FFFD) en la bitácora.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
