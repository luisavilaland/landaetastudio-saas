---
id: 266
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/verificar-state-antes-de-mergear
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 13:45:19"
updated_at: "2026-10-09 13:52:05"
revision_count: 2
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Baseline limpio para SDD: el check de drift compara contra el HEAD equivocado"
---

# Baseline limpio para SDD: el check de drift compara contra el HEAD equivocado

**What**: PR #237 mergeado (`f093d78`). develop limpio con los tres squashes del item 61: `e7d3f67` (#235), `ebd46e1` (#236), `f093d78` (#237). 0 PRs abiertos, 0 issues abiertos, 759/759 tests, 72/72 files, working tree limpio. Baseline listo para arrancar el SDD.

**Why**: Cierre de la cadena documental del item 61 y punto de partida del trabajo siguiente.

**Where**: `develop` @ `f093d78`.

**Learned**:
- **El check de drift de los planes de merge es un falso positivo sistematico si se compara `headRefOid` contra el HEAD actual.** Despues de un cleanup el repositorio queda parado en `develop`, no en la rama del PR, asi que los dos SHAs nunca coinciden y el plan dice "DETENER" aunque no haya nada malo. **La comparacion correcta es contra el ref de la rama del PR**: `git rev-parse origin/<rama-del-pr>`. En este caso los tres gave `c90cc9f` identico: no habia drift.
- **La distincion importa porque los dos casos se ven iguales desde el plan.** #236 estaba `MERGED` (drift real, no mergear de nuevo) y #237 daba un drift aparente (repo en otra rama). En el primero habia que detenerse; en el segundo no. Sin verificar el ref de la rama, los dos se resuelven igual y uno de los dos es una equivocacion.
- **`gh pr merge --delete-branch` SI borra local y remoto** cuando se usa el flag (a diferencia del merge del #236, que se hizo desde la UI sin el flag). Verificado con `git ls-remote --heads origin <rama>` que devuelve vacio, no solo con `git branch -a`.
- **El run del #236 que quede `in_progress` en el cierre anterior termino `success`.** Dejar un run sin verificar no es un error si se reporta explicitamente como pendiente; lo que si seria reportarlo como verde.
- **Quinta confirmacion consecutiva del paso cero** (PR #221, #223, #235, #236, #237): estos PRs se hacen en el worktree principal y no dejan workspace propio. El unico workspace de `landaetastudio-saas` es la sesion activa.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
