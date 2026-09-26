---
id: 62
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 21:49:46"
updated_at: "2026-09-26 21:49:46"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Discrepancias doc-vs-código: contador README, lista de paquetes AGENTS.md, refs de migraciones"
---

# Discrepancias doc-vs-código: contador README, lista de paquetes AGENTS.md, refs de migraciones

**What**: Cuatro discrepancias doc-vs-código detectadas en la auditoría de reincorporación (2026-09-26, HEAD 2fa9b98). Ninguna rompe el build; todas son de documentación.

**Why**: El usuario pidió discrepancias explícitas entre documentación y código.

**Where**: README.md:69, AGENTS.md (sección "Estructura mínima de referencia" y "Migraciones — procedimiento idempotente"), docs/superpowers/specs/2026-09-blueprint-v2.6.md (cabecera)

**Learned**:
1. `README.md:69` dice "430 tests (100% passing) ... (hoy)" dentro del checklist de Fase 4. El valor real es **474 tests / 57 archivos**. Es un contador de estado actual, así que según AGENTS.md SÍ corresponde actualizarlo (las líneas de historial de releases son append-only, este no lo es). El "(hoy)" además es un timestamp relativo que envejece mal.
2. `AGENTS.md` lista "Paquetes actuales: @repo/db, @repo/storage, @repo/auth, @repo/validation, @repo/commerce" — **faltan `@repo/logger` y `@repo/test-utils`**, que sí existen en disco y son usados (el propio AGENTS.md los cita en otras secciones).
3. `AGENTS.md` sigue citando migraciones 0010/0013 por número como si vivieran en `packages/db/migrations/`, pero ese directorio solo tiene `0000_baseline.sql` (squash del 2026-09-24; los incrementales están en `docs/migrations-archive/2026-09-24/`).
4. Cabecera del Blueprint v2.6 dice "**Estado:** Para aprobación del equipo" aunque la tabla de roadmap ya marca Fase 1 como Completada.

Pendiente de confirmación del humano: ninguno bloquea el DoD (los 4 comandos pasan).

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
