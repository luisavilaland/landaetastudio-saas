---
id: 214
type: discovery
project: landaetastudio-saas
scope: project
topic_key: pattern/cleanup-paso-cero-pr-en-worktree-principal
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 18:57:00"
updated_at: "2026-10-08 18:57:00"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Cleanup de PR en worktree principal: el workspace de Paseo es la sesion"
---

# Cleanup de PR en worktree principal: el workspace de Paseo es la sesion

**What**: Merge de PR #225 (1090c85) + cleanup. El PASO CERO de los 3 registros impidió archivar la sesión en curso.

**Why**: El PR se ejecutó en el worktree PRINCIPAL, no en un worktree de Paseo. Eso hace que el cleanup de 3 registros se comporte de forma distinta a los PRs #204-#206, y el paso cero es lo único que lo detecta.

**Where**: PR #225, rama chore/arranque-2026-10-09 (local + remota), vault/engram/, worktree C:/Users/exodo/Documents/saas-ecommerce.

**Learned**:
- **Si el PR se hizo en el worktree principal, NO hay worktree que remover.** `git worktree list` muestra solo el principal y ese es el cwd de la sesión. Registro 1 = no-op. No correr `git worktree remove` sobre el principal: eso borra el repo.
- **El workspace de Paseo cuyo `cwd` es el checkout principal ES la sesión en curso** (`wks_b14ea16d10d416b5`, isolation `local`, kind `local_checkout`, title `develop`). Archivar ese id corta la conversación. Los otros 8 workspaces de `paseo_list_workspaces` son de otros proyectos: no tocar.
- `gh pr merge --squash --delete-branch` aplicó el merge, borró la rama local Y la remota (no estaba en un worktree separado, a diferencia de obs 195), y commiteó a develop. El `! warning: not possible to fast-forward to: develop` era del intento de actualizar el develop local, NO del merge. Verificar por efecto (`gh pr view --json state,mergedAt`) lo distinguió al instante.
- **Tras un squash, local develop divergió**: `5e5b4db` no es ancestro de `1090c85` aunque su contenido esté dentro. `git pull` devolvió exit 0 (hizo merge) y `git reset --hard origin/develop` dejó el historial lineal. Antes del reset, verificar contenido con `git cat-file -e origin/develop:<file>` sobre los archivos que agregó el commit huérfano: los 2 de `5e5b4db` estaban PRESENTES, así que el reset no perdió nada.
- El conflicto de untracked de `vault/engram/` que advierte obs 195 NO ocurrió: el árbol estaba limpio porque `caa0779` ya commiteaba todo.
- `tail` no existe en PowerShell 5.1: usar `Select-Object -Last N`.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
