---
id: 43
type: pattern
project: landaetastudio-saas
scope: project
topic_key: workflow/pr-c-toolkit-consolidation
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 17:06:03"
updated_at: "2026-09-26 17:06:03"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "PR C: consolidación del toolkit + mecanismos de uso"
---

# PR C: consolidación del toolkit + mecanismos de uso

**What**: Se creo el workspace de Paseo `wks_bc61571b1522db8e` (worktree en `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\docs-toolkit-consolidation`, rama `chore/docs-toolkit-consolidation` desde `develop` @ f962116) y se ejecuto el PR C con 3 subagentes en paralelo de scopes disjuntos: QA/Auditor (MiMo, AGENTS.md), Programador (Big Pickle, PROMPTS.md) y Disenador (Ling, SETUP.md + README.md + vault/README.md + docs/WORKFLOW.md). El orquestador integro desde el mismo worktree usando `workdir`.
**Why**: Consolidar la documentacion de las 7 herramientas del toolkit y agregar mecanismos (reglas + checklists) que fuercen el uso proactivo, despues de que Engram se usara solo retroactivamente en el PR B.
**Where**: AGENTS.md, PROMPTS.md, SETUP.md, README.md, vault/README.md, docs/WORKFLOW.md (nuevo), vault/02_Bitacora/bitacora.md, vault/03_Deuda/deuda-tecnica.md. Commit `fb47535`, branch `chore/docs-toolkit-consolidation` pusheada.
**Learned**: (1) `paseo_create_agent` NO acepta el key `background` (rechaza la llamada); para despacho paralelo hay que emitir las 3 llamadas en un mismo bloque de tools y usar `notifyOnFinish: true`. (2) Los worktrees de Paseo se crean en `~/.paseo/worktrees/<hash>/<slug>`, FUERA del repositorio: `pnpm install` corre bien pero `node_modules` no se comparte con el main worktree y una ruta relativa `../` NO alcanza el worktree principal (hay que resolverlo con `git worktree list`). (3) `check-migrations.sh` necesita el bash de Git (`C:\Program Files\Git\bin\bash.exe`); `bash` en PATH apunta a WSL, que no esta instalado. (4) `pnpm lint` = `turbo run lint` = solo eslint por paquete: NO corre prettier sobre markdown, y AGENTS.md/ PROMPTS.md / SETUP.md / README.md ya fallan `prettier --check` en `develop` (preexistente, verificado contra origin/develop). No correr `prettier --write` sobre ellos: reformatea el documento entero y ensucia el PR. (5) `gh` (GitHub CLI) no esta instalado en la maquina y el MCP de GitHub responde "Bad credentials": la creacion del PR quedo pendiente del humano.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-workflow]]
