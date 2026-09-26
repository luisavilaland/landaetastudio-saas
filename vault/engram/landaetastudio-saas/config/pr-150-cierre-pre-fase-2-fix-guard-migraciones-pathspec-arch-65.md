---
id: 65
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 21:59:59"
updated_at: "2026-09-26 21:59:59"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR #150: cierre pre-Fase 2 + fix guard migraciones (pathspec archive)"
---

# PR #150: cierre pre-Fase 2 + fix guard migraciones (pathspec archive)

**What**: Cerrado el meta-trabajo pre-Fase 2. Commit `eca4892` en `chore/audit-cierre-pre-fase2`, **PR #150** → develop, abierto y MERGEABLE, NO mergeado (decisión del humano). 7 archivos, +93/-18.

**Why**: Limpiar 4 discrepancias doc vs código, corregir el item 2, y cerrar un gap de cobertura en el guard de migraciones.

**Where**: `scripts/check-migrations.sh`, `AGENTS.md`, `PROMPTS.md`, `README.md`, `docs/superpowers/specs/2026-09-blueprint-v2.6.md`, `vault/03_Deuda/deuda-tecnica.md` (item 2), `vault/02_Bitacora/bitacora.md` (append-only, 0 líneas con `-`)

**Learned**:
- **Fix del guard**: pathspec extendido con `docs/migrations-archive/*/*.sql` y `*.json`. Gap confirmado empíricamente: el pathspec viejo devolvió VACÍO mientras el guard pasaba verde sobre `0013_ensure_rls_and_grants.sql` reescrito. El nuevo lo detecta (exit 1, nombra el archivo).
- **El test 4.4 del plan era incorrecto**: un archivo NUEVO en el archive NO hace fallar el guard. `--diff-filter=MD` excluye `A` (Added) por diseño — las migraciones nuevas deben poder agregarse. Verificado en ambas variantes (untracked y con `git add`): pasan. Si alguna vez el archive debe ser congelado estricto, hace falta un flag dedicado; quedó anotado en el item 2.
- **WSL bash está roto** en esta máquina (`execvpe(/bin/bash) failed`). Para correr scripts `.sh` usar `C:\Program Files\Git\bin\bash.exe` (Git Bash). `bash` en PATH apunta a WSL y falla.
- **GGA no bloquea commits de docs**: sus `FILE_PATTERNS` son `*.ts,*.tsx,*.js,*.jsx,*.sql` y excluyen `vault/*`. Un commit de `.md`/`.sh` pasa con el warning "No matching files staged for commit".
- **`format:check` SÍ corre en CI** (ci.yml:42-43, prettier sobre `**/*.md`) y NO estaba en el DoD de AGENTS.md. Editar markdown lo puede romper: aplicó `prettier --write` sobre `deuda-tecnica.md`, con el diff confinado a las líneas del item 2.
- **El MCP de GitHub tiene credenciales inválidas** ("Bad credentials"). Usar `gh` CLI. `gh` no está en PATH: vive en `C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe` y autentica como `EdgarVz`.
- El blueprint real está en `docs/superpowers/specs/2026-09-blueprint-v2.6.md`, no en `vault/05_Specs/*.pdf`.
- El checkbox de Engram en el "Checklist de cierre de PR" de AGENTS.md ya existía; lo que faltaba era el aviso de que el Orquestador lo saltea.
- `vault/engram/` del export de esta sesión quedó SIN commitear a propósito (7 archivos, tool-managed).

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
