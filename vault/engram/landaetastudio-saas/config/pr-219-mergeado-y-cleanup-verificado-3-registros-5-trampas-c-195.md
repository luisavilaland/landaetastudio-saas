---
id: 195
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9301c36ffe7N3adq6c5qZH2y
created_at: "2026-10-07 15:49:36"
updated_at: "2026-10-07 15:49:36"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 219 mergeado y cleanup verificado: 3 registros, 5 trampas confirmadas"
---

# PR 219 mergeado y cleanup verificado: 3 registros, 5 trampas confirmadas

**What**: PR #219 mergeado a `develop` como `7342f3d4` (squash, 2026-10-07 15:45:53Z), aprobado sin condiciones por Luis. Cleanup verificado por los 3 registros. `develop` limpio en `7342f3d4`. 0 PRs abiertos, 0 issues abiertos. CI post-merge `completed`/`success` en 2m20s. Tests 705/705 en 69 archivos (17.50s).

**Why**: Cerrar el PR de saneamiento documental y dejar el repo en estado operable para la siguiente tarea.

**Where**: Rama `docs/saneamiento-post-fase2` eliminada (local y remota). Worktree `~/.paseo/worktrees/0q5zj3gn/docs-saneamiento-post-fase2` borrado. `develop` en `C:/Users/exodo/Documents/saas-ecommerce`.

**Learned**: (1) **`gh pr merge --delete-branch` omite el borrado LOCAL si la rama está checked out en un worktree.** Responde con exit 0 y el mensaje "! Branch ... is checked out in the current worktree; skipping local delete". El merge aplica y la rama remota sí se borra; la local queda y hay que borrarla a mano después de remover el worktree. Un exit 0 acá no significa "cleanup hecho". (2) **`git worktree remove --force` falla con "Directory not empty" (exit 255) cuando el worktree tiene el `node_modules` del `pnpm install` real**, que es el requisito del DoD. Borrado manual con `Remove-Item -Recurse -Force` + `git worktree prune`. Es el modo de falla que AGENTS.md ya anticipa, confirmado de nuevo. (3) **Paseo eliminó el workspace solo al borrarse el directorio**, en vez de degradarlo a entrada colgada como documenta AGENTS.md. El conteo bajó de 10 a 9 sin Intervention: no hizo falta `paseo_archive_workspace`. Verificar por efecto evitó archivar un workspace inexistente. (4) **Comparar contenido entre worktrees con PowerShell corrompe UTF-8**: `git cat-file blob | Out-String` convirtió `único` en `├║nico` y报告 33 líneas de diferencia falsas en un archivo idéntico. El método correcto es nativo de git: `git add -N` + `git diff origin/develop -- <files>` (compara working tree contra remoto) o `git diff --no-index` con archivos escritos en UTF-8 sin `Out-String`. Ojo también: `git diff --cached origin/develop` compara el ÍNDICE, no el working tree, y da un veredicto distinto. (5) Al sincronizar `develop` tras el merge, los untracked de `vault/engram/` bloquean el pull porque el PR ya los trae. El remoto era superset estricto (4 archivos idénticos + 1 con una línea extra: el link a obs-193). Se resolvió con `git checkout origin/develop -- <archivo modificado>` en vez de descartar la edición local, que preserva el contenido por construcción.

---
*Session*: [[session-ses_ee9301c36ffe7N3adq6c5qZH2y]]
