---
id: 101
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 23:12:47"
updated_at: "2026-10-02 23:12:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Diagnostico item 41: local OK, baseline no idempotente, tracking de CI desalineado"
---

# Diagnostico item 41: local OK, baseline no idempotente, tracking de CI desalineado

**What**: Diagnostico del item 41 (`seed` rojo en CI). Local funciona (exit 0, no-op). La causa mas probable es que la BD de CI tiene un tracking de drizzle que NO coincide con el baseline actual, y el baseline **no es idempotente** (13 `CREATE TABLE` sin `IF NOT EXISTS`), asi que re-aplicarlo revienta. El error real de CI esta **destruido por el spinner de drizzle-kit**.

**Why**: Item 41 bloquea T1 indirectamente (el PR de T1 saldria con CI rojo). H2 no lo bloquea (correccion correcta del humano: T1 es una migracion de indice, independiente del panel de MP).

**Where**: `.github/workflows/e2e.yml` job `seed` (L81-95), `packages/db/drizzle.config.ts`, `packages/db/migrations/0000_baseline.sql`, `vault/03_Deuda/deuda-tecnica.md` item 14 y 15.

**Learned**:

1. **El job `seed` NO esta en `ci.yml`, esta en `e2e.yml`** (L81-95). Corre en `self-hosted`, node 22, con `DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}`. `ci.yml` solo usa URLs dummy y nunca corre migrate.

2. **`pnpm db:migrate` local FUNCIONA:** `[✓] migrations applied successfully!` exit 0. Es no-op porque el hash coincide.

3. **El tracking de la DB de dev esta correcto:** 1 sola fila, `hash=2d3f2533385ce096a19c417c9400bd...`, `when=2026-09-24T18:52:48Z`. Ese hash es **exactamente el sha256 de `0000_baseline.sql`** (`2d3f2533385ce096a19c417c9400bddd8502a972687035d779004ccfab9a6bce`, 14536 bytes). La DB de dev tiene las 13 tablas y su tracking al dia.

4. **El baseline NO es idempotente:** 13 `CREATE TABLE` **sin `IF NOT EXISTS`**, 0 menciones de `IF NOT EXISTS`. Cualquier base que ya tenga el schema pero cuyo tracking no coincida, revienta con "relation already exists".

5. **MECANISMO DE FALLO en CI:** drizzle llega a "applying migrations..." (o sea, conecto y decidio que hay algo pendiente), intenta aplicar el baseline contra una BD que ya tiene las 13 tablas, y falla. Si el tracking de CI coincidiera, seria no-op y pasaria.

6. **El error de CI es invisible por el spinner de drizzle-kit.** Los escapes ANSI (`^[[2K^[[1G`) borran el mensaje. Localmente el error SI se ve (`url: undefined`); en CI desaparece. Esto es un sub-problema del item 41: **no hay evidencia utilizable del fallo real.**

7. **El proyecto YA documenta este mecanismo en el item 14** (L310-341): "`pnpm db:migrate` en un entorno fresco: intenta aplicar 0001+ y falla con 'table already exists'". Y dice que afecta "CI si rota DB, previews si cambia branching, nuevos devs que siguen SETUP.md". El item 15 (L484) documento el squash del 2026-09-24 que regenero el baseline.

8. **BUG NUEVO, independiente del CI: `pnpm db:migrate` no carga `.env.local`.** `drizzle.config.ts` lee `process.env.DATABASE_URL!` sin ningun `dotenv`, y el repo tiene `.env.local` (no `.env`). Sin la variable en el shell falla con `Please provide required params for Postgres driver: [x] url: undefined` - reproducido. **SETUP.md (L18-25) indica correr `pnpm db:migrate` sin decir que exportar la variable.** Un dev nuevo que siga SETUP.md choca con esto. Merece item de deuda propio.

9. **Chequeo de hash, metodo reutilizable:** `sha256(contenido de 0000_baseline.sql)` debe coincidir con el `hash` de `drizzle.__drizzle_migrations`. Si coinciden -> no-op. Si no -> re-aplica y falla. Es el diagnostico de 5 segundos para cualquier entorno.

10. **Fix propuesto (NO implementado, pendiente OK):**
    - **Paso 1, el mas barato y el que mas informa:** agregar `CI: true` (o `2>&1 | tee`) al step `seed` de `e2e.yml`. Un push y un re-run, y el log diria que tabla y que base. Sin esto, cualquier fix es adivinar.
    - **Paso 2, segun lo que diga el error:** si es "relation already exists" -> reconstruir el tracking de la BD de CI o reapuntar el secret `NEON_DATABASE_URL`.
    - **Paso 3, independiente:** hacer que `drizzle.config.ts` cargue dotenv para que `pnpm db:migrate` funcione segun SETUP.md.

11. **NO se pudo confirmar la causa raiz al 100%** porque no hay acceso a la BD del secret de CI. La confirmacion requiere el paso 1. Lo que si es prueba: local funciona, el baseline es no-idempotente, y el proyecto ya documento este modo de fallo exacto.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
