---
id: 68
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:24"
updated_at: "2026-09-26 22:04:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "--diff-filter=MD excluye agregados por diseño: verificar el filtro antes de escribir el test"
---

# --diff-filter=MD excluye agregados por diseño: verificar el filtro antes de escribir el test

**What**: El test 4.4 del plan de auditoría esperaba que un archivo NUEVO en el archive hiciera fallar el guard. No falla — y no es un bug. El guard usa `git diff --diff-filter=MD`, que excluye `A` (Added) por diseño.

**Why**: En `scripts/check-migrations.sh` los archivos nuevos deben poder agregarse (las migraciones nuevas son el flujo normal). Un `UPDATE` sin filas tampoco falla, que es un caso distinto con el mismo modo de fallo: el silencio.

**Where**: `scripts/check-migrations.sh` (comentario de header, punto 1)

**Learned**:
- Verificado en las dos variantes: archivo untracked y archivo trackeado con `git add`. **Ambos pasan** (exit 0).
- La lección es del método, no del script: **antes de escribir un test que espera un resultado, leer el filtro que lo produce.** El plan daba por hecho un comportamiento que el código contradecía.
- Un test que pasa cuando se esperaba que fallara NO es un resultado parcial: es evidencia de que la premisa del test estaba mal. Reportarlo, no ajustarlo en silencio ni "arreglar" el código para que el test pase.
- Corolario: el criterio 2 del item 2 (`.sql` nuevo → pasa) es explícito. Cualquier endurecimiento futuro del archive (rechazar agregados) sería una decisión de producto que contradice ese criterio, no una corrección de bug.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
