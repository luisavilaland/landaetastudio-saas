---
id: 67
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:21"
updated_at: "2026-09-26 22:04:21"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Un guard puede pasar verde sin cubrir lo que dice proteger: verificar cobertura, no presencia"
---

# Un guard puede pasar verde sin cubrir lo que dice proteger: verificar cobertura, no presencia

**What**: El guard de migraciones pasaba verde sin cubrir lo que decía proteger. El pathspec cubría solo `packages/db/migrations/`, pero el squash del 2026-09-24 movió las migraciones `0005`–`0015` a `docs/migrations-archive/2026-09-24/`, fuera de todo pathspec.

**Why**: Se podía reescribir `0013_ensure_rls_and_grants.sql` y el CI pasaba. El item 2 de deuda documentaba el guard como inexistente cuando ya existía y estaba cableado — el entry describía el síntoma equivocado.

**Where**: `scripts/check-migrations.sh` (lines 61-67, pathspec), `vault/03_Deuda/deuda-tecnica.md` (item 2)

**Learned**:
- Gap confirmado **empíricamente**, no por lectura: el pathspec viejo devolvió VACÍO sobre la misma edición que el nuevo detecta.
- Al auditar un control (guard, lint, CI check, test), verificar **COBERTURA** — qué pathspec/archivos mira realmente — no **PRESENCIA** — que el script exista y esté cableado.
- Un guard que pasa sin cubrir es PEOR que no tener guard: genera confianza falsa y desinvierte al equipo en el control.
- La contradicción documentary era la señal: un item que dice "no hay guard" mientras el guard existe en CI es un item mal auditado, no un item pendiente.
- Regla derivada: en un sweep de deuda, leer el CONTENIDO de cada item, no solo la lista de títulos. Reporté items 24 y 29 como abiertos por leer solo títulos; ambos estaban resueltos.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
