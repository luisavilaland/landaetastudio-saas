---
id: 53
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/sdd-command-vs-phase
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 19:29:23"
updated_at: "2026-09-26 19:29:23"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "SDD: 4 de 7 fases no son slash commands"
---

# SDD: 4 de 7 fases no son slash commands

**What**: Al integrar el PR D (documentar SDD + judgment-day + review agents), el subagente QA cumplio el paso de "investigar antes de documentar" y encontro 3 errores que mi propia verificacion previa habia aprobado:
1. `/sdd-propose`, `/sdd-spec`, `/sdd-design` y `/sdd-tasks` NO existen como slash commands. Son fases (skills) que lanza el orquestador y que `/sdd-ff` encadena. El flujo de 7 pasos que pase al subagente los listaba como commands.
2. `/sdd-ff` NO es "apply + verify + archive" (como decia el plan): es fast-forward del planning (propose → spec → design → tasks).
3. `/sdd-new` NO incluye `init`: es explore + propose.

Ademas, el subagente Disenador escribio `/sdd-tareas` (nombre traducido al espanol, inexistente) y los mismos 4 commands inexistentes en `docs/WORKFLOW.md`. Ambos corregidos por el orquestador.

**Why**: Verificar que un archivo EXISTE es necesario pero no suficiente. Yo habia enumerado las 11 skills y los 11 commands contra disco (correcto) pero tome las FUNCIONES de los 4 meta-commands del plan sin leer su frontmatter. El paso de investigacion previa a documentar fue lo que atrapo el resto.

**Where**: `AGENTS.md` (3 secciones nuevas), `PROMPTS.md` (2 subsections), `SETUP.md`, `README.md`, `docs/WORKFLOW.md`, `.opencode/commands/` (11 archivos nuevos), `opencode.json`. PR #148, commit `180628f`.

**Learned**: (1) Al documentar una herramienta, leer el frontmatter/description de CADA artefacto, no deducir la funcion del nombre ni del contexto de sesiones previas. Un nombre como `sdd-ff` no dice si acceleratea planning o si completa el ciclo. (2) El paso "investigar antes de documentar" NO es opcional: se lanzo como A1 obligatorio y pago con 3 hallazgos que mi verificacion previa no vio. Delegar la verificacion en el subagente que documenta es mas efectivo que verificarla y pasarle el resultado. (3) Big Pickle NO se trabo: edits numeradas ("EDIT 1 —") + paths absolutos funcionaron a la primera, validando el formato del PR C. (4) `allow_once` en permisos de `external_directory` causa un prompt POR ARCHIVO (11 pedidos). Usar `allow_always` cuando el acceso es de solo lectura y a un directorio estable.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
