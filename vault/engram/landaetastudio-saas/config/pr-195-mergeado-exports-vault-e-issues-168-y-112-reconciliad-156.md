---
id: 156
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 01:28:36"
updated_at: "2026-10-05 01:28:36"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR #195 mergeado (exports vault) e issues #168 y #112 reconciliados"
---

# PR #195 mergeado (exports vault) e issues #168 y #112 reconciliados

**What**: Export de vault/engram commiteado y mergeado antes de la auditoria mid-phase de Fase 2. PR #195, squash `260bb39`, 7 archivos (237 lineas). Tambien se reconciliaron los issues #168 (T4) y #112 (T12 Fase 1), que estaban OPEN pese a estar mergeados.

**Why**: El working tree con 7 untracked bloqueaba el checklist de inicio de la auditoria. El usuario eligio PR propio para los exports (atomicidad) en vez de mezclarlos con el informe de auditoria.

**Where**: `vault/engram/**`, PR #195. Sin codigo de produccion.

**Learned**:
- **La causa del drift de #168 no fueolvido: fue cableado.** El PR #189 se mergeo con commit `19b3dcd` pero su body NO lleva `Closes #168`, asi que GitHub nunca iba a cerrarlo. Un PR sin esa linea produce drift garantizado, por muy revisado que este.
- **#112 ya tenia DOS comentarios de "cierre parcial" identicos** (2026-09-24). La regla "si el comentario de cierre ya existe, no duplicar" aplico: se cerro en silencio. El texto que el usuario proposedera un tercero identico.
- **GGA v2.10.1 NO cubre markdown.** Sus `File patterns` son `*.ts,*.tsx,*.js,*.jsx,*.sql` y sus `Exclude patterns` incluyen `vault/*`. Al commitear solo markdown reports `No matching files staged for commit` y pasa. Eso explica por que el item 52 (BEL/VT inyectados en archivos `.ts`) no lo agarro el hook en su momento.
- **`gh issue close` NO soporta `--comment-file`** (si `gh pr close`). Hay que leer el archivo con `Get-Content -Raw -Encoding UTF8` y pasarlo como `--comment $content`.
- **CI de este repo tarda 19-28 min.** `updatedAt` del run no se mueve durante `in_progress`, lo que hace parecer que esta colgado. No lo esta: hay que patiently pollear. Un PR con solo markdown igual dispara los 3 contexts de Vercel y el build completo.
- `reviewDecision` paso de REVIEW_REQUIRED a APPROVED solo, con Vercel ya en verde: la aprobacion llego por la UI de GitHub, no por `gh`.
- Mapa de merge verificado de Fase 2: T0 -> #178 (spike) + #188 (resultados) · T1 -> #184 · T2 -> #185 · T3 -> #186 · T4 -> #189 (`19b3dcd`) · T5 -> #193 (`fdea784`). El #188 es el que confirma H1, no el #178.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
