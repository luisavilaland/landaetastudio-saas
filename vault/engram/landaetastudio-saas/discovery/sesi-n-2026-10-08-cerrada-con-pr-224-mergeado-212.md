---
id: 212
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 18:16:26"
updated_at: "2026-10-08 18:16:26"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Sesión 2026-10-08 cerrada con PR #224 mergeado"
---

# Sesión 2026-10-08 cerrada con PR #224 mergeado

**What**: Sesión 2026-10-08 cerrada. PRs #222, #223 y #224 mergeados a develop (8c0879d). Items 69, 70, 71, 73 y 75 RESUELTOS. Items 76, 77 y 78 ABIERTOS.

**Why**: Cierre formal de la sesión con cleanup de los tres registros (worktree, rama, workspace de Paseo) verificado con Paso cero.

**Where**: develop en 8c0879d. 738 tests. AGENTS.md (seccion "Cleanup de worktree post-merge" con Paso cero). vault/03_Deuda/deuda-tecnica.md (items 73-78). PR #224.

**Learned**:
(1) **Tercera vez HOY que PowerShell contamino una medicion de encoding.** `git show origin/develop:<path> > $env:TEMP\f.md` decodifica a string ANTES de escribir: reporto 68 U+FFFD y "bytes invalidos offset 968" sobre un blob que estaba limpio. La lectura correcta es `child_process.execFileSync('git', ['cat-file','blob', ...])` desde Node, que devuelve Buffer crudo. El blob real: 3229 bytes, 0 U+FFFD, identico al worktree. Las pipes de PowerShell a herramientas nativas son UTF-8 en theory y cp1252 en la practica.

(2) **`gh pr merge --delete-branch` dejo worktree hufrfano otra vez**: desregistro el worktree de git pero dejo 425 MB en disco (node_modules del install real). `git worktree remove` responde "is not a working tree". Hay que borrarlo a mano y despues `git worktree prune`.

(3) **El Paso cero (item 73) shooto en los tres registros**: el worktree de git NO existia (ya desregistrado), la rama local SI existia, y el workspace de Paseo SI existia degradado a `kind: directory` apuntando al path borrado. Sin el Paso cero se habrianintentado tres limpiezas sobre objetivos ya inexistentes. Ademas habia un segundo workspace del mismo proyecto (wks_b14ea16d10d416b5 = la sesion principal): el Paso cero permitio distinguirlo del objetivo y no archivar la sesion activa.

(4) **`vault/engram/` excluido de check:encoding es un punto ciego real**: los 6 mojiChars (0xC3 0xB1) del obs 207YKdetenidO sin que el check los reportara, porque la exportacion es tool-managed. El detector no cubre los archivos que el genera.

(5) Los tests de DB contra Neon son intermitentes (item 78): 14/14 en 11.65s contra un limite de 15s. No es regresion; no lo trates como una.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
