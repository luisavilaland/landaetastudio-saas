---
id: 309
type: discovery
project: landaetastudio-saas
scope: project
topic_key: audit/s4c-permissions
session_id: ses_ec43b8525ffe95eHRlsrM2O0hw
created_at: "2026-10-14 19:23:44"
updated_at: "2026-10-14 19:23:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría S4c permisos: 16/16 guards property, 5 hallazgos"
---

# Auditoría S4c permisos: 16/16 guards property, 5 hallazgos

**What**: Auditoría QA completa del property de permisos del slice S4c (PR #260) — 16 guards, con evidencia por mutación (B1-B4) en el worktree audit/s4c.

**Why**: Verificación independiente de que los guards de permisos implementados en S4c funcionan y de que los deny tests cubren cada call site.

**Where**: apps/admin/lib/permission-guard.ts, apps/storefront/lib/permission-guard.ts, 13 route files con guards (líneas: products POST L71; categories POST L42; categories/[id] PUT L67+DELETE L178; orders/[id] PUT L160; import POST L73; products/[id] PUT L123+DELETE L639; variants POST L82; images POST L78; imageId DELETE L28; shipping POST L42; shipping/[id] PUT L66+DELETE L142; checkout POST L85; preference POST L106), packages/commerce/src/subscription-permissions.ts (L118 PERMISSIONS_BY_STATUS, L244 TENANT_STATUS_OVERRIDE, L290-331 derive*).

**Learned**:
- RESULTADO: 16/16 guards property confirmados por mutación. B1 (comentar guard): los 7 con deny test fallan (10 tests). B2 (comentar los 9 sin deny test): 6 sites pasan sin detección, 3 (import/images/imageId) fallan con 500 por acoplamiento posicional callCount en tests (mock queue), NO aserción 403. B3a (always-deny lib admin): 44/45 tests reciben 403 real en los 9 sites admin (1 anomalía 500 por contaminación cross-test bajo mutación, confirmada como artefacto al correr aislado). B4 (always-allow ambas libs): EXACTAMENTE los 9 deny tests fallan, 71 demás pasan.
- HALLAZGOS: (1) 9/16 call sites sin deny test — si alguien borra el guard, CI no lo detecta (6 silenciosos + 3 con 500 accidental). (2) shipping/__tests__/[id].test.ts es test muñeco: define handlers locales, nunca importa la ruta real. (3) shipping/[id] route.test.ts: comentario "el guard consulta el tenantId" sin ningún assertion 403 (copy-paste aspiracional). (4) item 4 CONFIRMADO runtime: derivePermissions('constructor'|'toString'|'__proto__') NO throw (retorna Function/Object.prototype) — prototype-key bypass del fail-loud documentado; DB text sin CHECK constraint; guard resulta fail-closed (403) porque Function.canWrite=undefined, sin escalación de privilegio observada. (5) subscriptions/* (5 endpoints) y config/* (3 endpoints) usan auth() + requireTenantId() sin denyIfNoPermission — preexistentes fuera del scope de S4c. Webhooks por firma HMAC, cart anónimo por cookie, register público: by design.
- Worktree audit/s4c: TODAS las mutaciones revertidas, git status limpio, 16/16 guards activos, suite completa 921/921, typecheck 9/9 (previo).

---
*Session*: [[session-ses_ec43b8525ffe95eHRlsrM2O0hw]]
*Topic*: [[topic-audit]]
