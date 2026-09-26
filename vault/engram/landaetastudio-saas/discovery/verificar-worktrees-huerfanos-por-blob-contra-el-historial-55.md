---
id: 55
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/orphan-worktree-blob-verification
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 21:12:32"
updated_at: "2026-09-26 21:12:32"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Verificar worktrees huerfanos por blob contra el historial"
---

# Verificar worktrees huerfanos por blob contra el historial

**What**: Para demostrar que un directorio huerfano (worktree desregistrado) no contiene trabajo perdido, el metodo riguroso es calcular el blob de cada archivo con `git hash-object` y comprobar si ese hash existe en el conjunto de objetos alcanzables desde `develop` (`git rev-list --objects develop` -> HashSet). Si el blob esta, el contenido esta preservado en el historial, aunque el archivo haya cambiado despues.

**Why**: Un worktree sin `.git` no admite `git status`, y comparar con `git diff` contra develop no sirve cuando hubo squash merges (el arbol de la branch jamas es ancestro de develop). En el PR #146 / limpieza de worktrees, `git diff --quiet` daba "identicos" para una branch ya mergeada, pero no dice nada sobre un directorio suelto.

**Where**: Limpieza de los 10 worktrees bajo `~/.paseo/worktrees/0q5zj3gn/` (skills-complete, feature-fase1-t8-t10-seed, chore-audit-fase1, chore-close-fase1, chore-docs-process-v2, chore-fase1-migration-0013, chore-fase1-t5-migration, docs-toolkit-consolidation, reset-migrations-baseline, sdd-integration).

**Learned**: (1) El test encontro 101 archivos en `skills-complete` y 21 en `feature-fase1-t8-t10-seed`, con 0 blobs fuera del historial salvo 2 caches gitignorados (`.obsidian/graph.json`, `engram/.engram-sync-state.json`). (2) Un hallazgo colateral importante: ninguno de los dos worktrees grandes era un checkout completo (sin `apps/`, `packages/` con 5 archivos). Eran restos parciales de limpiezas fallidas, o sea habia MENOS contenido, nunca mas. (3) Ojo con `.gitattributes` / `core.autocrlf`: el test compara contenido, no bytes en disco.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
