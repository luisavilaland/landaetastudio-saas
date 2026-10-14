---
id: 294
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:07:24"
updated_at: "2026-10-14 15:07:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "DoD verde en develop, pero turbo cache lo enmascaraba"
---

# DoD verde en develop, pero turbo cache lo enmascaraba

**What**: Al reincorporarse (2026-10-14) se corrió el DoD completo en develop (HEAD ef401aa) y dio verde: lint 0, typecheck 0, build 0, test 889/889 en 78 archivos, format:check 0, check:encoding 0 hallazgos.
**Why**: Verificar el estado real del proyecto antes de retomar trabajo.
**Where**: Rama develop, commit ef401aa (S4b, PR #251).
**Learned**: `pnpm lint`/`typecheck`/`build` corrieron 100% desde cache de turbo (18 tasks, 0 trabajo real). Para evidencia genuista hace falta `pnpm turbo run build --force` (3/3, 0 cached, 37.8s). Un DoD que no hace trabajo NO es un DoD que verifica. Además el build NO formatea ni muta archivos, asi que --force es seguro en modo read-only.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
