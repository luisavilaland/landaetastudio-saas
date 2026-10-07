---
id: 184
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 12:33:15"
updated_at: "2026-10-07 12:33:15"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Reincorporacion: DoD verde en develop c57cb27, drift de contadores 679 vs 705"
---

# Reincorporacion: DoD verde en develop c57cb27, drift de contadores 679 vs 705

**What**: Reincorporacion read-only. DoD verde en `develop` @ c57cb27: lint 6/6, typecheck 9/9, build 3/3, format:check OK, test 705/705 (69 archivos, 38s). Estructura: apps admin 87 / storefront 64 / superadmin 29 archivos ts/tsx; packages commerce 26, validation 9, db 8, auth 3. 3 migraciones (0000_baseline, 0001_dapper_revanche, 0002_resolve_tenant_by_preapproval). 15 specs e2e.
**Why**: Pedido de reincorporacion: estado de comandos, roadmap, drift doc-vs-codigo, deuda visible.
**Where**: develop @ c57cb27 (post PR #207, cierre formal Fase 2)
**Learned**: (1) `pnpm lint` y `pnpm typecheck` devuelven FULL TURBO replaying logs de OTRO worktree (`~/.paseo/worktrees/0q5zj3gn/docs-cierre-fase2`) — hay que usar `--force` para obtener evidencia real, no cacheado. (2) DRIFT CONFIRMADO: README.md:515, SETUP.md:482, TESTING.md:295/331, TESTING-MANUAL.md:225 dicen 679 tests; la realidad es 705. El DoD extendido de AGENTS.md obliga a actualizar contadores y quedo sin actualizar tras T6/T8. (3) `vault/05_Specs/brief-tecnico-fase-5.md` usa una numeracion de fases INCOMPATIBLE (dice "Fases 1-4 completas", "Fase 5: Produccion", y al final "Fase 6 completa, tag v0.9.0") contra la numeracion vigente del vault (Fase 2 = webhooks de suscripciones, cerrada 2026-10-06). Son dos日凌晨s de roadmap mezcladas en el mismo vault.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
