---
id: 42
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 16:57:43"
updated_at: "2026-09-26 16:57:43"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Big Pickle (Paseo Programador) loop en task de edición de docs"
---

# Big Pickle (Paseo Programador) loop en task de edición de docs

**What**: El perfil Paseo "Programador" (provider `opencode/big-pickle`) se trabó en loop dos veces consecutivas con el mismo prompt de edición de documentación: emitía "I'll start by reading the current PROMPTS.md to understand its structure", ejecutaba un `Test-Path` y terminaba sin editar nada. `updateAt` congelado, 0 permisos pendientes, sin error reportado.
**Why**: PR C (chore/docs-toolkit-consolidation) delegando PROMPTS.md al subagente B con un prompt largo de 3 tareas y rutas relativas.
**Where**: Paseo agent 60f37d12-caa0-4259-80d0-d58e1ab34468, worktree C:\Users\exodo\.paseo\worktrees\0q5zj3gn\docs-toolkit-consolidation
**Learned**: (1) big-pickle responde mejor a prompts con EDITS numeradas y explícitas ("EDIT 1 — hacé X") que a un bloque narrativo de "tareas"; (2) hay que darle el path ABSOLUTO del archivo: con ruta relativa el Test-Path no confirma nada; (3) el síntoma de loop es `status: running` con `updatedAt` congelado y `lastMessage` repetido — detectable con paseo_get_agent_activity, sin necesidad de esperar la notificación; (4) ante dos fallos idénticos, archivar el agente y relanzar uno nuevo en vez de re-promptar (re-promptar repite el loop). Los perfiles MiMo (QA) y Ling (Diseñador) completaron el trabajo asignado sin incidente.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
