---
id: 51
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f20ddf8a1ffesfAhaZ9dkSurj5
created_at: "2026-09-26 19:23:07"
updated_at: "2026-09-26 19:23:07"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Mapeo command/skill SDD verificado para AGENTS.md (PR D)"
---

# Mapeo command/skill SDD verificado para AGENTS.md (PR D)

**What**: Documenté en AGENTS.md (PR D) el workflow SDD, Judgment Day y Review Agents de gentle-ai, tras verificar el mapeo real command↔skill en disco.
**Why**: El orquestador pidió documentar (no instalar) estos workflows; sus datos de control tenían 2 discrepancias que debían reportarse.
**Where**: AGENTS.md (worktree .paseo/worktrees/0q5zj3gn/sdd-integration, rama chore/sdd-integration), 3 secciones nuevas al final del archivo: "SDD Workflow (Spec-Driven Development)", "Judgment Day (revisión adversarial)", "Review Agents".
**Learned**:
- 11 commands sdd-* en ~/.config/opencode/commands/ (apply, archive, continue, explore, ff, init, new, onboard, research, status, verify) + 11 skills sdd-* en ~/.config/opencode/skills/. Meta-commands sin skill: continue, ff, new, status. Skills sin command: design, propose, spec, tasks.
- DISCREPACIA 1: /sdd-ff NO es "apply+verify+archive": su description real es "Fast-forward all SDD planning phases — proposal through tasks" (propose → spec → design → tasks).
- DISCREPACIA 2: /sdd-new NO incluye init: description "runs exploration then creates a proposal" (explore + propose).
- El flujo "7 pasos" no puede escribirse con /sdd-propose, /sdd-spec, /sdd-design, /sdd-tasks: esos 4 no tienen command (son justo los "4 skills sin command"); se documentaron como fases sin command propio.
- Verificado en disco: no existen openspec/, .sdd/, changes/ (SDD sin inicializar); no existen ~/.config/opencode/agent/ ni agents/ (review agents los provee el runtime gentle-ai); .opencode/commands/ está sin trackear en el worktree con los 11 commands idénticos al global (hash igual).

---
*Session*: [[session-ses_f20ddf8a1ffesfAhaZ9dkSurj5]]
