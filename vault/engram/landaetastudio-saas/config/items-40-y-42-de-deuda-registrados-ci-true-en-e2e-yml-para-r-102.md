---
id: 102
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 23:16:20"
updated_at: "2026-10-02 23:16:20"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Items 40 y 42 de deuda registrados + CI:true en e2e.yml para revelar error de drizzle"
---

# Items 40 y 42 de deuda registrados + CI:true en e2e.yml para revelar error de drizzle

**What**: Registrados los items 40 y 42 en `vault/03_Deuda/deuda-tecnica.md` (40 inserta entre 39 y 41; 42 al final) y aplicado el fix paso 1 del item 41: `CI: true` en el step `seed` de `.github/workflows/e2e.yml`.

**Why**: El item 40 era un gap de numeracion (39 → 41). El item 42 es un bug descubierto durante el diagnostico del item 41. El `CI: true` es el paso 1 del fix autorizado, para que el error real de `drizzle-kit migrate` quede legible en el log de CI.

**Where**:
- `vault/03_Deuda/deuda-tecnica.md` - item 40 en L876, item 42 en L1009
- `.github/workflows/e2e.yml` - job `seed`, step `pnpm db:migrate && pnpm db:seed`, env `CI: true`
- Branch `chore/deuda-items-40-42`

**Learned**:

1. **El spinner de drizzle-kit es el motivo del item 41 ser indiagnosticable.** Los escapes ANSI `ESC[2K` (clear line) y `ESC[1G` (cursor a columna 1) BORRAN el mensaje de error del log de GitHub Actions. El error existe pero se sobrescribe antes de que GH lo capture. `CI: true` desactiva el spinner interactivo.

2. **El job `seed` esta en `e2e.yml`, NO en `ci.yml`.** `ci.yml` solo crea un `.env.local` con URLs dummy (`postgresql://dummy:dummy@localhost:5432/dummy`) y nunca corre migrate. El job real esta en `e2e.yml` L81-95, `runs-on: self-hosted`, node 22, con `DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}`.

3. **Validacion de YAML en este repo:** no hay `actionlint` ni modulo `yaml`, pero si `js-yaml` en `node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml`. Se puedeRequire por path relativo para validar un workflow antes de pushear:
   `require("./node_modules/.pnpm/js-yaml@4.1.1/node_modules/js-yaml")`.
   Confirmado que `CI: true` se parsea como **boolean true**, no string.

4. **El item 42 confirma que `ci.yml` y `e2e.yml` NO estan afectados** por el bug de dotenv: `ci.yml` genera su propio `.env.local` con URLs dummy, y `e2e.yml` exporta `DATABASE_URL` como env var del step. El problema es **exclusivamente de desarrollo local**.

5. **Ojo con la opcion A del item 42:** `drizzle.config.ts` se lee desde `packages/db` (el script hace `cd packages/db && drizzle-kit migrate`), asi que un `dotenv.config({ path: '.env.local' })` con ruta relativa resolveria contra `packages/db/`, no contra la raiz del repo. Hay que usar una ruta absoluta relativa al repo o `dotenv/config` con la raiz correcta.

6. **Aplicadas las reglas del propio item 40 antes de commitear:** escaneo CJK (0 matches), escaneo U+FFFD (1 match en L501, preexistente e intencional - cita un ejemplo de mojibake del item 32), `pnpm format:check` global verde, y diff solo-adiciones (0 borradas). El item 40 se auto-cumplio.

7. **Numeracion de deuda completa:** 38, 39, **40**, 41, **42**. El gap 39→41 quedo cerrado.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
