---
id: 49
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/verify-lists-before-documenting
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 19:12:39"
updated_at: "2026-09-26 19:12:39"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Verificar listas de herramientas contra disco antes de documentar"
---

# Verificar listas de herramientas contra disco antes de documentar

**What**: Al armar el plan del PR D (documentar SDD + judgment-day + review agents), tres datos del plan fallaron la verificacion contra disco y runtime:
1. La lista de comandos SDD de SETUP.md decia "11" pero enumeraba 14, y 4 de esos 14 (propose, spec, design, tasks) NO son commands sino skills sin command. Ademas omitia `sdd-onboard`, que si es command. El numero real: 11 commands (apply, archive, continue, explore, ff, init, new, onboard, research, status, verify) y 11 skills (apply, archive, design, explore, init, onboard, propose, research, spec, tasks, verify). Los 4 meta-commands sin skill son continue, ff, new, status.
2. El plan listaba `review-refactor` entre los review agents: ese agente NO existe. Los reales son 6 (review-readability, review-reliability, review-resilience, review-risk, review-refuter, review-validator) + 3 de judgment-day (jd-judge-a, jd-judge-b, jd-fix-agent) = 9, no 10.
3. "Los review agents no estan versionados en el repo" era impreciso: NO estan en disco. No existe `~/.config/opencode/agent/` ni `agents/`. Recursiva sobre `.config/opencode` solo devuelve `skills/_shared/review-ledger-contract.md` y `-pi.md`. Son inyectados por el runtime de gentle-ai.

**Why**: El plan venia de memoria/contexto de sesiones previas, y las tres afirmaciones eran plausibles pero wrong. El PR D existe justamente para documentar el toolkit con precision, asi que documentar estas tres cosas mal habria introducido el mismo error que el PR aims a corregir.

**Where**: `C:\Users\exodo\.config\opencode\commands\`, `C:\Users\exodo\.config\opencode\skills\`, runtime de agentes.

**Learned**: (1) Regla general: no construir listas de herramientas a partir de memoria ni del contexto de sesiones. Enumerar contra disco (`Get-ChildItem -Filter`) y contra runtime antes de escribir una sola linea. (2) "No esta en el repo" y "no esta en disco" son afirmaciones distintas y hay que decir la correcta: los review agents son runtime-only, ni siquiera estan en la config del usuario. (3) Un conteo y su enumeracion deben coincidir; cuando el plan dice 11 y lista 14, el numero es el que hay que verificar. (4) `gentle-ai install --preset full-gentleman --dry-run` es la forma segura de confirmar que un preset existe y que componentes incluye (incluye `sdd`) sin instalar nada.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
