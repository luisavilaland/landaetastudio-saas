---
id: 70
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:40"
updated_at: "2026-09-26 22:23:32"
revision_count: 2
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Orden de cierre de PR con Engram: cambios -> Engram -> export -> staging (incluye vault/engram) -> commit -> push"
---

# Orden de cierre de PR con Engram: cambios -> Engram -> export -> staging (incluye vault/engram) -> commit -> push

**What**: Orden correcto al cerrar un PR con Engram en el medio: (1) cambios de código/docs, (2) `mem_save` de las memorias, (3) `pnpm vault:export`, (4) `git add` incluyendo `vault/engram/`, (5) commit, (6) push.

**Why**: Ocurrió dos veces en la misma sesión. En `eca4892` se exportó pero `vault/engram/` quedó deliberadamente sin stagear → 7 archivos huérfanos. En `6a31849` se grabó la memoria 73 (setext heading) y **nunca se exportó**: estaba en Engram pero no en el vault, y el commit siguiente (`4533140`) la dejó fuera hasta que Luis preguntó explícitamente.

**Where**: `vault/engram/` (tool-managed, está en `.prettierignore` pero TRACKEADO por git), `AGENTS.md` (checklist de cierre de PR), `PROMPTS.md` (sección "Cierre de PR completo")

**Learned**:
- **Verificación de no-olVIDO, en dos pasos y con，证明：**
  1. `git status --short --untracked-files=all` (plain, sin pathspec) → debe dar 0.
  2. Cruzado contra Engram: el max observation id debe tener archivo. Comparar `Get-ChildItem vault/engram -Recurse -Filter *.md` contra el último `id` devuelto por `mem_save`. Si falta un id en el rango, hay una memoria huérfana.
- **TRAMPA DE TIMING**: consultar `git status` en el MISMO comando que `pnpm vault:export` da **falso negativo**. Los handles de archivo en NTFS/Node todavía no cerraron cuando git los lee. Resultado: reporté "vault/engram limpio" y casi commiteo con 2 memorias afuera. **Siempre correr el `git status` como comando separado, después del export, no encadenado.**
- Un pathspec con slash (`git status --short vault/engram/`) puede devolver vacío según cómo PowerShell lo pase. Usar `git status --short` plain o agregar `--`. No confiar en un filtro de path para concluir "limpio".
- `vault/engram/` está en `.prettierignore` (se regenera en cada export) pero **igual se commitea**: es el registro compartido entre sesiones. Excluirlo del staging es una decisión consciente que hay que decir en voz alta, no un default.
- "Exportar al vault" NO es el mismo paso que "grabar en Engram". El export materializa archivos en disco; sin stagearlos, el trabajo se pierde para la próxima sesión.
- El orden importa porque cada paso depende del anterior: el export necesita las memorias ya grabadas, y el staging necesita el export ya corrido. Invertirlo produce archivos vacíos o faltantes.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
