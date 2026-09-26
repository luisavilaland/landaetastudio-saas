---
id: 48
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/paseo-worktree-cleanup-lock
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 18:29:57"
updated_at: "2026-09-26 18:29:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Worktree de Paseo: el CWD de los subagentes bloquea el borrado"
---

# Worktree de Paseo: el CWD de los subagentes bloquea el borrado

**What**: Al limpiar el worktree de Paseo del PR #146, `git worktree remove` fallo con exit 255 "Directory not empty" porque `node_modules` estaba presente. `git worktree prune` si removio el registro (quedo solo el worktree principal), pero el directorio fisico de 444 MB SIGUIO en disco. `Remove-Item -Recurse -Force` tambien fallo con "el proceso no puede obtener acceso... esta siendo utilizado en otro proceso".

**Why**: Los shells de los subagentes (`cmd.exe` + `conhost`, PIDs 23196/7148/25152, creados 12:52-12:53 PM local = 16:52-16:53 UTC, justo cuando se spawearon A/B/C) tienen el worktree como **directorio de trabajo actual**. En Windows, un proceso con CWD dentro de un directorio impide que ese directorio se borre, aunque su contenido sea borrable. Los agentes figuraban `status: closed` y `archivedAt` set, pero mantenian el label `paseo.open-agent-tab.<cid>: true` (tab de agentes abierta en el cliente).

**Where**: `C:\Users\exodo\.paseo\worktrees\<hash>\<slug>/` (los worktrees de Paseo viven en `~/.paseo/worktrees/`, FUERA del repo).

**Learned**: (1) Diagnostico que funciona: borrar el CONTENIDO primero (funciona, libera el 100% del espacio) y despues intentar el directorio (falla). Esa diferencia aisla el lock en el handle del CWD y descarta archivos en uso. (2) No existe un equivalente de "forzar": hay que cerrar la tab de agentes en el cliente o matar los procesos, y ambas son acciones sobre el entorno del humano. (3) `paseo_archive_workspace` devuelve `removedDirectory: false`: archiva los agentes, NO borra disco. (4) Secuencia que funciona al completar: `git worktree remove <path>` -> si falla por "Directory not empty", `git worktree prune` + vaciar el contenido a mano -> el directorio vacio queda pendiente hasta cerrar la tab. (5) Esto aplica a TODOS los worktrees de Paseo, no es un incidente de este PR: el cleanup nunca es automatico.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
