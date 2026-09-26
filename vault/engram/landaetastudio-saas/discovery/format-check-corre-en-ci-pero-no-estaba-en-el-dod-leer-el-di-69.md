---
id: 69
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:36"
updated_at: "2026-09-26 22:04:52"
revision_count: 2
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "format:check corre en CI pero no estaba en el DoD: leer el diff antes de asumir corrupción"
---

# format:check corre en CI pero no estaba en el DoD: leer el diff antes de asumir corrupción

**What**: `pnpm format:check` (prettier sobre `**/*.md`) corre en CI, en el job `build` (`.github/workflows/ci.yml`), pero NO estaba en el Definition of DoD de AGENTS.md. Rompió una edición propia en `deuda-tecnica.md`.

**Why**: El DoD de AGENTS.md declaraba `pnpm lint # eslint + prettier`, afirmación FALSA: `pnpm lint` es `turbo run lint` y corre solo eslint. El check de markdown es un script aparte. Todo agente que edita `.md` sin enterarse de que hay un gate va a romper CI.

**Where**: `package.json` (script `format:check`), `.github/workflows/ci.yml` (step "Prettier check (markdown)"), `AGENTS.md` (DoD + checklist de cierre de PR), `.prettierignore` (excluye `vault/engram/`, bitácora, artefactos de build)

**Learned**:
- Flujo correcto cuando una verificación falla pero el contenido parece bien: **leer el diff primero**, no asumir corrupción. Acá el contenido estaba bien; lo que estaba mal era el formato.
- `prettier --write` sobre un archivo grande puede tocar cosas fuera del cambio. Verificar con `git diff -U0` que los hunks quedan confinados al rango editado. Acá: 25 inserciones / 8 eliminaciones, todas en las líneas 56-84.
- `.prettierignore` excluye `vault/engram/` y la bitácora (append-only). `vault/03_Deuda/deuda-tecnica.md` NO está excluido y sí se formatea: es un archivo de deuda técnica editable, no histórico.
- Consecuencia: cualquier agente que edite markdown tiene que correr `pnpm format:check` antes de commitear, o el CI lo rechaza. Ya está documentado en AGENTS.md.
- Gotcha relacionado: prettier no es idempotente con bloques de código indentados — los reinterpreta y colapsa (descubierto empíricamente en el PR E / item 31).

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
