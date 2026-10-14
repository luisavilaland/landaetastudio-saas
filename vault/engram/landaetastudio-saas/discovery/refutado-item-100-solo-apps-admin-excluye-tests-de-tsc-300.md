---
id: 300
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec4f8dba7ffehYHgc3dN4OLjv7
created_at: "2026-10-14 15:47:17"
updated_at: "2026-10-14 15:47:17"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Refutado item 100: solo apps/admin excluye tests de tsc"
---

# Refutado item 100: solo apps/admin excluye tests de tsc

**What**: la afirmacion de deuda-tecnica item 100 ("pnpm typecheck no ve los tests, pnpm build si") es falsa como regla general: solo `apps/admin/tsconfig.json` excluye `**/__tests__/**`; `apps/storefront` y `apps/superadmin` solo excluyen `node_modules` y si los incluyen.
**Why**: verificacion de la auditoria de fase 3, segunda pasada.
**Where**: `apps/admin/tsconfig.json` (exclude `**/__tests__/**`), `apps/storefront/tsconfig.json` y `apps/superadmin/tsconfig.json` (exclude solo `node_modules`).
**Learned**: verificado empiricamente con `tsc --noEmit --listFiles`: superadmin incluye 4 archivos de test, storefront 16, admin 0. Consecuencia REAL (distinta a la descrita): los 28 archivos de test de `apps/admin` no los chequea NI `typecheck` NI `next build` (mismo tsconfig) → estan fuera de todo chequeo de tipos del DoD. Y la anedota TS2741 de superadmin no puede explicarse con este mecanismo (superadmin si los incluye); el sospechoso es el replay de cache de turbo. Citar el mecanismo de un item de deuda sin verificarlo lleva a fixes que no arreglan nada.

---
*Session*: [[session-ses_ec4f8dba7ffehYHgc3dN4OLjv7]]
