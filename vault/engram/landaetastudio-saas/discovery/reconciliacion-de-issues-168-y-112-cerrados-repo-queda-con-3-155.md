---
id: 155
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 00:43:30"
updated_at: "2026-10-05 00:43:30"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Reconciliacion de issues: #168 y #112 cerrados, repo queda con 3 issues open (T6-T8)"
---

# Reconciliacion de issues: #168 y #112 cerrados, repo queda con 3 issues open (T6-T8)

**What**: Reconciliacion del estado de issues de GitHub contra el estado real de merge en `develop` (HEAD `d0ffd8a`). Resultado: solo #168 (T4) y #112 (T12 Fase 1) estaban desalineados. #168 cerrado con nota de scope; #112 cerrado SIN comentario nuevo. Repo queda con exactamente 3 issues open: #170, #171, #172 (T6/T7/T8).

**Why**: El humano pidio limpiar el drift antes de una auditoria mid-phase, porque el estado de los issues no reflectia que T0-T5 ya estan mergeadas.

**Where**: GitHub `luisavilaland/landaetastudio-saas`. Issues #168, #112. Sin cambios de archivos.

**Learned**:
- **PR #189 (T4) mergeado pero su body no lleva `Closes #168`**, por eso el issue quedo abierto 3 dias despues del merge. La causa del drift no fueolvido: fue que el PR nunca estuvo cableado para cerrar su issue. Moraleja: un PR que no declara `Closes #n` produce drift garantizado.
- **PR #189 se mergeo con `reviewDecision: REVIEW_REQUIRED` y el propio body dice "No mergear sin review de Luis"** — se mergeo igual. No es un problema de este reconcile, pero queda dicho.
- **#112 ya tenia DOS comentarios de "cierre parcial"** (2026-09-24, mismo texto casi literal). La regla "si el comentario de cierre ya existe, no duplicar" aplico: se cerro en silencio. Agregar un tercero habria sido puro ruido.
- **El issue #168 pide "5 endpoints" pero el entregable son 6**: el spike T0 demostro que `cancelled -> authorized` da 400 en MP, asi que `reactivate` salio y entraron `pause`+`resume`. El titulo del issue quedo stale; el comentario de cierre lo documenta explicitamente para que el registro no mienta.
- **Tooling**: `gh issue close` NO soporta `--comment-file` (si `gh issue comment`). Hay que leer el archivo con `Get-Content -Raw -Encoding UTF8` y pasarlo como `--comment $content`. `gh pr close` si lo soporta. Version: gh 2.101.0.

**Mapa de merge verificado de Fase 2** (correcto, para no volver a adivinar):
T0 -> #178 (spike) + #188 (resultados finales) · T1 -> #184 · T2 -> #185 · T3 -> #186 · T4 -> #189 (`19b3dcd`) · T5 -> #193 (`fdea784`).

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
