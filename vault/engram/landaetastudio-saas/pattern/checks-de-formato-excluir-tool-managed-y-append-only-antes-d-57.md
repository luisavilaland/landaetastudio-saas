---
id: 57
type: pattern
project: landaetastudio-saas
scope: project
topic_key: tooling/format-check-exclusions
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 21:12:41"
updated_at: "2026-09-26 21:12:41"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Checks de formato: excluir tool-managed y append-only antes de escribir"
---

# Checks de formato: excluir tool-managed y append-only antes de escribir

**What**: Al agregar `prettier --check "**/*.md"` al CI, hay que verificar primero dos familias de archivos antes de correr `--write`: los **tool-managed** (se regeneran, cualquier formato se pierde al regenerar) y los **append-only** (historia inmutable, no se tocan). En este repo son `vault/engram/` y `vault/02_Bitacora/bitacora.md`. `.prettierignore` es la herramienta que resuelve ambas.

**Why**: Sin esa verificacion previa, el `--write` global habria reescrito 61 archivos de `vault/engram/` (que `pnpm vault:export` regenera en el siguiente export, deshaciendo el formato) y la bitacora, que es append-only por regla del proyecto.

**Where**: `.prettierignore`, `package.json` (`format:check`), `.github/workflows/ci.yml`. Worktree `~/.paseo/worktrees/0q5zj3gn/prettier-mitigation`, rama `chore/prettier-mitigation`.

**Learned**: (1) `vault/engram/` tiene el mismoEstilo de problema que las migraciones: un directorio que se regenera y que no debe editarse a mano (ver la regla equivalente en AGENTS.md sobre `packages/db/migrations/meta/`). (2) La bitacora tiene un criterio especial: si alguna vez se decide formatearla, hay que hacerlo con excepcion documentada, no como parte de un write global. (3) Verificar siempre el resultado: `git diff --stat -- vault/02_Bitacora/bitacora.md` debe dar vacio tras el write, y `git status --short vault/engram/` sin cambios.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
