---
id: 88
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 18:27:56"
updated_at: "2026-10-01 18:27:56"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR #175 mergeado (b7fc01a) + item 39 BOM + PR #176"
---

# PR #175 mergeado (b7fc01a) + item 39 BOM + PR #176

**What**: PR #175 mergeado (squash `b7fc01a`). develop actualizado y verificado. Item 39 de deuda registrado (BOM UTF-8 en el transversal) + PR #176 abierto.

**Why**: Luis aprobo #175 (CI verde confirmado). El BOM lo detecto en el review de ese PR.

**Where**: PR #175 -> develop `b7fc01a`. PR #176 abierto (rama `chore/deuda-bom`, commit `16d30a5`). Item 39 en `vault/03_Deuda/deuda-tecnica.md` linea 828.

**Learned**:
1. **BOM CONFIRMADO**: `docs/superpowers/specs/2026-09-subscription-lifecycle.md` arranca con bytes `EF BB BF`. Verificado leyendo `[System.IO.File]::ReadAllBytes($f)[0..2]`. Impacto real: `grep -c '^#'` devuelve 0. No rompe prettier ni CI — es ruido latente.
2. **Cometi el MISMO error de format:check por segunda vez.** Tras agregar el item 39, `pnpm format:check` fallo de nuevo. Es el mismo fallo que hizo fallar el CI del PR #175. **Leccion: correr `pnpm format:check` DESPUES de cada `Add-Content` a un `.md`, no solo antes del commit.** El DoD lo pide, y yo lo salteé dos veces seguidas.
3. **Corrupcion de caracteres en heredocs de PowerShell otra vez**: se me colaron `linters的老` y `去掉 el BOM` al escribir el item 39 con `Add-Content -Value $entry`. Patron ya conocido (obs anterior: `вся` en el design). **Siempre escanear con regex `[\u4e00-\u9fff\u0400-\u04FF]` despues de escribir texto no-ASCII via here-strings en PowerShell.** El `write` tool no tiene este problema.
4. **El item 5 del archivo de deuda usa `###` en vez de `##`** — inconsistencia preexistente, documentada en el item 39 en vez de corregida (no mezclar limpieza con cambios).
5. **Merge squash encadena bien**: #175 (4 commits) -> un solo `b7fc01a` en develop. develop queda en: b7fc01a (#175), 9af860e (#163), a0b58fd (#162).
6. **Rama `chore/fix-transversal-fase2` eliminada** (local por `gh --delete-branch`, remoto por el flag). Quedan `develop`, `main` y `chore/deuda-bom`.

**Pendiente**: PR #176 abierto sin mergear. Requiere review.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
