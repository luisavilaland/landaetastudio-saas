---
id: 188
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 13:25:18"
updated_at: "2026-10-07 13:45:29"
revision_count: 2
tags:
  - landaetastudio-saas
  - config
aliases:
  - "turbo 2.11.7 auto-inyecta bloque agent-rules en AGENTS.md sin commitear"
---

# turbo 2.11.7 auto-inyecta bloque agent-rules en AGENTS.md sin commitear

**What**: Efecto secundario no obvio del bump de turbo 2.11.4 -> 2.11.7 (#214). Al correr `pnpm lint` / `pnpm build`, turbo detecta un agente de IA y se auto-inyecta un bloque `<!-- BEGIN:turborepo-agent-rules -->` al final de `AGENTS.md` (11 lineas). DECISION TOMADA: desactivado con `"agentGuidance": false` en el `turbo.json` raiz, y el bloque inyectado revertido con `git checkout -- AGENTS.md`. Verificado: tras correr `pnpm lint --force`, `AGENTS.md` queda limpio.
**Why**: Evitar que un bump de tooling modifique el repo sin que el PR de Dependabot lo muestre, y evitar tres fuentes de autoridad compitiendo en el mismo archivo (`AGENTS.md` ya tiene bloques gestionados de `gentle-ai`: `persona` y `engram-protocol`).
**Where**: `turbo.json` (raiz, nueva clave `agentGuidance`), `AGENTS.md` (revertido a `ddae3e0`).
**Learned**: (1) El opt-out funciona pero hay que REVERTIR el bloque existente a mano — cambiar `agentGuidance` a false "does not remove an existing block", dice el propio texto del bloque. Verificado empiricamente: con la clave en false, turbo ya no lo re-inyecta en ejecuciones forzadas. (2) La clave va en el `turbo.json` raiz,同级 con `$schema` y `globalDependencies`. (3) La causa de que `pnpm lint` pareciera "no reinyectar" fue FULL TURBO: con todo cacheado turbo ni ejecuta las tasks y la inyeccion no ocurre. Hay que `--force` para probar de verdad — mismo gotcha de obs 184 sobre cache de turbo de otro worktree.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
