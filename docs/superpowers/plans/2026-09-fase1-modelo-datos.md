# Plan de Fase 1 — Modelo de datos (plans, subscriptions, tenant_mp_config)

**Fecha:** 2026-09-17
**Autor:** EdgarVz
**Estado:** Para revisión (luisavilaland)
**Estimación:** 5-6 días hábiles (con paralelización de tracks)

> **Referencias obligatorias:**
>
> - Blueprint v2.6: `docs/superpowers/specs/2026-09-blueprint-v2.6.md` (sección "Fase 1 — Modelo de datos")
> - ADR-023: `docs/adr/ADR-023-dos-flujos-mp.md`
> - ADR-024: `docs/adr/ADR-024-pgcrypto-tokens.md` (incluye enmienda 2026-09-18 sobre mecanismo de la clave)
> - Spec transversal: `docs/superpowers/specs/2026-09-subscription-lifecycle.md` (secciones 1, 2, 4, 6)
> - AGENTS.md (reglas del proyecto: RLS, con `withTenantContext`, precios en centavos, migraciones inmutables)

---

## 1. Objetivo de la fase

Crear las 3 tablas nuevas del modelo de suscripciones con todas sus garantías de seguridad:

- **`plans`** — catálogo global de los 3 tiers (Starter UYU 2.000, Pro UYU 4.000, Business UYU 8.000). Sin RLS (dato global, como `tenants`).
- **`subscriptions`** — 1 suscripción por tenant, con RLS `tenant_isolation` y las columnas de retención del spec transversal (`expired_at`, `abandoned_at`, `last_processed_payment_id`).
- **`tenant_mp_config`** — credenciales MP del tenant **cifradas con pgcrypto** (BYTEA) según ADR-024, con RLS `tenant_isolation`.

Además: migración Drizzle inmutable aplicada en Neon (estrategia backup-first, ver T8), seed de los 3 planes, y migración de los tenants existentes (`tienda1`, `tienda2`) a suscripción activa.

## 2. Alcance

> **Decisión consciente de Fase 1:** una sola branch en Neon (`production`). El proyecto no tiene tenants reales ni tráfico, así que el riesgo de aplicar migraciones directo es bajo. Se documenta como deuda técnica reevaluar branching antes de Fase 3.

### Qué entra

- `CREATE EXTENSION IF NOT EXISTS pgcrypto` en Neon (rol owner, `DATABASE_URL`).
- Schema Drizzle para las 3 tablas en `packages/db/src/schema.ts`.
- Migración generada con `pnpm db:generate` (3 `CREATE TABLE`; snapshot + `_journal.json` intacto y consistente).
- RLS (`ENABLE` + `FORCE` + policy `tenant_isolation`) en `subscriptions` y `tenant_mp_config` como migración manual **post-generación** (patrón `0009_enable_rls.sql` / `0010_force_rls.sql`).
- Helper de cifrado/descifrado pgcrypto (encrypt/decrypt roundtrip) en `@repo/commerce`, exportado como `@repo/commerce/encryption`, con la clave como **bind param directo** (enmienda ADR-024) y `MP_TOKEN_ENCRYPTION_KEY` required.
- Migración aplicada con `pnpm db:migrate` en Neon (estrategia backup-first: backup previo + revisión del SQL, ver T8).
- Seed de los 3 planes (idempotente, `onConflictDoNothing` por `slug`).
- Suscripciones activas para `tienda1` (plan `starter`) y `tienda2` (plan `business`).
- `MP_TOKEN_ENCRYPTION_KEY` (required) y `MP_PLATFORM_ACCESS_TOKEN` / `MP_PLATFORM_WEBHOOK_SECRET` (**opcionales en Fase 1**, required en Fase 2 — ver §6 R6) en `.env.local.example` + validación Zod en `packages/validation/src/env.ts` + Vercel.
- Tests: unitarios + integración (RLS cross-tenant, roundtrip de cifrado, schema types).
- Actualización de `bitacora.md`, `AGENTS.md` (si aplica) y `README.md` (si aplica).

### Qué NO entra (Fases 2+)

- **Webhook de suscripciones** (`/api/webhooks/mercadopago/subscriptions/:tenantId`) → Fase 2.
- **Checkout dinámico** con `tenant_mp_config.access_token` → Fase 2.
- **Landing / registro autoservicio / rate limiting** → Fase 3.
- **Panel de admin bloqueado por status** (middleware) → Fase 3.
- **Emails del ciclo de suscripción** → Fases 2-3 (la spec transversal se aplicará ahí).
- **Crons** (transiciones `past_due`/`expired`/`abandoned`, purga 90 días) → Fase 2.
- **Cambio de plan con prorrateo** → Fase 2.
- No se borra la columna legacy `tenants.plan` (se deja intacta). **Depreciación:** se eliminará en una migración posterior cuando todos los tenants tengan suscripción activa (**después de Fase 3**); no se agenda en esta fase (ver T10).

## 3. Dependencias

### Documentales

