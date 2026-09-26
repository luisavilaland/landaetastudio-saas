---
id: 30
type: config
project: landaetastudio-saas
scope: project
topic_key: delivery/pr-143-vault-merge
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 14:01:50"
updated_at: "2026-09-26 14:01:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 143 mergeado a develop como merge commit"
---

# PR 143 mergeado a develop como merge commit

**What**: PR #143 (migración de docs al vault) mergeado a `develop` como **merge commit** `59df46f` por EdgarVz, no squash. `develop` local actualizado, branch local borrado, 0 PRs abiertos.
**Why**: Revisión de luisavilaland aprobada; el humano mergeó manualmente mientras yo esperaba CI.
**Where**: `develop` @ `59df46f` (parents `7ef9023` + `c163951`). 6 commits del branch: 551239d, b433579, 77ea187, 89553f5, 62ce12c, c163951.
**Learned**:
- **El merge fue merge commit, NO squash**, pese a que la instrucción era `gh pr merge --squash`. Parents: `7ef9023 c163951`. Por eso `git log origin/develop` muestra los 6 commits del branch listados linealmente bajo el merge.
- **El merge ocurrió con `seed` IN_PROGRESS y el job `e2e` CANCELLED** (cancelado en el run anterior). E2E nunca llegó a completarse en este branch. `reviewDecision` era APPROVED sobre `c163951`.
- **`gh pr checks` reporta `e2e fail` para un check CANCELLED** — el CLI mapea CANCELLED a "fail" y sale con exit 8. No leer eso como test rojo: hay que mirar `statusCheckRollup` con el `conclusion` real.
- Verificación post-merge: 34 `.md` en `vault/engram/`, `vault/06_Engram/` eliminada, mojibake en la bitácora = 6 = 1 residual (`â¬` L1289, decisión humana) + 5 citas intencionales en la entrada del 2026-09-26 (`Ã¡`, `â€"`, `` `Ã` ``, `` `â€` ``, `â¬`). **Cero corrupción real**: el fix aguantó el merge.
- Las 2 revisiones de luisavilaland: la primera quedó `DISMISSED` (por el push nuevo), la segunda `APPROVED` sobre `c163951`.
- Gotcha: `topic_key` en `mem_save` hace UPSERT. Reusar un key existente sobreescribe la memoria anterior. No reutilizar keys de topics distintos.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-delivery]]
