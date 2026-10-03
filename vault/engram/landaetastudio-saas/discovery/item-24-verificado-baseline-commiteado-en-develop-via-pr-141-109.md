---
id: 109
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 03:20:30"
updated_at: "2026-10-03 03:20:30"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Item 24 verificado: baseline commiteado en develop via PR #141 (6756a38), no se perdio"
---

# Item 24 verificado: baseline commiteado en develop via PR #141 (6756a38), no se perdio

**What**: Verificacion read-only del item 24 (baseline de migraciones). **El trabajo NO se perdio: esta commiteado en develop** via `6756a38` "Reset de migraciones con baseline limpio (item 24) (#141)" del 2026-09-24, de EdgarVz.

**Why**: Un reporte previo de "working tree limpio, sin ramas baseline" sugeria trabajo sin commitear o en un worktree eliminado. Era una lectura equivocada: el trabajo se hizo en PR #141 y hace dias.

**Learned**:

1. **Hash verificado en disco, coincide exacto:**
   `sha256(packages/db/migrations/0000_baseline.sql)` = `2d3f2533385ce096a19c417c9400bddd8502a972687035d779004ccfab9a6bce`, 14536 bytes. **Coincide con el hash registrado en `drizzle.__drizzle_migrations` de production.** Archivo, repo y DB estan en el mismo estado.

2. **`migrations/` esta limpio:** solo `0000_baseline.sql` (14536 B), `meta/` (2 archivos) y `README.md` (677 B). **Cero `.sql` viejos (0001-0015)** en esa carpeta.

3. **`_journal.json` tiene 1 sola entry:** `{idx: 0, tag: "0000_baseline", when: 1790272901219, breakpoints: true}`. Estado final, no a medio camino.

4. **`db:migrate` usa `migrate`, no `up`:** `package.json:8` = `cd packages/db && drizzle-kit migrate`. Y `setup` (L10) encadena correctamente: `pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed`.

5. **`SETUP.md` esta actualizado:** L46-49 documenta `drizzle-kit migrate`, que `0000_baseline.sql` representa el estado actual, y que el historial previo esta en `docs/migrations-archive/2026-09-24/`. Tambien L54/L59 el guard `scripts/check-migrations.sh`.

6. **`docs/migrations-archive/2026-09-24/` completo:** 13 archivos `.sql` (0005-0015, incluyendo `0005_add_admin_users.sql`), `README.md` (505 B) y `meta/` con `_journal.json` (2395 B) + 12 snapshots (0000, 0001, 0002, 0005-0008, 0011-0015). **Nada se perdio del historial.**

7. **`6756a38` esta en develop** (`git merge-base --is-ancestor` confirma). Toco: `SETUP.md`, `bitacora.md`, `docs/deuda-tecnica.md`, `package.json`, `scripts/check-migrations.sh`, `packages/db/migrations/0000_baseline.sql`, `meta/_journal.json`, `meta/0000_snapshot.json`, y el archivado completo. **No existe rama `chore/reset-migrations-baseline` porque el trabajo ya se mergeo via squash a develop.**

8. **El test RLS tiene las dos capas:** `isUsableUrl()` en L34 (rechaza `localhost`, `127.0.0.1`, `dummy`) + `describe.skipIf(!hasAppUrl)` en L161. Tambien valida que `DATABASE_APP_URL` no sea owner (L172). Sus commits (`670a7b3`, `551239d`) **estan en develop**.

9. **Item 24: CERRADO.** L482-494, estado "Resuelto en esta PR (2026-09-24)", con validacion en branch efimero y production, DoD completo (lint 6/6, typecheck 9/9, 474 tests en 57 archivos, build 3/3).

10. **Item 23 (colision de IDs en snapshots 0012-0014): SIGUE ABIERTO.** El texto no menciona que el baseline lo haya resuelto, aunque el squash archivó esos snapshots y el baseline regenerado tiene una cadena limpia. **El item esta desactualizado:** el impacto que describe ("no se puede regenerar una migracion custom") ya no aplica al baseline, aunque sigue aplicando a los snapshots archivados (que son inmutables). **Candidato a cierre por redaccion.**

11. **PR #181 NO tiene relacion con el item 24.** Toca solo `.github/workflows/e2e.yml`, `vault/03_Deuda/deuda-tecnica.md` (items 40/42/43) y exportacion de memorias Engram. El titulo aun menciona "CI=true" que ya fue revertido en `22bc8c6` - el body si esta actualizado, el title no.

12. **Nota de ruta:** la deuda tecnica vive en `vault/03_Deuda/deuda-tecnica.md`. En `6756a38` aun estaba en `docs/deuda-tecnica.md`; fue migrada despues por `551239d`.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