- Blueprint v2.6 → definición de tiers, Fase 1, env vars nuevas.
- ADR-023 → dos flujos MP: `MP_PLATFORM_ACCESS_TOKEN`, `MP_PLATFORM_WEBHOOK_SECRET`.
- ADR-024 → cifrado `pgp_sym_encrypt`/`pgp_sym_decrypt`, columnas BYTEA, `MP_TOKEN_ENCRYPTION_KEY` (base64 32 bytes, `openssl rand -base64 32`). **Enmienda 2026-09-18:** la clave se pasa como bind param directo, no `SET LOCAL`.
- Spec transversal → columnas `expired_at`, `abandoned_at`, `last_processed_payment_id` (sección 4), estados de la máquina de estados (sección 1), idempotencia (sección 6).

### Infraestructura

- Extensión `pgcrypto` habilitada en Neon (solo puede crearla el rol owner `neondb_owner`, nunca `app_user`).
- `MP_TOKEN_ENCRYPTION_KEY` creada en Vercel (todas las apps). `MP_PLATFORM_ACCESS_TOKEN` / `MP_PLATFORM_WEBHOOK_SECRET`: opcionales en Fase 1 (se usan recién en Fase 2); se recomienda setearlas ahora para no arrastrar deuda de infra.
- `DATABASE_APP_URL` (rol `app_user`, sin `BYPASSRLS`) disponible y funcional.

### Código existente

- `packages/db/src/schema.ts` — patrón de tablas Drizzle (camelCase, índices nombrados, `timestamptz`).
- `packages/db/migrations/0009_enable_rls.sql` y `0010_force_rls.sql` — patrón de RLS manual a replicar (después de la generación).
- `packages/db/src/index.ts` — `withTenantContext(tenantId, cb)` obligatorio para cualquier query a tablas con RLS.
- `packages/db/seed.ts` — seed actual (trunca todo, crea `tienda1`/`tienda2`); se extiende sin romper datos.
- `packages/validation/src/env.ts` — validación Zod de env vars (`MP_TOKEN_ENCRYPTION_KEY` required; `MP_PLATFORM_*` opcionales en Fase 1).
- `packages/commerce/src/index.ts` — patrón de exports + subpath (`./encryption`).

## 4. Tareas atómicas (máximo 1 día cada una)

> Convención de nomenclatura de tablas/columnas Drizzle: `dbPlans`, `dbSubscriptions`, `dbTenantMpConfig`; columnas camelCase (`accessTokenEnc`, `currentPeriodEnd`, `expiredAt`, `abandonedAt`, `lastProcessedPaymentId`). UI/mensajes en español; logs en inglés.
>
> **Orden crítico:** T5 (generar `CREATE TABLE`) **antes** que T7 (RLS manual). La migración RLS hace `ALTER TABLE` sobre tablas que T5 crea; si se invirtiera, falla con `relation does not exist`.

---

### T1 — Verificar pgcrypto habilitado en Neon

**Descripción:** Con el rol owner (`DATABASE_URL`), verificar que la extensión `pgcrypto` esté disponible y habilitada en la base; crearla si falta. Si `pgcrypto` ya está activa, solo confirmar.

**Archivos:** ninguno (operación de DB vía psql; usar `psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='pgcrypto';"`).

**DoD:**

- `SELECT extname FROM pg_extension WHERE extname='pgcrypto'` devuelve 1 fila.
- `SELECT pgp_sym_encrypt('test','clave') IS NOT NULL` ejecuta sin error (sanity check).
- Confirmado que la extensión se creó con el rol owner y NO con `app_user`.

**Tests:** ninguno (verificación manual de infraestructura registrada en bitácora).

---

### T2 — Agregar tabla `plans` al schema Drizzle

**Descripción:** Definir `dbPlans` en `packages/db/src/schema.ts`: catálogo global **sin RLS**. Campos según tiers del blueprint. **Precios en centavos** (UYU 2.000 → `200000`, 4.000 → `400000`, 8.000 → `800000`). Límites: `productLimit`, `variantLimitPerProduct`, `adminLimit`, `templateCount`, `subscriberLimit` (NULL = sin límite), `features` (JSONB), `isActive`.

**Archivos:**

- `packages/db/src/schema.ts` (tabla + tipos `Plan`/`NewPlan`)

**DoD:**

- `dbPlans` exportada y tipada (schema test verde).
- Índice único en `slug`.
- `priceUyu` es `integer` (centavos), documentado en el schema.
- No tiene `tenantId` (sin RLS) — verificado por revisión.

**Tests:** `packages/db/src/__tests__/schema.test.ts` (nuevo `describe('plans table')` con columnas esperadas).

---

### T3 — Agregar tabla `subscriptions` al schema Drizzle

**Descripción:** Definir `dbSubscriptions` con las columnas del spec transversal (sección 4) más la máquina de estados (secciones 1-2). FK a `tenants` (`ON DELETE CASCADE`) y a `plans`. Índice único por `tenantId` (1 suscripción por tenant).

**Archivos:**

- `packages/db/src/schema.ts` (tabla + tipos `Subscription`/`NewSubscription`)

