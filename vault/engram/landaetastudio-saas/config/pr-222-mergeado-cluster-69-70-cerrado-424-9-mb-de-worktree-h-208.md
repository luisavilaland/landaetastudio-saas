---
id: 208
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 15:06:05"
updated_at: "2026-10-08 15:06:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 222 mergeado: cluster 69+70 cerrado, 424.9 MB de worktree huerfano borrados"
---

# PR 222 mergeado: cluster 69+70 cerrado, 424.9 MB de worktree huerfano borrados

**What**: PR #222 mergeado en develop como `bc15276` (squash, 4 commits, 15 archivos, +1184/-73). CI post-merge `completed/success`. Items 69 y 70 → **RESUELTOS**; items 73, 74 y 75 registrados y abiertos. develop quedó limpio. Cleanup de los 3 registros con paso cero: worktree (git ya lo había desvinculado pero el directorio huérfano de **424.9 MB** sobrevivió y hubo que borrarlo a mano), rama local (`Deleted branch ... was 7faeb91`) y workspace Paseo `wks_37a2cf2fe4308893` (verificado por efecto, 10→9, ya degradado a `kind: directory`).

**Why**: Cerrar el cluster de serialización de la auditoría de cierre de Fase 2 (#207). Item 69 era un bypass de creación de preapprovals con huérfano en MP; item 70 dejaba la suscripción desincronizada de MP.

**Where**: `apps/admin/app/api/subscriptions/preapproval/route.ts` (centinela `pending:<id>`, `PENDING_RESERVATION_TTL_MS` 5 min), `apps/admin/app/api/subscriptions/route.ts` (`hasPreapproval` filtra el centinela), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`eq(status, current)` + `concurrent_update`), `vault/01_ADRs/ADR-028-*.md`, `vault/03_Deuda/deuda-tecnica.md`. develop @ `bc15276`.

**Learned**: (1) **El pull falló dos veces por el patrón del PR #150 y en ambos casos había que verificar superset, no descartar a ciegas.** Primero por `deuda-tecnica.md` (mi item 73 local ya venía en el remoto: 72 headings locales, 74 en develop, ninguno ausente). Después por un obs 204 untracked que el remoto ya tenía. El diff mostró que **el obs 204 local tenía mojibake** (`existi��`, `ǧnico`) y el de develop UTF-8 limpio: la copia del worktree principal venía del export de la era PowerShell, la del worktree del PR venía del export ya corregido. Descartar local era correcto, pero solo después de demostrarlo byte a byte. (2) **Comparar archivos con PowerShell da falsos positivos de hash**: comparar dos variables nulas devuelve "idénticos: True". Los tamaños (2984 vs 3013) delataron el problema; el hash no. (3) `gh pr merge --delete-branch` volvió a omitir el borrado local por el worktree, y otra vez el directorio quedó huérfano: **quinta confirmación** de que `git worktree remove --force` desvincula el registro pero deja los ~425 MB en disco. (4) **Quinto ciclo de `dismiss_stale_reviews_on_push`**: agregar el item 75 después de la aprobación de Luis la invalidó y costó un ciclo completo de re-aprobación. La secuencia que funciona es juntar TODA la documentación antes de pedir el OK final. (5) **`gh` devuelve exit 0 aunque el borrado de rama local se omita** — siempre verificar con `gh pr view` y `git branch -a`.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
