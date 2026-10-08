---
id: 213
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 18:41:47"
updated_at: "2026-10-08 18:41:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Item 79 registrado: PowerShell > decodifica bytes"
---

# Item 79 registrado: PowerShell > decodifica bytes

**What**: Sesion 2026-10-08 cerrada con 5 items resueltos (69, 70, 71, 73, 75) y 6 items abiertos (66, 68, 74, 76, 77, 78). Item 79 registrado: PowerShell `>` decodifica bytes al redirigir.

**Why**: Reincorporacion al proyecto landaetastudio-saas el 2026-10-09. El commit 5e5b4db (exports de Engram del cierre) quedo local por branch protection de develop y se pushea via PR de arranque.

**Where**: vault/03_Deuda/deuda-tecnica.md (item 79), AGENTS.md (sub-regla 6.5 sobre medir bytes), scripts/check-encoding.mjs (KNOWN_CORRUPT = bitacora.md + deuda-tecnica.md).

**Learned**:
- El DoD completo del 2026-10-09 dio verde: lint 6/6, typecheck 9/9, test 738/738 en 70 archivos, build 3/3 apps, format:check 0 con encoding en 2 KNOWN_CORRUPT y 0 hallazgos nuevos.
- Item 79: `git show <ref>:<path> > $temp\f.md` en PowerShell decodifica el blob a string ANTES de escribir. El archivo temporal puede traer bytes invalidos que NO existen en el blob. En el cierre de #224 eso produjo un hallazgo de "68 U+FFFD" sobre un blob que estaba limpio (3229 bytes, 0 U+FFFD). Tercera vez en una sola sesion que PowerShell inventa un bug de encoding: ya es patron, no anecdota.
- Toda medicion de bytes pasa por Node (`child_process.execFileSync` con `git cat-file blob`) o `git diff --numstat`, nunca por `>`.
- `vault/03_Deuda/deuda-tecnica.md` usa em dash (U+2014) y espanol acentuado completo (341 U+00F3, 129 U+00ED). Al anclar un edit con `-` en vez de `—` el match falla: anclar por una subcadena corta y sin caracteres especiales.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