**DoD:**

- Columnas presentes: `tenantId` NOT NULL, `planId` NOT NULL, `status` (default `'pending_first_payment'`), `currentPeriodEnd` TIMESTAMPTZ (nullable), `mpPreapprovalId` TEXT NULL, `expiredAt` TIMESTAMPTZ NULL, `abandonedAt` TIMESTAMPTZ NULL, `lastProcessedPaymentId` TEXT NULL, `createdAt`/`updatedAt` TIMESTAMPTZ.
- **Nota:** `currentPeriodEnd` es NULL mientras la suscripción está en estado `pending_first_payment`. Se setea a `now() + 1 month` al recibir el primer `payment.created` (transición a `active`).
- Índice único en `tenantId`; índice en `(status)` para crons futuros.
- FK `tenant_id → tenants.id ON DELETE CASCADE` y `plan_id → plans.id`.
- No hay `updatedAt` automático fancy: `expiredAt`/`abandonedAt` se setean solo en transición (documentado).

**Tests:** `schema.test.ts` (`describe('subscriptions table')`).

---

### T4 — Agregar tabla `tenant_mp_config` al schema Drizzle

**Descripción:** Definir `dbTenantMpConfig` con columnas **BYTEA** `accessTokenEnc` y `webhookSecretEnc` según ADR-024. 1 fila por tenant (índice único en `tenantId`). FK a `tenants` `ON DELETE CASCADE`.

**Archivos:**

- `packages/db/src/schema.ts` (tabla + tipos `TenantMpConfig`/`NewTenantMpConfig`)

**DoD:**

- Columnas: `tenantId` NOT NULL, `accessTokenEnc` `bytea` NOT NULL, `webhookSecretEnc` `bytea` NOT NULL, `createdAt`/`updatedAt`.
- NUNCA se define columna de texto plano para tokens (revisión: no debe existir `accessToken` sin sufijo `Enc`).
- Índice único en `tenantId`.
- Import de `bytea` desde `drizzle-orm/pg-core`.

**Tests:** `schema.test.ts` (`describe('tenant_mp_config table')`).

---

### T5 — Generar migración con `pnpm db:generate`

**Descripción:** Con las 3 tablas en el schema (T2-T4), correr `pnpm db:generate` para producir la migración automática + snapshot. Genera **solo los `CREATE TABLE`**; la RLS se agrega aparte en T7 (después, respetando la inmutabilidad). Probar en local (o en la única branch de Neon con backup previo) para confirmar que no rompe migraciones previas.

**Archivos:**

- `packages/db/migrations/00XX_*.sql` (generado)
- `packages/db/migrations/meta/00XX_snapshot.json` (generado)
- `packages/db/migrations/meta/_journal.json` (actualizado por drizzle)

**DoD:**

- `pnpm db:generate` termina sin errores.
- Se generan 3 `CREATE TABLE` (plans, subscriptions, tenant_mp_config) y ningún `ALTER` destructivo sobre tablas existentes.
- `_journal.json` no perdió entradas previas (idx continuos).
- Snapshot nuevo incluido y el diff contra el snapshot anterior es solo de las 3 tablas nuevas.
- La migración RLS manual (T7) se agrega **después** de esta como archivo separado, sin tocar este archivo (inmutabilidad).

**Tests:** ninguno unitario; validación de consistencia del journal (verificación manual del diff).

---

### T6 — Helper de cifrado/descifrado pgcrypto en `@repo/commerce`

**Descripción:** Crear `packages/commerce/src/encryption.ts` con funciones nombradas (`export function encryptToken`, `export function decryptToken`) que usan `withTenantContext(tenantId, cb)` y SQL con `pgp_sym_encrypt`/`pgp_sym_decrypt`. La clave (`MP_TOKEN_ENCRYPTION_KEY`) viaja como **parámetro bind directo** a la función pgcrypto (nunca interpolada ni logueada). **Decisión final:** bind param directo, NO `SET LOCAL` ni `set_config` (enmienda 2026-09-18 de ADR-024). Si la env var falta → throw claro ("MP_TOKEN_ENCRYPTION_KEY requirida") — es dato crítico, no degradable (distinto de R2/Resend).

**Archivos:**

- `packages/commerce/src/encryption.ts` (nuevo)
- `packages/commerce/src/index.ts` (export subpath `./encryption`)
- `packages/commerce/package.json` (export map `./encryption`)

**DoD:**

- `encryptToken(tenantId, value)` → escribe (upsert) `accessTokenEnc`/`webhookSecretEnc` cifrados.
- `decryptToken(tenantId, column)` → devuelve texto plano solo en memoria, nunca se loguea.
- La clave se obtiene de `process.env.MP_TOKEN_ENCRYPTION_KEY`; ausencia → `throw` en español coherente con los validados de env.
- El SQL emitido usa la clave como bind param (`pgp_sym_encrypt($1, $2)`), nunca en el texto.
- Sin `any`; sin `console.log` (usar `@repo/logger`).

**Tests:** T12 (roundtrip + ausencia de clave + SQL con binds).

