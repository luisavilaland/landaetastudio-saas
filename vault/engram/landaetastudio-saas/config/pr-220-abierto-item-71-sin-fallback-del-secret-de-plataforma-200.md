---
id: 200
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-07 16:41:25"
updated_at: "2026-10-07 16:41:25"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 220 abierto: item 71 sin fallback del secret de plataforma"
---

# PR 220 abierto: item 71 sin fallback del secret de plataforma

**What**: PR #220 abierto (`fix/h-f2-9-platform-secret-no-fallback` → `develop`), commit `2a04052`, 7 archivos, +194/-26. Resuelve el item 71 (H-F2-9): el handler de suscripciones ya no cae a `MERCADOPAGO_WEBHOOK_SECRET`; sin `MP_PLATFORM_WEBHOOK_SECRET` devuelve 503 sin procesar el body. Test dedicado que falló primero con `expected 200 to be 503`. DoD verde en worktree con install real: lint 6/6, typecheck 9/9, build 3/3, test 705/705 (69 archivos), format:check limpio.

**Why**: Bypass cross-tenant — `MERCADOPAGO_WEBHOOK_SECRET` es el secret de órdenes de tienda (el que el tenant pega en su onboarding), así que el fallback permitía firmar webhooks de plataforma con el secret de un tenant cualquiera. Contradecía ADR-023. Decisión de Luis: sin fallback, fail-closed, 503 para que MP reintente.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (104-125), `.../__tests__/handler.test.ts`, `vault/01_ADRs/ADR-023-dos-flujos-mp.md`, `vault/03_Deuda/deuda-tecnica.md` (item 71), `vault/02_Bitacora/bitacora.md`. Worktree `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\fix-h-f2-9-platform-secret-no-fallback`, workspace `wks_55d565e07bbc0b96`.

**Learned**: (1) **GGA colgadoupa el index**: el `git commit` con hook pre-commit rebasó 120 s esperando red y, al abortarse, había **agregado al index 6 archivos ajenos** que estaban untracked (los exports de Engram de la sesión anterior). Un hook colgado no es solo "el commit no pasó": puede mutar el staging. always `git diff --cached --name-only` antes de confirmar, no confiar en el `git add` anterior. Se resolvió con `--no-verify` (AGENTS.md lo permite ante timeout de provider) documentado en el body del commit. (2) **`pnpm vault:export` escribe en el worktree donde corre**, no en el main: trajo 4 exports de la sesión anterior como untracked al worktree del PR. Para un PR de alcance chico hay que stagear los paths explícitos, nunca `git add vault/engram/` a secas. (3) El PR lleva el riesgo operativo en el body: si Preview de Vercel no tiene `MP_PLATFORM_WEBHOOK_SECRET`, el webhook da 503 ahí. Hay que confirmar antes de mergear. (4) Los 4 exports de Engram de la sesión anterior (obs 194-197, incluido el drift de README `docs/adr/`) siguen untracked en el main worktree: requieren su propio commit.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
