---
id: 134
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:35:43"
updated_at: "2026-10-03 22:35:43"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Estado paused anadido a derivePermissions"
---

# Estado paused anadido a derivePermissions

**What**: Se agrego el estado `paused` a `derivePermissions`, con `canPause` (solo desde `active`) y `canResume` (solo desde `paused`).

**Why**: El transversal `2026-09-subscription-lifecycle.md` lista 6 estados y NO incluye `paused`. Se agrego al codigo porque: (1) MP lo expone y la transicion funciona en ambas direcciones (verificado 2026-10-03); (2) la doc oficial de MP confirma que `paused` detiene el cobro; (3) `cancel` es TERMINAL en MP (400 a `cancelled -> authorized`), asi que `paused` es el unico camino reversible y sin el el tenant no tiene forma de volver.

**Where**: `packages/commerce/src/subscription-permissions.ts`, `packages/commerce/src/__tests__/subscription-permissions.test.ts`

**Learned**:
- La matriz real queda en **7 estados x 8 permisos**, no 6x6 como decia el prompt original.
- `paused` NO es `past_due`: `past_due` es impago (gracia de 7 dias); `paused` es suspension voluntaria del tenant.
- Se eligio `canAccessPanel: 'limited'` (no `'readonly'`) porque el tenant pausado tiene una accion util: `resume`. Conserva storefront: lo que se suspende es el cobro, no el servicio.
- **DEUDA**: el transversal sigue diciendo 6 estados. Hay que agregar `paused` a sus secciones 1 y 2 en el PR transversal. Marcado con TODO en el codigo y en el test.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
