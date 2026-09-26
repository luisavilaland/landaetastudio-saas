---
id: 46
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/powershell-verification-traps
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 18:29:47"
updated_at: "2026-09-26 18:29:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "PowerShell: $? con stderr y -not $null dan falsos positivos"
---

# PowerShell: $? con stderr y -not $null dan falsos positivos

**What**: Dos trampas de PowerShell 5.1 que casi producen reportes falsos en el merge/limpieza del PR #146:

1. **Encadenar con `if ($?)` salta el comando siguiente si el anterior escribe a stderr.** Caso real: `git checkout develop; if ($?) { git pull origin develop }`. `git checkout` imprime "Already on 'develop'" por stderr, eso deja `$?` = false, y el `git pull` NUNCA corrió. El output mostraba "Your branch is up to date" y casi reporté "develop actualizado" cuando local seguía en `f962116` y `origin/develop` ya estaba en `c97321b`. Lo detectó un `git rev-parse --short HEAD` comparativo. Regla: encadenar con `;` o con `if ($LASTEXITCODE -eq 0)`, nunca con `if ($?)` cuando el comando previo puede escribir a stderr. Y SIEMPRE verificar con `git rev-parse` / `git log` que el HEAD movio, en vez de creerse el mensaje de "up to date".

2. **Comandos sin stdout hacen que `if (-not (cmd))` sea TRUE siempre.** Caso real: `if (-not (git diff --quiet develop branch)) { "difieren" } else { "identicos" }`. `git diff --quiet` no imprime nada, asi que PowerShell evalua `-not $null` = true:|reporto "difieren" para cualquier branch. La senal real era el `--stat` vacio. Regla: para判断 de exit code usar `$LASTEXITCODE` (`git diff --quiet a b; if ($LASTEXITCODE -eq 0)`), nunca el stdout.

**Why**: Ambos permitieron afirmar cosas falsas con apariencia de verificacion. El primero casi dejo develop desactualizado sin avisar; el segundo casi impidio borrar una branch que era segura.

**Where**: PowerShell 5.1 del agente; comandos `git checkout/pull`, `git diff`, `git branch -d`, y cualquier `pnpm exec` que use exit codes.

**Learned**: En Windows PowerShell, stderr NO cuenta como exito. Y `if (-not (comando))` es un test roto para cualquier comando silencioso: mide si hubo stdout, no si el exit code fue 0. Patron seguro: `comando; if ($LASTEXITCODE -eq 0) { ok } else { fallo }`. Nota relacionada: tras un squash merge la branch queda "not fully merged" por ancestria, asi que `git branch -d` la rechaza; aplicar la mitigacion del item 28 (comparar arboles con `git diff --quiet` + `$LASTEXITCODE`) antes de usar `-D`.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
