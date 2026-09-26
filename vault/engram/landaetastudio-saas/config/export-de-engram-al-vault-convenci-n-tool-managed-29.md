---
id: 29
type: config
project: landaetastudio-saas
scope: project
topic_key: config/engram-vault-export
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 13:23:56"
updated_at: "2026-09-26 13:23:56"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Export de Engram al vault + convención tool-managed"
---

# Export de Engram al vault + convención tool-managed

**What**: Export inicial de Engram al vault (34 .md en `vault/engram/`) + `.gitignore` del sync state + `vault/README.md` documentando human-curated vs tool-managed. Commits `77ea187` (fix encoding) y `89553f5` (export) en el PR #143.
**Why**: El humano decidió exportar las memorias de Engram al vault en el mismo PR, tratando `engram/` como contenido tool-managed.
**Where**: `vault/engram/**` (34 .md), `vault/engram/.engram-sync-state.json` (gitignored), `vault/README.md`, `.gitignore` L115, `vault/02_Bitacora/bitacora.md` (fix encoding + entrada 2026-09-26).
**Learned**:
- **`engram obsidian-export --vault vault/` escribe en `vault/engram/`, NO en `vault/06_Engram/`.** El subdirectorio lo decide la tool, no el flag. El plan asumía `06_Engram/` y ese path no existe. El sync state guarda rutas relativas a `engram/`, así que renombrar rompe el incremental y duplica el árbol.
- Engram 2.2.0 en `C:\Users\exodo\AppData\Local\engram\bin\engram.exe`. MCP `engram` **connected** en OpenCode. 9 sesiones / 28 observaciones / 37 prompts.
- Comandos que NO existen: `engram mem list`. Los correctos: `engram search <query>`, `engram context [project]`, `engram stats`, `engram projects list`, `engram obsidian-export --vault <path>`.
- `vault/README.md` afirmaba que Engram exportaría a `06_Engram/` — afirmación FALSA, corregida en este commit. `vault/06_Engram/` existe vacío con `.gitkeep` **trackeado** (pendiente de borrar, no lo toqué por no estar autorizado).
- El export genera slugs que pierden acentos: `reintentar-aceptaci-n-de-anydesk-5.md`, `confirm-conexi-n-remota-anydesk-7.md`.
- El export sí tiene 3 líneas con mojibake intencional (cita de ejemplos del bug) en `reparar-doble-encoding-utf-8-de-bitacora-md-28.md`. No es corrupción.
- GGA v2.10.1 con Nemotron 3 Ultra: los commits de docs pasan en ~2s porque `.md` no matchea `FILE_PATTERNS` → "No matching files staged for commit", exit 0.
- PR #143: 4 commits, 79 archivos, +2907/−1592, MERGEABLE, OPEN, HEAD `89553f5`.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-config]]
