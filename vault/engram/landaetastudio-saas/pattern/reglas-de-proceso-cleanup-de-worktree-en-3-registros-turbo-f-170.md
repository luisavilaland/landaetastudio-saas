---
id: 170
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 15:36:54"
updated_at: "2026-10-06 15:37:06"
revision_count: 2
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Reglas de proceso: cleanup de worktree en 3 registros, turbo --force, y globs de PowerShell"
---

# Reglas de proceso: cleanup de worktree en 3 registros, turbo --force, y globs de PowerShell

**What**: Tres reglas de proceso que costaron tiempo o casi produjeron un informe incorrecto en el PR de H1.

**Why**: Ninguna estaba en el checklist, y las tres son baratas de aplicar una vez que se conocen. La primera es una reincidencia: el item 40 regla 6 ya documentaba el problema con here-strings de PowerShell.

**Where**: `AGENTS.md` (secciones de worktrees de Paseo), `vault/02_Bitacora/bitacora.md`, scripts de busqueda y comandos de DoD.

**Learned**:
1. **Cleanup de worktree post-merge = TRES registros, tres APIs.** Un worktree de Paseo deja (a) worktree de git, (b) rama local, (c) workspace de Paseo. `gh pr merge --delete-branch` limpia (a) y (b), y **falla** con `Directory not empty` si el worktree tiene el `node_modules` del install real (PR #197 y #198). Y el registro de Paseo sobrevive al worktree: cuando este desaparece, Paseo **degrada** el workspace de `isolation: worktree` a `isolation: local`/`kind: directory` y lo deja apuntando a un path inexistente. Por eso verificar solo con `git worktree list` dio un cleanup incompleto: hay que pasar tambien por `paseo_list_workspaces`. Consecuencia directa de "no usar junctions": todo worktree con install real bloquea el borrado de la rama.
2. **`turbo` reporta cache, y un pass con cache no es evidencia.** `pnpm lint` dio verde con `5 cached, 6 total`; con `--force` dio `0 cached` y verde tambien. En esta sesion un cache ya habia generado un falso positivo (typecheck 0/9 con junction). Para el DoD de un candidato, `lint`, `typecheck` y `build` van con `--force`.
3. **Verificar los hits de una busqueda antes de reportarlos.** Un glob de PowerShell con `**` **no es recursivo**: dio "cero hallazgos" cuando habia uno. Y un grep de regex de una linea tampoco matchea codigo con la cadena partida en lineas (`db` en una linea, `.select(` en la siguiente), que es exactamente como estaba escrito el bug H1. Para eso hace falta `db\s*\.\s*select\(` sobre el archivo completo.

Ademas, dos trampas de PowerShell 5.1 en este entorno: `Get-Content -Raw` no existe (usar `[System.IO.File]::ReadAllText`), y un array de strings multilinea con backticks rompe el parseo de forma que el error aparece decenas de lineas despues. Para markdown, usar siempre la herramienta de edicion con un ancla, nunca PowerShell.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
