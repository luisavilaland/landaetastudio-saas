---
id: 64
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 21:53:00"
updated_at: "2026-09-26 21:53:00"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría pre-Fase 2: items 24 y 29 resueltos (mi reporte previo estaba mal); guard no cubre el archive"
---

# Auditoría pre-Fase 2: items 24 y 29 resueltos (mi reporte previo estaba mal); guard no cubre el archive

**What**: Auditoría de cierre pre-Fase 2, Parte 1 (read-only) — verifiqué 3 items de deuda que yo había reportado erróneamente como abiertos. **Items 24 y 29 están genuinamente RESUELTOS**; el item 2 está implementado pero mal documentado.

**Why**: El usuario pidió verificar estado real vs estado declarado antes de arrancar Fase 2. Mi reporte de reincorporación fue incorrecto en 2 de 3 items.

**Where**: `vault/03_Deuda/deuda-tecnica.md` (items 2, 24, 29), `scripts/check-migrations.sh`, `.github/workflows/ci.yml:27`, `package.json`, `opencode.json`

**Learned**:
- **Item 29 (ponytail): RESUELTO y verificado.** `ponytail` no aparece en `opencode.json`. La referencia rota a `.opencode/ponytail/.opencode/plugins/ponytail.mjs` fue eliminada. Cierre por subagente B en PR #145 (`chore/skills-complete`).
- **Item 24 (db:migrate): RESUELTO y verificado.** `package.json` tiene `"db:migrate": "cd packages/db && drizzle-kit migrate"` y `setup` = install → db:generate → db:migrate → db:seed (orden correcto, el seed ya no corre sin schema). Commit `6756a38` (PR #141).
- **Item 2 (guard migraciones inmutables): IMPLEMENTADO, el entry lo describe como inexistente.** El archivo dice "no hay guard automatizado" y "Plan propuesto (no implementar ahora)". La realidad: `scripts/check-migrations.sh` existe (91 líneas, fail-closed, con comentarios de las decisiones no obvias) y está cableado en `ci.yml:27` con `fetch-depth: 0`. Criterios 1 y 2 del plan cumplidos. **Falta el criterio 3**: el comando no está documentado en SETUP.md, solo se menciona en `AGENTS.md:74`.
- **HALLAZGO NUEVO (no está en la deuda): el guard ya no protege el archivo de migraciones.** El pathspec (líneas 53-54) solo cubre `packages/db/migrations/*.sql` y `meta/*_snapshot.json`. Tras el squash, los 12 .sql de `docs/migrations-archive/2026-09-24/` quedan FUERA de toda protección: se pueden editar o borrar y el CI pasa verde. La "política de migraciones inmutables" cubre hoy solo el baseline.
- `MIGRATIONS_DIR` (línea 33) está definida pero no se usa — los pathspecs hardcodean la ruta. Dead code menor.
- El marcador de reset `docs/migrations-archive/*/README.md` SÍ existe, así que la excepción del guard funciona.
- **Regla general aprendida**: un guard puede pasar verde y aun así no cubrir lo que dice proteger. Verificar cobertura, no presencia.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
