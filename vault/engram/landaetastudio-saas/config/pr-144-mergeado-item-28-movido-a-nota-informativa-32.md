---
id: 32
type: config
project: landaetastudio-saas
scope: project
topic_key: delivery/pr-144-audit-merge
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 15:04:27"
updated_at: "2026-09-26 15:04:27"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 144 mergeado + item 28 movido a nota informativa"
---

# PR 144 mergeado + item 28 movido a nota informativa

**What**: PR #144 mergeado a `develop` como merge commit `fa4d520` por EdgarVz. Item 28 movido de `deuda-tecnica.md` a nota informativa en la bitácora. CI 5/5 verde.
**Why**: Review de luisavilaland: el delete+add de `arquitectura.md` es comportamiento de git, no deuda técnica.
**Where**: `develop` @ `fa4d520`. Commits del branch: `f4d35c5` (auditoría, 0 huérfanas + deuda 25-28) y `c1367b0` (mover item 28).
**Learned**:
- **Ambos PRs fueron mergeados manualmente por EdgarVz, no por mí.** #143 (`59df46f`) y #144 (`fa4d520`), los dos como **merge commit**, no squash, pese a que la instrucción era `gh pr merge --squash`. Patrón a tener en cuenta: cuando pido verificar CI antes de mergear, el humano puede mergear antes de que yo llegue.
- PR #144 CI: `build` SUCCESS (8m58s), Vercel Preview Comments SUCCESS, 3× Vercel SUCCESS. `gh pr checks` exit 0. Sin CANCELLED (a diferencia de #143, donde `e2e` quedó CANCELLED y el CLI lo reportó como "fail").
- El archivo `deuda-tecnica.md` SÍ es editable (no append-only), a diferencia de la bitácora. Por eso eliminar el item 28 fue seguro.
- **PowerShell gotchas encontradas**: `$b[0..$newLen-1]` falla con `op_Subtraction` — necesita paréntesis `0..($newLen-1)`. `CP` es alias de `Copy-Item`. `"text ~$var:"` rompe el parser (usar `${var}`). Los `.ps1` con no-ASCII deben guardarse sin BOM y ejecutarse con `-File` desde `powershell.exe` (PS 5.1 los lee como ANSI si tienen BOM).
- **La consola de Windows miente sobre el encoding — 3 veces seguidas en esta sesión** (bitácora, deuda, nota nueva). El `WriteAllText` con UTF8Encoding($false) preserva el BOM y los chars no-ASCII correctamente; verificado a nivel de bytes (U+2014, U+2192, U+00E3). **Siempre verificar bytes, nunca confiar en lo que muestra la terminal.**
- Estado final: `develop` = `fa4d520` local y remoto, working tree limpio, 0 PRs abiertos, 1 worktree, branch local del PR borrada.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-delivery]]
