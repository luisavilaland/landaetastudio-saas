---
id: 17
type: discovery
project: landaetastudio-saas
scope: project
topic_key: docs/bitacora-vault-migration
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-25 12:55:07"
updated_at: "2026-09-25 12:55:07"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Preflight bitacora vault migration references"
---

# Preflight bitacora vault migration references

**What**: Completé el pre-flight read-only para migrar `bitacora.md` a `vault/02_Bitacora/bitacora.md` sin editar nada.
**Why**: Identificar exactamente las referencias y guards que deberán cambiar en una fase posterior.
**Where**: `AGENTS.MD`, `bitacora.md`, `docs/`, `scripts/`, `.github/workflows/`, `PROMPTS.md`, skills globales.
**Learned**: Las 24 referencias del filtro `*.md` se dividen en 13 internas (historia inmutable), 9 path-refs a actualizar y 2 textuales. `AGENTS.MD` agrega 18 reglas/referencias y exige raíz, prohíbe `docs/bitacora.md`, y define verificación append-only manual. No existe guard automatizado específico de bitacora; CI solo protege migraciones. No hay links Markdown a bitacora ni referencias desde vault.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-docs]]
