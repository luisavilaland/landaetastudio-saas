---
id: 70
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:40"
updated_at: "2026-09-26 22:04:40"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Orden de cierre de PR con Engram: cambios -> Engram -> export -> staging (incluye vault/engram) -> commit -> push"
---

# Orden de cierre de PR con Engram: cambios -> Engram -> export -> staging (incluye vault/engram) -> commit -> push

**What**: Orden correcto al cerrar un PR con Engram en el medio: (1) cambios de código/docs, (2) `mem_save` de las memorias, (3) `pnpm vault:export`, (4) `git add` incluyendo `vault/engram/`, (5) commit, (6) push.

**Why**: En el commit `eca4892` (PR #150) se exportó a Engram ANTES de commitear pero el `vault/engram/` quedó deliberadamente sin stagear. Resultado: 7 archivos tool-managed huérfanos en el working tree, y el vault del repo no refleja lo que la sesión aprendió.

**Where**: `vault/engram/` (tool-managed, gitignored de prettier pero TRACKEADO por git), `AGENTS.md` (checklist de cierre de PR), `PROMPTS.md` (sección "Cierre de PR completo")

**Learned**:
- `vault/engram/` está en `.prettierignore` (se regenera en cada export) pero **igual se commitea**: es el registro compartido entre sesiones. Excluirlo del staging es una decisión consciente, no un default.
- El default correcto para un PR que usó Engram es stagear `vault/engram/` en el MISMO commit. Si va aparte, es porque el PR es de otra naturaleza y hay que decirlo explícitamente.
- "Exportar al vault" NO es el mismo paso que "grabar en Engram". El export materializa archivos en disco; si no se stagean, el trabajo se pierde para la próxima sesión.
- El orden importa porque cada paso depende del anterior: el export necesita las memorias ya grabadas, y el staging necesita el export ya corrido. Invertirlo produce archivos vacíos o faltantes.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