---

### T7 — Aplicar RLS en `subscriptions` y `tenant_mp_config` (post-generación)

**Descripción:** Como las tablas ya existen (T5 generó los `CREATE TABLE`), corre la migración manual SQL (patrón `0009`/`0010`): `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, y `CREATE POLICY tenant_isolation USING ("tenantId" = current_setting('app.tenant_id', true)::UUID)`. Se agrega como archivo `.sql` numerado **después** de la generada en T5 y se registra en `_journal.json`. `plans` **no** recibe RLS.

**Archivos:**

- `packages/db/migrations/00XX_*_rls_subscriptions_mpconfig.sql` (nuevo, numeración siguiente a la de T5)
- `packages/db/migrations/meta/_journal.json` (entrada nueva, `when` en ms UTC)

**DoD:**

- Archivo SQL con `ENABLE` + `FORCE` + policy en ambas tablas; `plans` NO recibe RLS.
- Al correr `pnpm db:migrate`, T5 (CREATE TABLEs) corre antes que T7 (RLS) por orden del journal — sin errores `relation does not exist`.
- `_journal.json` incluye la nueva entrada sin modificar las existentes ni la generada en T5 (migraciones inmutables); idx continuo.
- Verificado en Neon: `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('subscriptions','tenant_mp_config')` → ambas `true`.
- Query con `withTenantContext(tenantA)` no ve filas de `tenantB` (ver T11).

**Tests:** T11 (integración cross-tenant) valida esta tarea; aquí solo el SQL.

---

### T8 — Aplicar migración en Neon (backup-first)

**Descripción:** Solo existe una branch en Neon (`production`, decisión consciente de Fase 1), así que no hay branch efímera donde validar. Estrategia **backup-first**:

1. **Backup:** `pg_dump "$DATABASE_URL" > backup-pre-fase1-$(date +%Y%m%d-%H%M%S).sql`
2. **Revisar el SQL de T5/T7 manualmente** (solo `CREATE TABLE` + RLS; sin `ALTER` destructivos sobre tablas existentes).
3. **Correr `pnpm db:migrate`** (aplica T5 + T7 en orden).
4. **Smoke tests** (queries manuales, sección 7).
5. **Si falla:** restaurar con `psql "$DATABASE_URL" < backup-pre-fase1-*.sql`

**Archivos:** ninguno (operación de DB).

**DoD:**

- Backup previo generado y verificado (existe, tamaño > 0).
- SQL de T5/T7 revisado manualmente: solo los 3 `CREATE TABLE` + RLS; sin `ALTER` destructivo.
- `pnpm db:migrate` sin errores; `SELECT * FROM plans` devuelve la tabla vacía; `\d subscriptions` muestra columnas BYTEA/state correctas; RLS `true/true`.
- Sin pérdida de datos (`SELECT count(*) FROM tenants` conserva 2 filas).
- `pg_extension` confirma `pgcrypto` activa (de T1).
- **Deuda técnica:** reevaluar branching en Neon (branch `develop` en Neon o ramas efímeras por PR) antes de Fase 3.

**Tests:** smoke manual en Neon (sección 7, Smoke test).

---

### T9 — Seed de los 3 planes (idempotente)

**Descripción:** Extender `packages/db/seed.ts` para insertar los 3 planes con `onConflictDoNothing` (idempotente por `slug`): `starter` (200000), `pro` (400000), `business` (800000). Respeta los tiers y features del blueprint. No borra tenants existentes.

**Archivos:**

- `packages/db/seed.ts`

**DoD:**

- `pnpm db:seed` crea exactamente 3 filas en `plans` (y conserva `tienda1`/`tienda2`).
- Precios almacenados en centavos (200000/400000/800000).
- Correr el seed 2 veces no duplica filas (idempotencia verificada).
- Features por tier machean el blueprint (MP propio, plantillas 0/3/6, suscriptores 250/1000/NULL...).

**Tests:** test unitario de la data de planes (ver sección 7) + verificación manual en Neon.

---

### T10 — Migrar tenants existentes a suscripción activa

**Descripción:** Crear suscripción `active` para `tienda1` (plan `starter` por el valor legacy `tenants.plan`) y `tienda2` (plan `business`). `currentPeriodEnd` = hoy + 1 mes. No se borra ni modifica `tenants.plan`. **Depreciación:** se eliminará en una migración posterior cuando todos los tenants tengan suscripción activa (**después de Fase 3**); no se agenda en esta fase y queda documentado como deuda técnica. Se hace dentro del seed (tras T9) para que también corra en `pnpm db:seed` limpio.

**Archivos:**

- `packages/db/seed.ts`

**DoD:**

- `SELECT t.slug, s.status, p.slug AS plan FROM subscriptions s JOIN tenants t ON t.id=s.tenant_id JOIN plans p ON p.id=s.plan_id` → 2 filas: `tienda1/starter/active`, `tienda2/business/active`.
- Nada más cambia en el seed respecto a la data existente; `tenants.plan` intacto.
- Nota de depreciación de `tenants.plan` registrada (bitácora / TODO en seed).

**Tests:** verificación manual (query anterior) + test de integración del seed si el costo lo permite.

---

### T11 — Tests de RLS cross-tenant (unitario + integración)

**Descripción:** Test que valida el aislamiento real: con `withTenantContext(tenantA)`, insertar/leer en `subscriptions` y `tenant_mp_config` y confirmar que el tenant B no ve ni modifica esas filas. Unitario con `makeTxMock` + integración contra Neon (optativa en CI) o al menos el unitario cubriendo la política.

**Archivos:**

- `packages/db/src/__tests__/rls-cross-tenant.test.ts` (nuevo)
- O integración en `packages/commerce/src/__tests__/`

**DoD:**

- Test unitario verde: mock de `withTenantContext` + assert de la query SQL generada contiene el filtro/policy por tenant.
- Si hay integración: en Neon real, `withTenantContext(tienda1)` inserta una fila de prueba y `withTenantContext(tienda2)` NO la ve ni la puede actualizar; la fila de prueba se limpia después.
- Ninguna query del test usa `db.` directo (solo `tx.` dentro de `withTenantContext`).

**Tests:** este mismo test (éxito + aislamiento + assert 0 filas cross-tenant).

---

### T12 — Tests del helper de cifrado/descifrado

**Descripción:** Roundtrip: `encryptToken` → el valor en DB es BYTEA (no texto plano) → `decryptToken` devuelve el original. Además: ausencia de `MP_TOKEN_ENCRYPTION_KEY` lanza error claro; el SQL generado usa parámetros bind (la clave no aparece en el texto).

**Archivos:**

- `packages/commerce/src/__tests__/encryption.test.ts` (nuevo)

**DoD:**

- `decryptToken(encryptToken(v)) === v` para valores de prueba MP (`APP_USR-...`, `WHSEC-...`).
- Test que la clave no aparece en el SQL emitido/logueado.
- Sin clave → `expect(() => ...).toThrow(...)` con mensaje de error claro.

**Tests:** este archivo (describe con roundtrip + fallback).

---

### T13 — Env vars: `.env.local.example`, Zod, Vercel

**Descripción:** Agregar las 3 variables al `.env.local.example` (con comentario de generación `openssl rand -base64 32`) y a la validación Zod de `packages/validation/src/env.ts`:

- `MP_TOKEN_ENCRYPTION_KEY` (todas las apps) → **REQUIRED en Fase 1** (la usa el helper de cifrado, T6). Sin ella, la app no arranca (Zod) y el helper tira throw.
- `MP_PLATFORM_ACCESS_TOKEN` (todas las apps) y `MP_PLATFORM_WEBHOOK_SECRET` (storefront) → **OPCIONALES en Fase 1** (no se usan hasta Fase 2). En Zod quedan `.optional()` ahora; el plan de Fase 2 los pasa a required. Se recomienda setearlas en Vercel durante esta fase para no arrastrar deuda de infra.

Documentar la creación en Vercel (production/development/preview).

**Archivos:**

- `.env.local.example`
- `packages/validation/src/env.ts`
- (solo documentación del paso manual en Vercel)

**DoD:**

- Las 3 variables presentes en `.env.local.example` con instrucción de generación.
- `env.ts`: `MP_TOKEN_ENCRYPTION_KEY` required (patrón existente: app falla al boot si falta en producción); `MP_PLATFORM_*` opcionales (comentario "required en Fase 2").
- Nota en bitácora: procedimiento de set en Vercel y qué pasa si se pierde `MP_TOKEN_ENCRYPTION_KEY` (los tenants deben re-ingresar credenciales — ADR-024).

**Tests:** `packages/validation` tests de env (si existen; si no, verificación de tipo + manual).

---

### T14 — Bitácora, AGENTS.md, README

**Descripción:** Actualizar `bitacora.md` (Fase 1: tablas, cifrado, RLS, riesgos, decisión de bind param ADR-024). Proponer a AGENTS.md una línea sobre `MP_TOKEN_ENCRYPTION_KEY` crítica y separación flujos MP si aplica. Sugerir cambios de README a luisavilaland si hay info de setup nueva.

**Archivos:**

- `bitacora.md`
- (AGENTS.md / README.md solo si aplica; aplicar solo con confirmación)

**DoD:**

- Entrada de bitácora del 2026-09-17 con: tablas creadas, RLS aplicada, pgcrypto activo, env vars nuevas, riesgo de pérdida de clave documentado, decisión final de bind param (enmienda ADR-024) y depreciación futura de `tenants.plan` (post-Fase 3).
- AGENTS.md/README no modificados sin confirmación (regla de mantenimiento de docs).

**Tests:** ninguno.

---

## 5. Orden de ejecución

### Grafo de dependencias

```
T1 pgcrypto ──────────────────────────────┐
T13 env vars (paralelo total) ────────────┤
                                         │
