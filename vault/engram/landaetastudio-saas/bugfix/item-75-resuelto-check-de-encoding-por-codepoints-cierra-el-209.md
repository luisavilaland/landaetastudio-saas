---
id: 209
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 15:51:09"
updated_at: "2026-10-08 15:51:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 75 resuelto: check de encoding por codepoints cierra el gap de GGA en tests"
---

# Item 75 resuelto: check de encoding por codepoints cierra el gap de GGA en tests

**What**: Item 75 resuelto. `scripts/check-encoding.mjs` (Node puro, cero dependencias, siguiendo el precedente de `scripts/check-migrations.sh`) wireado a `format:check` como `prettier --check "**/*.md" && pnpm check:encoding`. Detecta por codepoint: `U+FFFD`, `U+FEFF` al inicio, doble encoding de 2 bytes (`U+00C3` + Latin-1), de 3 bytes (`U+00E2 U+20AC` + mapeo cp1252) y control chars fuera de tab/LF/CR. 432 archivos en 1.2 s. 11 tests nuevos. Contador 727 → 738. Commit `9922ff7`, PR #223.

**Why**: `.gga:40` excluye `*test.ts` y ningún otro control ve doble encoding porque el archivo sigue siendo UTF-8 válido. En el PR #222 un `.ts` con 14 mojibake + BOM convivió con 727 tests verdes. Además `format:check` solo cubría `**/*.md`: **ningún PR anterior verificó codepoints sobre TypeScript**.

**Where**: `scripts/check-encoding.mjs`, `scripts/__tests__/check-encoding.test.ts`, `package.json`, `AGENTS.md`, `docs/superpowers/specs/2026-09-subscription-lifecycle.md` (BOM de 3 bytes quitado sin reescribir), `vault/03_Deuda/deuda-tecnica.md` item 75 → RESUELTO, `vault/02_Bitacora/bitacora.md`. develop base @ `bc15276`.

**Learned**: (1) **El test-atrapó un bug del detector, no del test.** Escribí la detección de 3 bytes exigiendo el tercer codepoint en Latin-1 `U+0080..U+00BF`; el test falló porque el tercero de una raya rota (U+2014) es **U+201D**, fuera de ese rango. Las secuencias de 2 bytes terminan en un byte Latin-1, las de 3 en los mapeos de cp1252 `0x80-0x9F`. Con mi condición inicial el detector **no veía rayas ni comillas tipográficas rotas**, el caso más común de mojibake en un repo con texto en español — y mi script de diagnóstico previo reportó `moji3: 0` en todo el repo y lo acepté sin cuestionarlo. (2) **Un detector de mojibake no puede contener mojibake, ni como ejemplo.** Los fixtures y sondas se construyen con `String.fromCharCode(0x00c3, 0x00b1)`; escribir el string corrupto a mano lo mete en el repo. Mi primer test lo traía literal y lo corregí antes de commitear. (3) **Concluí causalidad con una sola muestra y me adelanté.** Ante un fallo de `pnpm test` corrí un A/B (quitar mi archivo → verde) y lo declaré regresión mía. Al repetir la suite completa **dos veces más con el archivo presente: 738/738 verde**. El indicio decisivo fue que los 2 archivos fallaron **simultáneamente**: workers independientes fallando a la vez apuntan a un blip de red hacia Neon, no a contención. En aislamiento pasan 14/14 en 11.65 s contra un timeout de 15 s: es **fragilidad preexistente** de los tests que hittean la DB real, no un efecto del PR. (4) `KNOWN_CORRUPT` reporta como warning visible pero no cuenta para el exit code: si no se mostrara, la lista se vuelve una excusa silenciosa. (5) `pnpm install` falló una vez con un error del store CAS de pnpm (`stat ...store\v3\files\54\...`) y dejó `prettier-plugin-tailwindcss` sin instalar — es exactamente el caso que AGENTS.md documenta: **verificar `node_modules` + `.env.local` antes del DoD, y no asumir que el install terminó bien porque el comando se ejecutó.**

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
