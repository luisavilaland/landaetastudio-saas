---
id: 27
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: config/gga-provider
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 13:01:53"
updated_at: "2026-09-26 14:01:44"
revision_count: 3
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Diagnose bitacora encoding + GGA Nemotron fix"
---

# Diagnose bitacora encoding + GGA Nemotron fix

**What**: Diagnosticado el encoding de `vault/02_Bitacora/bitacora.md` (4 bytes de control preexistentes, NO corrupción de la migración) y cambiado el provider de GGA a Nemotron 3 Ultra.
**Why**: El hook GGA dio timeout de 300s en el commit `551239d` (PR #143) y el usuario pidió ambos diagnósticos.
**Where**: `.gga` (PROVIDER), `~/.config/opencode/opencode.jsonc` (model). Commits `551239d` y `b433579`.
**Learned**:
- **Encoding (control bytes)**: la bitácora es UTF-8 válido CON BOM (`EF-BB-BF`). 0 null bytes. Hay 4 bytes de control (0x0C form-feed, 0x08 backspace, 0x07 bell, 0x1D group-sep) en offsets 95119/95180/96927/128825 — **idénticos offsets en `develop:bitacora.md`**, o sea previo a la migración. Artefactos de pegado de salida de terminal (`fetch-depth`, `build`, SHA `744612f`, separador `—` doble-encoded como `C3 C2 AC`).
- **GGA root cause real**: el commit que expiró NO contenía `.md` — contenía `packages/db/src/__tests__/rls-cross-tenant.test.ts`. `FILE_PATTERNS` ya excluía `*.md`, así que el fix de "excluir .md" no aplicaba.
- **Bug encontrado (NO arreglado)**: `EXCLUDE_PATTERNS="*.test.*"` NO excluye `packages/db/src/__tests__/rls-cross-tenant.test.ts` — GGA igual lo revisó. El glob parece matchear contra el path relativo completo, donde `*` no cruza `/`.
- Nemotron 3 Ultra (`opencode/nemotron-3-ultra-free`) revisó el mismo changeset en **49.9s** vs timeout 300s de Space Bunny. Verificado end-to-end sin `--no-verify`.
- `gga run` sin nada stageado sale en 2.7s con "No matching files staged" y exit 0 — no ejercita el provider. Para forzarlo hay que stagear un archivo que matchee los patterns.
- `gga` vive en `C:\Users\exodo\bin\gga.ps1`; el hook es `.git/hooks/pre-commit` con `gga run || exit 1`.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-config]]