T2 plans ──┐                              │
T3 subs ───┼──► T5 db:generate ──► T7 RLS │
T4 mp_cfg ─┘         │                manual
                      │                  │
T6 helper (paralelo a T5) ───────────────┤
                                         │
                                         ▼
                              T8 migrate Neon
                              (backup-first)
                                  │       │
                     ┌────────────┼───────┼────────────┐
                     ▼            ▼       ▼            ▼
                  T9 seed     T10 susc   T11 RLS     T12 crypto
                  planes      tenants    tests        tests
                     │            │       │            │
                     └────────────┴───────┴────────────┘
                                         ▼
                                     T14 docs ────── fin
```

**Dependencias clave:**

- T5 depende de T2+T3+T4 (las 3 tablas en el schema).
- **T7 depende de T5** (las tablas existen antes de los `ALTER TABLE` de RLS). T7 NO puede correr antes.
- T8 depende de T5+T7+T1; T9/T10/T11/T12 dependen de T8 (BD migrada).
- T6 puede ir en paralelo con T5/T7 (es código; su integración T12 espera T8).
- T13 dependencia libre; T14 cierra al final.

### Paralelización recomendada (2 personas)

- **EdgarVz:** T1 → T2 → T3 → T5 → T7 → T8 → T9 → T10 → T14 (camino crítico del modelo).
- **Luisavilaland (si asiste en implementation):** T4 → T6 → T12 en paralelo con T3. T13 y T11 son independientes del camino crítico y se reparten.

### Secuencial puro (1 persona)

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14. El orden indicado respeta el grafo; T6 y T13 son reubicables mientras respeten sus dependencias.

> **No hay ciclos:** todo depende estrictamente de nodos ya completados (ver grafo). El camino crítico nunca espera por sí mismo.

## 6. Riesgos específicos

| #   | Riesgo                                                                                                                                  | Impacto                                                                                    | Mitigación                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **RLS mal aplicado** (falta `FORCE`, policy sin `current_setting` correcto, o se aplica RLS de más a `plans`)                           | Fuga de datos cross-tenant o queries devolviendo 0 filas                                   | Test T11 cross-tenant obligatorio. Revisión humana de la migración RLS (T7) antes de merge. Verificar `relforcerowsecurity` en Neon.                                                                                                                                                                             |
| R2  | **pgcrypto mal configurado** (extensión creada con `app_user`, o falta en la única branch `production`)                                 | `pgp_sym_encrypt` falla en runtime → checkout/registro roto en Fase 2                      | T1 verifica extensión con rol owner antes de aplicar migraciones (T8). Smoke test de `pgp_sym_encrypt` en T1 y T8.                                                                                                                                                                                               |
| R3  | **Migración que rompe `_journal.json` o snapshots** (idx salteado, snapshot faltante, o RLS manual corrida antes de los `CREATE TABLE`) | `pnpm db:migrate` falla o deja la BD en estado inconsistente                               | Backup manual + revisión del SQL emitido antes de `db:migrate` (T8); si falla, restaurar con `psql`. Nunca modificar migraciones existentes. La RLS manual (T7) se numera **después** de la generada (T5); si drizzle-kit la saltea del journal, agregar la entrada manual con idx continuo y `when` UTC válido. |
| R4  | **Pérdida de `MP_TOKEN_ENCRYPTION_KEY`**                                                                                                | Imposible descifrar tokens de tenants → deben re-ingresar credenciales                     | Documentar en bitácora (T14) y en `.env.local.example`. La clave se genera con `openssl rand -base64 32` y se guarda solo en Vercel/gestor de secrets nunca en el repo.                                                                                                                                          |
| R5  | **Seed que toca datos existentes** (trunca tenants, duplica planes)                                                                     | Datos de dev perdidos / seed no idempotente                                                | Seed de planes con `onConflictDoNothing` por `slug`. Nunca `TRUNCATE tenants` en esta fase (se conservan las 2 filas existentes). Correr seed 2 veces en DoD de T9.                                                                                                                                              |
| R6  | _\*Env vars MP_PLATFORM_* sin setear_*                                                                                                  | No bloquea Fase 1 (son opcionales); bloquea Fase 2 (webhook suscripciones) si no se setean | En Fase 1 quedan `.optional()` en Zod; el plan de Fase 2 los marca required y su DoD incluye el checklist de Vercel. Se recomienda setearlas en Fase 1. `MP_TOKEN_ENCRYPTION_KEY` (required) valida al boot.                                                                                                     |
| R7  | **Precios en pesos en vez de centavos**                                                                                                 | Inconsistencia con el resto de la plataforma (órdenes en centavos)                         | Decisión explícita en T2/T9: `priceUyu` entero en centavos (200000/400000/800000), documentado.                                                                                                                                                                                                                  |
| R8  | **Tokens en texto plano** (columna mal nombrada o helper sin cifrar)                                                                    | Fuga de credenciales MP ante backup/log                                                    | Revisión humana exigida en T4 (no debe existir columna sin sufijo `Enc`). Helper siempre cifra antes de persistir (T6).                                                                                                                                                                                          |
| R9  | **`tenants.plan` se depreca antes de tiempo**                                                                                           | Lectura legacy rota o seed inconsistente                                                   | La columna queda intacta en Fase 1-3; su borrado se agenda en migración posterior a Fase 3 (documentado en T10/T14).                                                                                                                                                                                             |

## 7. Plan de tests

### Unitarios (vitest)

| Test              | Archivo                                              | Qué valida                                                                                    |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Schema types      | `packages/db/src/__tests__/schema.test.ts`           | `dbPlans`, `dbSubscriptions`, `dbTenantMpConfig` exportadas con columnas esperadas (T2/T3/T4) |
| Cifrado roundtrip | `packages/commerce/src/__tests__/encryption.test.ts` | `encryptToken` → BYTEA → `decryptToken` devuelve el original (T12)                            |
| Cifrado sin clave | ídem                                                 | Ausencia de `MP_TOKEN_ENCRYPTION_KEY` lanza error claro (T12)                                 |
| SQL con binds     | ídem                                                 | La clave no aparece en el SQL emitido (T12)                                                   |
| Data de planes    | test del seed o data module                          | 3 planes, slugs correctos, precios en centavos, features por tier (T9)                        |

### Integración (Neon)

| Test                               | Qué valida                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| RLS cross-tenant (T11)             | `withTenantContext(tienda1)` no ve/edita filas de `tienda2` en `subscriptions` y `tenant_mp_config`; filas de prueba limpiadas al final |
| Cifrado real (T12, optativa en CI) | Roundtrip contra Neon real con `pgcrypto`                                                                                               |

### Smoke test (manual en Neon, después de T8/T9)

```sql
-- 1. Extension
SELECT extname FROM pg_extension WHERE extname='pgcrypto';

