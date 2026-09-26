---
id: 56
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/paseo-worktrees-are-partial
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 21:12:36"
updated_at: "2026-09-26 21:12:36"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Worktrees de Paseo no son checkouts completos"
---

# Worktrees de Paseo no son checkouts completos

**What**: Los worktrees de Paseo bajo `~/.paseo/worktrees/<hash>/<slug>/` NO son clones ni checkouts completos. `skills-complete` pesaba 443 MB pero no tenia `apps/` y su `packages/` solo contenia 5 archivos (de `auth`). `feature-fase1-t8-t10-seed` tampoco tenia `apps/`, `e2e/` ni `vault/`. El volumen viene casi todo de `node_modules/`.

**Why**: Se asumio que cada directorio grande era una copia usable del repo y que borrarlo podria perder trabajo. La realidad es que son restos parciales: limpiezas anteriores fallaron a mitad (por el lock de CWD documentado en otra memoria) y dejaron el arbol a medias.

**Where**: `~/.paseo/worktrees/0q5zj3gn/` — 10 directorios, 2 con contenido (883 MB) y 8 vacios. Todos huérfanos: ninguno registrado en `git worktree list` ni con `.git` propio.

**Learned**: (1) El tamano NO es senal de valor: 443 MB puede ser 101 archivos reales mas `node_modules`. Contar archivos sin `node_modules` antes de asumir que hay algo que perder. (2) La combinacion que resuelve el cleanup completo: `git worktree prune` (deregistra) + vaciar contenido (libera el espacio) + `Remove-Item` del directorio (falla si hay CWD activo) + `git diff --quiet develop <branch>` con `$LASTEXITCODE` antes de `git branch -D`. (3) Los 3 directorios vacios que quedaron bloqueados (docs-toolkit-consolidation, skills-complete, sdd-integration) siguen requiriendo cerrar la tab de agentes en Paseo.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
