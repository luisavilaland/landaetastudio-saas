---
id: 186
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 13:13:21"
updated_at: "2026-10-07 13:13:21"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Ruleset develop: dismiss_stale_reviews_on_push invalida aprobar-varios-y-mergear"
---

# Ruleset develop: dismiss_stale_reviews_on_push invalida aprobar-varios-y-mergear

**What**: Ruleset de `develop` (id 23616561) verificado via API: required_approving_review_count=1, required_status_checks=[build], allowed_merge_methods=[merge,squash,rebase], NO hay branch protection clasica (404). El ruleset de `main` (23616380) es mas estricto: solo squash. Regla critica: `dismiss_stale_reviews_on_push: true` y `required_review_thread_resolution: true`.
**Why**: El usuariopidio aprobar y mergear los PRs de Dependabot con su propia cuenta.
**Where**: repositorio luisavilaland/landaetastudio-saas, ramas develop y main. Los 10 dependabot (#208-#217) estaban en REVIEW_REQUIRED con cero reviews.
**Learned**: (1) `dismiss_stale_reviews_on_push: true` significa que NO se pueden aprobar los 4 PRs y despues mergearlos en cadena: al mergear el primero, Dependabot rebasea los otros, ese push descarta la aprobacion y vuelven a BLOCKED. La secuencia tiene que ser atomica por PR: aprobar -> mergear -> esperar el rebase del siguiente -> aprobar -> mergear. (2) `required_review_thread_resolution` solo aplica a review comments inline; el bot de `e2e.yml:159-192` postea issue comments, que no bloquean. (3) Dependabot es el autor de los PR, asi que el owner SI puede aprobarlos (GitHub solo bloquea auto-aprobacion cuando autor==aprobador). (4) En PowerShell 5.1, `gh api --jq '...->...'` rompe el parseo por el `->`, y `>` en redirecciones escribe UTF-16 que `require()` no parsea: hay que pasar el JSON por stdin a node.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