-- 2. Tablas
SELECT tablename FROM pg_tables WHERE schemaname='public'
  AND tablename IN ('plans','subscriptions','tenant_mp_config');

-- 3. RLS activa
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname IN ('subscriptions','tenant_mp_config');

-- 4. Seed de planes (post-T9)
SELECT slug, name, priceUyu FROM plans ORDER BY priceUyu;

-- 5. Suscripciones de tenants existentes (post-T10)
SELECT t.slug, s.status, p.slug AS plan FROM subscriptions s
  JOIN tenants t ON t.id = s.tenant_id
  JOIN plans p ON p.id = s.plan_id;
```

## 8. Guía de revisión (para luisavilaland)

> Este PR toca seguridad de datos (RLS + cifrado). Revisar en el orden de la checklist. Vas a necesitar acceso de lectura a la consola de Neon y las credenciales de la única branch (`production`).

### Qué mirar en el PR

- [ ] **1. Schema (T2/T3/T4):**
  - [ ] `plans` sin `tenantId` (es global), `priceUyu` entero en centavos.
  - [ ] `subscriptions` con `expiredAt`, `abandonedAt`, `lastProcessedPaymentId` (spec transversal §4) y sin "updatedAt improvisado" usado como fecha de expiración.
  - [ ] `tenant_mp_config` SOLO columnas `*Enc` (BYTEA). Si ves `access_token` o `webhook_secret` sin cifrar → es red flag grave.
- [ ] **2. Migración generada (T5):** `pnpm db:generate` produjo SOLO 3 `CREATE TABLE`; `_journal.json` no perdió entradas; no se modificó ninguna migración existente (git diff no debe tocar `000x` previas). La RLS manual (T7) queda numerada DESPUÉS en el journal.
- [ ] **3. RLS (T7):** la migración incluye `ENABLE`, `FORCE` y policy `tenant_isolation` para `subscriptions` y `tenant_mp_config`. `plans` NO debe tener RLS. Esta migración corre después de los `CREATE TABLE`, no antes.
- [ ] **4. Helper cifrado (T6):** usa `withTenantContext`, la clave viaja como **bind param directo** a `pgp_sym_encrypt`/`pgp_sym_decrypt` (enmienda ADR-024, no `SET LOCAL`), no hay `console.log` del valor descifrado, sin clave → error claro.
- [ ] **5. Seed (T9/T10):** idempotente (correr 2 veces no duplica), precios en centavos, `tienda1`/`tienda2` ya tienen suscripción `active`, `tenants.plan` intacto con nota de depreciación post-Fase 3.
- [ ] **6. Tests:** T11 (cross-tenant) y T12 (roundtrip) presentes y verdes.
- [ ] **7. Env (T13):** `MP_TOKEN_ENCRYPTION_KEY` required + `MP_PLATFORM_*` opcionales (Fase 1, required en Fase 2) en `.env.local.example` + Zod.

### Comandos para verificar localmente

```bash
pnpm db:generate   # no debe producir ALTER sobre tablas existentes
pnpm db:migrate    # única branch: backup manual antes, restaurar si falla
pnpm db:seed       # 2 veces seguidas para probar idempotencia
pnpm lint && pnpm typecheck && pnpm test
```

### Queries SQL para verificar RLS en Neon

```sql
-- A: las tablas tienen RLS activa y forzada
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname IN ('subscriptions','tenant_mp_config','plans');
-- Esperado: subscriptions y tenant_mp_config = (true,true); plans = (false,false)

