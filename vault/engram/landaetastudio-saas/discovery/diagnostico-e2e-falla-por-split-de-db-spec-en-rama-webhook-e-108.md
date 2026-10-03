---
id: 108
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 03:14:42"
updated_at: "2026-10-03 03:14:42"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Diagnostico: E2E falla por split de DB (spec en rama, webhook en produccion)"
---

# Diagnostico: E2E falla por split de DB (spec en rama, webhook en produccion)

**What**: Diagnostico read-only del estado de secrets, E2E fallido y tracking de migraciones. Hallazgo central: **el job `seed` paso y `db:migrate` aplico correctamente en la rama** (`[✓] migrations applied successfully!`), pero **el job `e2e` falla porque crea y lee ordenes en la rama mientras el webhook corre contra produccion**. La orden no existe en produccion, asi que el webhook no la actualiza.

**Why**: Se cambio `NEON_DATABASE_URL` en GitHub Secrets para apuntar a una rama de Neon, pero `NEON_DATABASE_APP_URL` sigue en produccion. Eso partio el estado en dos.

**Where**:
- `.github/workflows/e2e.yml` - jobs `seed` (L112) y `e2e` (L125-142)
- `e2e/webhook/webhook-signature.spec.ts:26,35,91`
- `packages/db/src/index.ts:6` - el runtime usa solo `DATABASE_APP_URL`

**Learned**:

1. **Mapeo de secrets (verificacion 1):**
   | Job | Step | Secret | Apunta a |
   | --- | --- | --- | --- |
   | `seed` | `Verificar conexion a Neon (con SSL)` L97-107 | `NEON_DATABASE_URL` | **rama** |
   | `seed` | `pnpm db:migrate && pnpm db:seed` L108-110 | `NEON_DATABASE_URL` | **rama** |
   | `e2e` | `Run RLS integration test` L125-128 | `NEON_DATABASE_APP_URL` | **produccion** |
   | `e2e` | `Run E2E tests` L134-142 | `NEON_DATABASE_URL` | **rama** |
   | `ci.yml` | L48-49 | ninguna (dummy URLs) | n/a |

2. **Causa del fallo E2E (1 linea):** el spec crea las ordenes con `DATABASE_URL` (rama) y las lee con `DATABASE_URL` (rama), pero el webhook corre en Vercel y usa `DATABASE_APP_URL` (produccion), donde la orden **no existe** -> el webhook no la actualiza -> el test lee `pending_payment`.

3. **Resultado del E2E:** **33 passed, 1 failed, 1 skipped**. El unico fallo es `webhook-signature.spec.ts:65` "firma válida + pago aprobado -> orden pasa a confirmed". `Expected: "confirmed"` / `Received: "pending_payment"`, con 2 retries. El fallo esta en L92: `expect(rows[0]?.status).toBe('confirmed')`.

4. **El paso 6 (RLS) PASO** con `NEON_DATABASE_APP_URL` (produccion). Eso confirma que la red a produccion funciona y que el allowlist esta OK para esa DB.

5. **El `seed` paso completo:** `CONEXION OK: 1` y `[✓] migrations applied successfully!`. El fix de nftables en el VPS y el cambio a la rama resolvieron el item 41 en cuanto a conectividad.

6. **CORRECCION A UNA PREMISA DEL ENCARGO:** el encargo decia "el baseline todavia NO se aplico en ninguna DB de forma canonica". **Eso es incorrecto para `production`.** En `production` el baseline **SI esta aplicado y registrado**:
   - `drizzle.__drizzle_migrations` existe (schema `drizzle`, NO `public`).
   - `public.__drizzle_migrations` **NO EXISTE** (error `42P01`).
   - 1 sola fila: `id=1`, `hash=2d3f2533385ce096a19c417c9400bd...`, `created_at=2026-09-24T18:52:48.831Z`.
   - El conteo del hash del baseline (`2d3f...a6bce`) en esa tabla da **1**. Coincide con el sha256 de `0000_baseline.sql`.
   - 13 tablas en `public`.

7. **La tabla de tracking vive en el schema `drizzle`, no en `public`.** Consultar `public.__drizzle_migrations` va a fallar siempre con `42P01`. El item 14 de la deuda menciona `public.__drizzle_migrations` y por ahi viene parte de la confusion historica.

8. **NO PUDE CONSULTAR LA DB DE LA RAMA.** El step de diagnostico que exponia el host fue reemplazado por el test de conexion (que imprime `CONEXION OK` pero no el host), y `gh` no puede leer el valor de los secrets. **Hace falta que Luis pase el host o la connection string de la rama** para cerrar las verificaciones 4 y 5. La rama **si** tiene el migrate aplicado (`migrations applied successfully!`), pero eso podria ser un no-op si la rama heredó el tracking de `production` al crearse.

9. **Repo limpio:** branch `chore/deuda-items-40-42` @ `fd93d2d`, working tree limpio, 1 solo worktree, y **NO existe** `chore/reset-migrations-baseline` ni `verify-baseline` (ni local ni remota).

10. **Ojo antes de arreglar el E2E:** al apuntar `DATABASE_URL` a la rama y dejar `DATABASE_APP_URL` en produccion, el `seed` **trunca las 13 tablas de la rama** mientras el runtime escribe en produccion. Los datos quedan partidos en dos bases. Para que E2E sea coherente, `NEON_DATABASE_APP_URL` deberia apuntar **a la misma rama** que `NEON_DATABASE_URL` (y部署 del storefront tambien). Si no, E2E va a seguir fallando por la misma razon aunque se ajuste el spec.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