-- B: prueba real de aislamiento (usar con rol app_user, NO neondb_owner)
BEGIN;
SELECT set_tenant_id('<uuid tienda1>');
SELECT count(*) FROM subscriptions WHERE "tenantId" = '<uuid tienda2>';  -- debe ser 0
SELECT count(*) FROM subscriptions WHERE "tenantId" = '<uuid tienda1>';  -- debe ser 1
ROLLBACK;
```

> Para que la prueba B tenga fuerza, conectarse con `DATABASE_APP_URL` (rol `app_user`, sin `BYPASSRLS`). Si te conectás con `neondb_owner`, RLS se saltea y el test dará "falso verde".

### Cómo validar el cifrado

```sql
-- Con MP_TOKEN_ENCRYPTION_KEY local (o la de dev), probar roundtrip:
SELECT pgp_sym_decrypt(
  pgp_sym_encrypt('APP_USR-test', '<clave>'),
  '<clave>'
) = 'APP_USR-test' AS roundtrip_ok;   -- debe devolver true

-- Con la app: fixtures o test unitario de @repo/commerce/encryption
-- (encrypt → decrypt = idéntico; el valor en DB es BYTEA binario, no legible).
```

### Red flags comunes

- ❌ Una policy RLS `USING (true)` o sin `FORCE` → aislamiento inexistente.
- ❌ Migración RLS ubicada **antes** que la generada (`ALTER TABLE` sobre tabla inexistente).
- ❌ Columnas `notNull` faltantes (ej. `status`, `tenantId`, `accessTokenEnc`).
- ❌ `CREATE TABLE` sin `REFERENCES tenants` con `ON DELETE CASCADE` donde corresponde.
- ❌ Migración generada que incluye `ALTER ... DROP COLUMN` o toca tablas existentes.
- ❌ `_journal.json` con `idx` saltados o sin snapshot nuevo.
- ❌ `getServerSession` apareciendo en código que debe ir al token/claims (irrelevante en esta fase, pero evitar).
- ❌ Clave interpolada en el texto SQL, o uso de `SET LOCAL`/`set_config` (decisión final: bind param directo — enmienda ADR-024).
- ❌ `MP_PLATFORM_*` marcadas required en Fase 1 (deben quedar opcionales; required recién en Fase 2).
- ❌ Fog: cualquier `console.log` de token o `SELECT *` de `tenant_mp_config` en tests/scripts que imprima el ciphertext.

## 9. Estimación total

- **Con paralelización (2 personas, tracks independientes):** ~5 días hábiles.
- **Secuencial (1 persona):** ~6 días hábiles.
- Proyección respeta el techo del blueprint (Fase 1 estimada 2-3 días en 2-3 pers.) considerando granularidad fina + tests obligatorios de RLS y cifrado.

Desglose por track (paralelo):

| Track                | Tareas                               | Días |
| -------------------- | ------------------------------------ | ---- |
| Modelo (EdgarVz)     | T1, T2, T3, T5, T7, T8, T9, T10, T14 | 4.5  |
| Cifrado (paralelo)   | T4, T6, T12                          | 2    |
| Garantías (paralelo) | T11, T13                             | 1.5  |

## 10. Criterio de cierre de fase

- [ ] `plans`, `subscriptions`, `tenant_mp_config` creadas en el schema Drizzle (T2/T3/T4) con tests de schema verdes.
- [ ] `pnpm db:generate` produjo migración mínima (solo 3 `CREATE TABLE`) y `_journal.json` consistente; la RLS manual queda numerada después (T5).
- [ ] RLS `ENABLE` + `FORCE` + policy `tenant_isolation` aplicada en `subscriptions` y `tenant_mp_config`; `plans` sin RLS (T7).
- [ ] Test cross-tenant (T11) verde: tenant A no ve ni modifica filas de tenant B.
- [ ] Helper de cifrado (T6) con roundtrip verde (T12); tokens almacenados como BYTEA; la clave nunca aparece en texto SQL ni logs.
- [ ] Migración aplicada en Neon: estrategia backup-first (backup con `pg_dump` + revisión del SQL) sin pérdida de datos; si falla, restauración con `psql` (T8).
- [ ] Decisión de branching en Neon registrada en docs/deuda-tecnica.md con fecha de reevaluación (post-Fase 3).
- [ ] Seed idempotente con los 3 planes en centavos (T9) y suscripciones `active` para `tienda1` (starter) y `tienda2` (business) (T10); `tenants.plan` intacto con nota de depreciación post-Fase 3.
- [ ] `MP_TOKEN_ENCRYPTION_KEY` required + `MP_PLATFORM_*` opcionales (Fase 1) en `.env.local.example` + Zod (T13).
- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test` pasan en CI (DoD global).
- [ ] Bitácora actualizada (T14); AGENTS.md/README solo con confirmación.

**Próximo paso:** Fase 2 — Webhook de suscripciones + checkout dinámico (referencia spec transversal §6).
