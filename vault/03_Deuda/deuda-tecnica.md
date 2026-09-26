# Deuda técnica — planes pendientes

> Documentación de deuda técnica identificada al 2026-08-08 (plan aprobado, ítem 3).
> **Estado: ítems 1, 2 y 3 implementados (2026-08-10 y 2026-08-11).**

---

## 1. TOCTOU en stock de checkout (time-of-check to time-of-use) — ✅ IMPLEMENTADO (2026-08-10)

**Contexto real:** `apps/storefront/app/api/checkout/route.ts` dentro de `withTenantContext`:

1. Lee stock de las variantes (`tx.select` de `dbProductVariants`, líneas ~85-98).
2. Valida stock suficiente contra el valor leído (líneas ~104-108).
3. Decrementa con `tx.update(...).set({ stock: (variant.stock ?? 0) - item.quantity })` (líneas ~169-182).

El decremento calcula el valor nuevo a partir del leído (**no `stock - qty` atómico en SQL**) y no hay `SELECT ... FOR UPDATE` ni lock: dos órdenes concurrentes pueden leer el mismo stock, pasar la validación ambas, y la segunda sobrescribe el stock con un decremento sobre un valor viejo → **oversell**.

**Plan propuesto (no implementado):**

- Opción A (recomendada): reemplazar el `update ... set({ stock: X })` por un UPDATE atómico condicional:

  ```ts
  const result = await tx
    .update(dbProductVariants)
    .set({ stock: sql`${dbProductVariants.stock} - ${item.quantity}` })
    .where(
      and(
        eq(dbProductVariants.id, item.variantId),
        eq(dbProductVariants.tenantId, tenantIdFromSlug),
        gte(dbProductVariants.stock, item.quantity),
      ),
    )
  ```

  — y validar `result.rowCount === 1` por ítem; si hay 0, abortar la transacción con "Stock insuficiente". Como todo corre dentro de `withTenantContext` (transacción real), el rollback es automático si un ítem falla.

- Opción B: `SELECT ... FOR UPDATE` de las variantes al inicio del bloque, dentro de la misma transacción, y validar sobre esos valores lockeados (el `FOR UPDATE` se serializa correctamente entre transacciones concurrentes).

**Criterios de aceptación:**

- Test de concurrencia (o al menos unitario que valide el `WHERE gte` y el `rowCount`): dos flujos simultáneos sobre la misma variante con stock justo → solo uno completa; sin stock negativo tras ambos.
- Unit test sobre el SQL atómico con `makeTxMock` configurado con `rowCount` (patrón AGENTS.md → Helpers de test).

**Archivos a tocar:** `apps/storefront/app/api/checkout/route.ts` (+ su `__tests__/route.test.ts`).

**Implementación (2026-08-10, rama `fix/toctou-checkout-products`):**

- **Checkout** (commit `9e7a518`, `apps/storefront/app/api/checkout/route.ts`): decremento atómico con `sql`${dbProductVariants.stock} - ${item.quantity}`` + `gte(dbProductVariants.stock, item.quantity)` en el WHERE, y `.returning({ id })` para detectar 0 filas → se devuelve `{ error: "Stock insuficiente", outOfStock }` (mapeo 422 ya existente en el handler; el contrato HTTP no cambió). Rollback automático de la transacción al abortar.
- **PUT `products/[id]` (misma ventana TOCTOU, fase 1 read → R2 → fase 3 write)** (commit `069f6aa`, `apps/admin/app/api/products/[id]/route.ts`): refetch post-update con `updatedProduct.length === 0` → 409 `{ error: "Producto eliminado durante la actualización" }`; catch de violación de FK `23503` → 409 con el mismo mensaje y `logger.error` con `{ error, productId, tenantId }` (el resto de errores sigue en 500).
- **Tests:** 2 nuevos por fix (checkout: stock exacto + concurrencia con `Promise.all` donde una petición recibe 422; products: 0 filas → 409 + FK 23503 → 409). Suite: 426 → **428** (55 archivos). Verificación anti-revert hecha con `git stash` de cada route.ts: los tests nuevos fallan contra el código revertido.

---

## 2. Política de migraciones inmutables — formalizar en CI

**Contexto real:** AGENTS.md ya establece la regla _“Migraciones de DB inmutables: ante un cambio de schema, genera una nueva migración con `pnpm db:generate`. Jamás modifiques migraciones existentes”_. Hasta ahora es solo una regla de proceso (humana) — no hay guard automatizado.

**Plan propuesto (no implementar ahora):**

1. Script de verificación `packages/db/scripts/check-migrations.sh` (o task de turbo `db:check-migrations`):
   - Compara los archivos `.sql` de `packages/db/migrations` contra el commit base de la rama (ej: `git diff --name-only origin/develop...HEAD -- packages/db/migrations`).
   - Falla si algún `.sql` existente fue **modificado** (no debe permitirse; solo ADD de nuevos archivos).
2. Hook en CI: agregar paso al workflow existente (o job nuevo `db-migrations-check` en `.github/workflows/`) que corre el script en cada PR a `develop`.
3. Opcional: integración con `drizzle-kit generate` — documentar en AGENTS.md que el flujo canónico es `pnpm db:generate` y verificar que no genere diff en migraciones existentes (`git status` limpio después de generate).

**Criterios de aceptación:** un `.sql` viejo modificado a mano → el check falla con mensaje claro; un `.sql` nuevo → pasa. Documentar el comando en SETUP.md → Comandos de Base de Datos.

**Implementación (2026-08-11, rama `chore/quality-and-docs`):**

- Script `scripts/check-migrations.sh` (commit `2ed0703`): `git diff --name-only origin/develop -- packages/db/migrations/`; si el diff no está vacío → `❌ Migración existente modificada — crea una nueva migración, no edites las anteriores.` + exit 1; fail-closed si `origin/develop` no existe localmente.
- CI (`.github/workflows/ci.yml`, mismo commit): `checkout@v7` con `fetch-depth: 0` + step `Guard migraciones inmutables` (`bash scripts/check-migrations.sh`) en el job `build`.
- Las migraciones quedan además excluidas de prettier vía `.prettierignore` (commit `55ad3fb`), para que un formateo masivo no las toque por accidente.

---

## 3. Pin IPv4 del endpoint Neon para el runner self-hosted — ✅ IMPLEMENTADO (2026-08-11)

**Contexto real**: el runner self-hosted de GitHub Actions (AlmaLinux) que corre los E2E no tiene ruta IPv6; el endpoint de Neon publica también AAAA y el rollback DNS puede resolver a IPv6 → fallan las conexiones (ya observado en julio-2026; mitigado ad-hoc con pin en `/etc/hosts`, documentado parcialmente en SETUP.md → E2E).

**Plan propuesto (no implementar ahora):**

- Procedimiento documentado completo:
  1. Resolver la IP IPv4 actual del endpoint: `dig +short A <host>` o `getent ahostsv4 <host-neon>` (ej: `xxxxxxxx.eu-central-1.aws.neon.tech`).
  2. En el runner: `echo "<IP> <host-neon>" >> /etc/hosts` (con el usuario root / sudo).
  3. Verificar conectividad: `psql "$DATABASE_URL" -c "SELECT 1"` o corriendo el e2e webhook (`pnpm --filter root test:e2e`).
  4. Alternativa robusta si Neon lo soporta: usar un endpoint **IPv4-only** / IP allowlist del pool del proyecto para eliminar la dependencia de `/etc/hosts`.

**Riesgos y control:** las IPs de Neon pueden rotar (pool) — si una IP deja de responder y el problema de IPv6 reaparece, el pin debe actualizarse; documentar el rot de IPs como mantenimiento mensual o se ambia a la alternativa IPv4-only.

**Dónde documentar:** SETUP.md → seccion E2E (expandir el bullet actual) y este doc.

**Implementación (2026-08-11, rama `chore/quality-and-docs`):**

- Procedimiento completo documentado en `SETUP.md` → "Runner self-hosted: pin IPv4 de Neon" (commit `30169bd`): diagnóstico, `dig +short A`/`getent ahostsv4`, pin en `/etc/hosts`, verificación con `psql`/E2E, alternativa IPv4-only/allowlist y mantenimiento de rotación de IPs.

---

## 4. Dependencias no declaradas que sobreviven por hoisting del root — ✅ RESUELTO (2026-09-17)

**Contexto real:** durante la limpieza de dependencias muertas (rama `chore/remove-dead-deps`) se detectaron imports que funcionan solo por el hoisting del `node_modules` raíz, sin declaración en el `package.json` del workspace:

- `packages/storage` → importa `minio` (packages/storage/src/index.ts) pero su `package.json` no tenía `dependencies` ni `devDependencies`.
- `apps/storefront` → importa `bcryptjs` (lib/customer-auth.ts, app/api/register/route.ts) sin declararlo (lo declara el root; sobrevive por hoisting).

Riesgo: un futuro cambio de `pnpm.hoistPattern` / instalación sin hoisting / extracción del paquete rompe el import sin aviso. Funcionaba, pero era frágil.

**Implementación (2026-09-17, sesión de verificación post-tarea):**

1. **`packages/storage/package.json`**: agregada `"minio": "^8.0.7"` en `dependencies`.
2. **`apps/storefront/package.json`**: agregada `"bcryptjs": "^3.0.3"` en `dependencies`.
3. **`pnpm install`**: ejecutado para actualizar lockfile.
4. **DoD verificado:** `pnpm lint` 6/6 ✓, `pnpm typecheck` 9/9 ✓, `pnpm build` 3/3 ✓, `pnpm test` 430/430 ✓.

**Criterios de aceptación cumplidos:** imports resuelven desde el workspace que los declara; sin cambios de comportamiento.
---

## 5. Neon single-branch — ✅ DECISIÓN REGISTRADA (2026-09-18)

**Contexto real:** Neon tiene una sola branch (`production`), compartida por local/preview/producción. Todo apunta a la DB de producción.

**Decisión consciente:** aceptable mientras no haya tráfico real. Mitigación de migraciones = backup manual (`pg_dump`) + revisión del SQL emitido antes de `db:migrate`; si algo falla, restaurar con `psql`.

**Reevaluación:** antes de Fase 3 — crear branch `develop` en Neon o usar branches efímeras por PR.

---

## 6. Gaps en _journal.json (pre-existente) — ✅ RESUELTO (2026-09-20)

**Contexto:**
El _journal.json no incluye entradas para varias migraciones:
- 0010_force_rls.sql (salto idx 9 → 11, falta idx 10).
- 0005_add_admin_users.sql (huérfano, no en journal, duplica parcialmente 0005_fluffy_triathlon).
- Snapshots faltantes para idx 3, 4, 9, 10.

**Impacto:**
En entornos frescos (dev/CI/preview), `pnpm db:migrate` solo aplica las migraciones registradas. 0010_force_rls.sql nunca se aplica en esos entornos → FORCE RLS no se activa. Divergencia silenciosa de postura de seguridad con producción (que tiene 0010 aplicada manual).

**Implementación (2026-09-20, rama `chore/fase1-migration-0013`):**
- Migración 0013 idempotente que garantiza FORCE RLS en las 8 tablas existentes en **cualquier entorno** (prod ya forzada, frescos sin forzar).
- Entrada idx 13 agregada a `_journal.json` + `0013_snapshot.json` creado.
- El gap histórico del journal (0005_add_admin_users, 0010_force_rls no registrados) se documenta como decisión consciente: **no reconstruir retroactivamente** (rompería DBs ya migradas al re-aplicar CREATE POLICY sin IF NOT EXISTS). El estado real queda garantizado vía 0013.

**Nota:** "Cubierto por migración 0013 idempotente. El gap histórico del journal (0005, 0010) se documenta como decisión consciente: no reconstruir retroactivamente. El estado real (FORCE RLS en las 8 tablas) queda garantizado en todos los entornos vía 0013."

**Urgencia:** ✅ Resuelto — bloqueante de T7 eliminado.

---

## 7. GRANTs a app_user faltantes en las 3 tablas nuevas — ✅ RESUELTO (2026-09-20)

**Contexto:**
Las tablas plans, subscriptions y tenant_mp_config no tienen GRANT explícito para el rol app_user. Las 10 tablas pre-existentes obtuvieron permisos manualmente en Neon; las 3 nuevas no.

En PostgreSQL, RLS (Row Level Security) y privileges (GRANT) son capas separadas. RLS no otorga privilegios.

**Impacto:**
Cuando T7 aplique FORCE RLS, app_user va a recibir "permission denied" al intentar SELECT/INSERT/UPDATE/DELETE sobre estas 3 tablas. Bloquea checkout (tenant_mp_config), webhooks de suscripciones (subscriptions) y cualquier operación sobre planes.

**Implementación (2026-09-20, rama `chore/fase1-migration-0013`):**
- GRANT SELECT, INSERT, UPDATE, DELETE en plans, subscriptions, tenant_mp_config para app_user (migración 0013).
- ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public: futuras tablas creadas por el owner heredan los GRANTs automáticamente.

**Nota:** "GRANTs aplicados en 0013 + ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner para futuras tablas."

**Urgencia:** ✅ Resuelto — bloqueante de T7 eliminado.

---

## 8. FKs RESTRICT en 5 tablas pre-existentes

**Contexto:**
El spec transversal §4 exige ON DELETE CASCADE desde tenants para products, categories, customers, orders, shipping_methods. El schema actual tiene RESTRICT en esas 5 FKs.

**Impacto:**
El cron de purga (90 días, Fase 2/3) va a fallar al intentar DELETE FROM tenants porque las FKs RESTRICT lo bloquean con FK violation. También rompe el borrado de tenants desde el admin.

**Mitigación:**
- Migración para cambiar las 5 FKs RESTRICT → CASCADE.
- Ejecutar antes de que el cron de purga entre en producción.
- Verificar que el cambio de FK no rompa integridad referencial en datos existentes.

**Urgencia:** 🟡 Antes de Fase 2.

**Fecha de reevaluación:** antes de implementar el cron de purga.

---

## 9. Spec §4 usa snake_case en lugar de camelCase

**Contexto:**
El spec transversal (docs/superpowers/specs/2026-09-subscription-lifecycle.md §4) usa snake_case en sus queries de ejemplo: expired_at, abandoned_at, current_period_end, tenant_id. La BD real usa camelCase (convención del proyecto documentada en AGENTS.md).

**Impacto:**
Cuando se implementen los crons de purga y transiciones de estado (Fase 2/3), copiar queries del spec va a fallar con "column X does not exist". Mismo patrón que el incidente del grep de RLS.

**Mitigación:**
- Corregir el spec §4: reemplazar snake_case por camelCase.
- Verificar que ninguna otra sección use snake_case.
- Incluir esta revisión en el checklist de arranque de Fase 2.

**Urgencia:** 🟡 Antes de Fase 2.

**Fecha de reevaluación:** antes de implementar crons.

---

## 10. Prettier no corre en @repo/db

**Contexto:**
El DoD del proyecto dice "eslint + prettier", pero `pnpm lint` (via turbo) solo ejecuta eslint. @repo/db no tiene script `lint` en su package.json, así que turbo lo salta silenciosamente.

Resultado: errores de formato en packages/db/src/schema.ts no son atrapados por CI. Ejemplo: la indentación rota en `slug:` (corregida en el PR #121) no fue detectada por el pipeline.

**Impacto:**
Bajo — no rompe funcionalidad. Pero permite que errores de formato se acumulen y que el DoD "eslint + prettier" no sea real.

**Mitigación:**
- Agregar script `lint` a packages/db/package.json que corra prettier --check + eslint.
- Verificar que turbo lo recoja en `pnpm lint`.
- Revisar si otros packages tienen el mismo hueco.

**Urgencia:** 🟢 Bajo. Cuando haya tiempo.

**Fecha de reevaluación:** sin fecha.

---

## 11. Test bind params para decryptToken — ✅ RESUELTO (2026-09-19)

**Contexto:** El test `SQL bind params` en `packages/commerce/src/__tests__/encryption.test.ts` solo verifica que `encryptToken` usa bind params para la clave. Falta test equivalente para `decryptToken` que verifique que `${key}` y `${column}` viajan como bind params en el `SELECT pgp_sym_decrypt`.

**Origen:** Regresión durante el rewrite del test (T6).

**Implementación (commit fix del bug decryptToken):**
- Tests añadidos en `packages/commerce/src/__tests__/encryption.test.ts` (sección `SQL bind params`):
  - `decryptToken: clave en params, columna en SQL (raw hardcoded)` — verifica `accessTokenEnc`
  - `decryptToken: webhookSecretEnc columna en SQL (raw hardcoded)` — verifica `webhookSecretEnc`
- Ambos tests verifican:
  - La columna aparece en el string SQL (raw hardcoded: `"accessTokenEnc"` / `"webhookSecretEnc"`)
  - La clave NO aparece en el string SQL
  - La clave SÍ aparece en el array de params

**Estado:** ✅ RESUELTO en PR #123 (commit del fix de bug decryptToken).

**Urgencia:** 🟢 Bajo. Resuelto.

**Fecha de reevaluación:** N/A.

---

## 12. TENANT_NOT_FOUND no usado en EncryptionError

**Contexto:** El código `TENANT_NOT_FOUND` está exportado en `EncryptionErrorCode` (`packages/commerce/src/encryption.ts:94`) pero nunca se lanza. Cuando el tenant no existe, `decryptToken` retorna `null` (no lanza).

**Origen:** Diseño especulativo — se añadió por completitud del enum pero sin caso de uso real.

**Impacto:** Bajo — código muerto exportado públicamente.

**Decisión pendiente:** (a) Usar: cambiar `decryptToken` para lanzar `EncryptionError('TENANT_NOT_FOUND')` cuando `result.length === 0`, o (b) Eliminar del enum y tipo.

**Urgencia:** 🟢 Bajo. Follow-up.

**Fecha de reevaluación:** antes de Fase 2.

---

## 13. Duplicación accessToken/webhookSecret en encrypt/decrypt

**Contexto:** `encryptToken` tiene ramas casi idénticas para `accessToken` y `webhookSecret` (líneas 33-45 en `encryption.ts`). Lo mismo en `decryptToken` por la columna.

**Origen:** Implementación directa sin refactor.

**Impacto:** Bajo — código repetido que dificulta mantenimiento futuro (ej: añadir tercer campo cifrado).

**Mitigación:** Refactor a loop sobre `Object.entries(values)` o helper interno `encryptField(fieldName, value, key)`.

**Urgencia:** 🟢 Bajo. Follow-up.

**Fecha de reevaluación:** antes de Fase 2.

---

## 14. Tracking de migraciones Drizzle incompleto en BD actual

**Estado:** Solo la migración 0014 está trackeada en
`public.__drizzle_migrations`. Las migraciones 0001-0013 se
aplicaron manualmente (script `apply-all-migrations.ts` + seed)
sin registrar en la tabla de tracking.

**Impacto:**
- `pnpm db:migrate` en la DB actual: OK ("Everything's fine").
- `pnpm db:migrate` en un entorno fresco: intenta aplicar 0001+
  y falla con "table already exists" (o "policy already exists"
  para 0009/0010).
- Afecta: CI si rota DB, previews si cambia branching, nuevos
  devs que siguen SETUP.md.

**Mitigación a corto plazo:**
- Documentar en SETUP.md (ver FIX 2).
- No hay acción inmediata en la DB actual (estado consistente).

**Mitigación a mediano plazo:**
- Fase 3 (branching en Neon): tracking se reconstruye desde cero
  con `pnpm db:migrate` en un entorno nuevo.
- O bien: script de reconstrucción de tracking (insertar los 14
  hashes manualmente).

**Severidad:** MEDIO. No bloquea producción pero rompe el flujo
de onboarding y CI/entornos frescos.

**Reevaluar:** antes de Fase 3 (branching Neon).

---

## 15. Snapshot Drizzle no refleja isRLSEnabled

**Estado:** Los snapshots de Drizzle generados para las migraciones
0009-0014 muestran `"isRLSEnabled": false` para las tablas que SÍ
tienen RLS activo en la DB real (products, orders, subscriptions,
tenant_mp_config, etc.).

**Causa:** Drizzle no trackea `ENABLE ROW LEVEL SECURITY` ni
`CREATE POLICY` en el schema TypeScript. Esas sentencias se
aplican vía migraciones manuales (0009, 0010, 0014) y no son
parte del modelo que Drizzle genera.

**Impacto:** un agente o dev futuro que lea el snapshot puede
asumir que no hay RLS en esas tablas. Es un falso negativo
documental, no un bug del código.

**Mitigación:**
- Documentar acá.
- Agregar comentario inline en los snapshots relevantes (ver
  `packages/db/migrations/meta/README.md`).
- Al verificar RLS, consultar pg_class.relrowsecurity contra la
  DB real, no el snapshot.

**Severidad:** BAJO (documental, no afecta runtime).

Plan aprobado el 2026-08-08 (ítem 3 de la tarea de calidad: limpieza email + health check + deuda técnica). Rama `quality/calidad-y-monitoreo`. Ver vault/02_Bitacora/bitacora.md → entrada 2026-08-08 — Calidad.

---

## 16. Seed destructivo sin guard adicional por DATABASE_URL

**Estado:** el seed hace TRUNCATE de todas las tablas (incluyendo
plans CASCADE). Agregado guard `NODE_ENV === 'production'` en
seed.ts (2026-09-23).

**Riesgo residual:** si NODE_ENV=development pero DATABASE_URL
apunta a Neon prod (configuración errónea), el guard no protege.

**Mitigación a futuro (antes de Fase 3):**
- Verificar que DATABASE_URL no contenga 'production' ni 'prod.'.
- O requerir confirmación explícita (ALLOW_SEED_IN_PROD=true).

**Severidad:** MEDIO.
**Reevaluar:** antes de Fase 3 (onboarding de tenants reales).

---

### 17. features JSONB con claves hardcodeadas en seed

**Estado:** el seed de planes inserta un objeto `features` con 13
claves booleanas hardcodeadas.

**Riesgo:** cuando se agregue una feature nueva en Fases 2+ y no se
agregue al JSONB de los planes existentes en DB, el código que evalúe
permisos va a leer esa clave como `undefined` (falsy) en lugar de
`false`. Comportamiento silencioso.

**Mitigación a futuro (antes de Fase 2):**
- Agregar schema de validación (Zod) del JSONB `features` con todas
  las claves requeridas y sus defaults.
- O usar un helper `hasFeature(plan, key)` que devuelva `false` cuando
  la clave no existe.

**Severidad:** MEDIO.
**Reevaluar:** antes de arrancar Fase 2.

---

## 18. `encryptToken` UPDATE-only, sin upsert

**Estado:** `encryptToken` solo ejecuta `UPDATE` sobre `tenant_mp_config` y no crea la fila inicial cuando el tenant todavía no tiene configuración.

**Impacto:** bloqueante para el autoservicio de Fase 3, donde el tenant debe registrar su primera credencial de MercadoPago.

**Mitigación:** convertirlo en upsert atómico o agregar una ruta explícita de creación de `tenant_mp_config`, con tests de INSERT inicial y UPDATE posterior.

**Urgencia:** antes de Fase 3.

---

## 19. T11 en CI

**Estado:** `NEON_DATABASE_APP_URL` está configurada en GitHub Secrets y el workflow E2E ejecuta el test RLS real. No se aplicó skip en esta implementación.

**Regla:** si el secret deja de estar disponible, el bloqueo debe reportarse antes de agregar un skip condicional; no se oculta un fallo de RLS detrás de un test omitido.

**Urgencia:** reevaluar si cambia la configuración de CI.

---

## 20. Falta test del seed y de los datos de planes

**Estado:** no existe un test dedicado que valide los tres planes, sus precios en centavos, límites y features, ni la idempotencia del seed.

**Impacto:** una regresión en el catálogo o en los precios puede pasar hasta una ejecución de seed en un entorno compartido.

**Mitigación:** extraer los datos del catálogo a una función testeable y agregar tests unitarios/integración del seed.

**Urgencia:** antes de Fase 3.

---

## 21. `publicKey` e `isVerified` fuera de ADR-024

**Estado:** **resuelto en esta PR.** ADR-024 ahora documenta ambas columnas y aclara que están fuera del mínimo original de T4/ADR-024.

**Verificación:** el schema contiene `publicKey` e `isVerified`; no se agregan cambios de schema en esta tarea.

---

## 22. T12 mock-only; roundtrip real de DB en Fase 3

**Estado:** T12 queda con DoD mock-only en este cierre. El PR declara `Cierra parcialmente #112 (mock-only)`.

**Deuda:** el roundtrip real contra la base para cifrar y descifrar queda para Fase 3, con fixtures y cleanup controlados.

**Urgencia:** antes de Fase 3.

---

## 23. Colisión de IDs en snapshots 0012–0014

**Estado:** `drizzle-kit generate --custom` falla porque 0012, 0013 y 0014 comparten el mismo `id` y `prevId` de snapshot. Los snapshots existentes son inmutables y no se modificaron.

**Impacto:** no se puede regenerar automáticamente una migración custom hasta reconstruir o normalizar la cadena histórica de snapshots.

**Mitigación:** corregir la cadena en una tarea de migraciones dedicada, preservando el historial y nunca editando snapshots aplicados.

**Urgencia:** antes de la siguiente migración generada por Drizzle.

**Nota:** no se agrega ítem 24 por la verificación read-only de conexiones; el ítem 24 de esta sección registra exclusivamente el bug de tooling `db:migrate`/`setup`.

---

## 24. `db:migrate` ejecuta `drizzle-kit up` y `setup` puede seedar sin schema

**Estado:** **Resuelto en esta PR (2026-09-24).** El script raíz `db:migrate` ahora ejecuta `drizzle-kit migrate`; el baseline único y el tracking canónico en `drizzle.__drizzle_migrations` fueron validados en un branch efímero y en production.

**Impacto original:** un desarrollador nuevo que siguiera `SETUP.md` podía terminar ejecutando el seed contra una base sin el schema esperado, con un flujo de errores poco claro.

**Resolución:** se archivó el historial incompleto, se regeneró `0000_baseline.sql` con las 13 tablas y su bloque de seguridad, se corrigió `db:migrate` y se actualizó `SETUP.md`. El tracking público obsoleto fue eliminado después de migrar el control a `drizzle.__drizzle_migrations`.

**Validación:** branch efímero v2 y production: `db:migrate` no-op, seed exitoso, smokes correctos y T11 RLS 8/8. DoD final: lint 6/6, typecheck 9/9, 474 tests en 57 archivos y build 3/3.

**Urgencia:** cerrada para esta fase; queda como referencia para futuras migraciones.

**Contexto de esta ejecución:** 0015 se aplicó manualmente con SQL del owner y se verificó con smoke tests; el reset posterior quedó validado con el plan aprobado de baseline limpio.
---

## 25. Bitácora con pérdida de datos preexistente (U+FFFD)

**Estado:** 15 líneas de `vault/02_Bitacora/bitacora.md` contienen
U+FFFD (replacement character) donde el byte fuente se perdió antes
de cualquier fix (ej: `simulaci�n` en lugar de `simulación`).

**Origen:** corrupción histórica anterior al PR #143. Detectada al
reparar el doble-encoding UTF-8→CP1252 de la bitácora.

**Impacto:** contenido histórico parcialmente ilegible. No afecta
ejecución, tests ni tooling.

**Mitigación:** ninguna posible sin inventar bytes. Queda documentado
en la entrada del 2026-09-26 de la bitácora.

**Urgencia:** sin plan de fix. Severidad BAJA.

---

## 26. Residual `â¬` en bitácora L1289

**Estado:** la línea `### 2026-09-21 â¬ <0x1D> T7:` conserva un
mojibake incompleto: el tercer byte del em-dash fue reemplazado por
el control char `0x1D` antes del fix del PR #143.

**Origen:** corrupción histórica. El byte fuente está destruido, no
solo mal decodificado.

**Impacto:** estético. Una sola línea de encabezado queda con un
carácter ilegible; el resto del contenido es legible.

**Mitigación:** no se puede reparar sin inventar el byte original.
Decisión explícita del 2026-09-26: se deja como evidencia del daño.

**Urgencia:** sin plan de fix. Severidad BAJA.

---

## 27. GGA `EXCLUDE_PATTERNS` no cruza `/`

**Estado:** en `.gga`, el patrón `*.test.*` no excluye
`packages/db/src/__tests__/*.test.ts` porque el glob no cruza `/`
(el match es contra el path relativo completo).

**Origen:** detectado al diagnosticar el timeout de 300s del hook
durante el PR #143.

**Impacto:** tests grandes van a review de GGA contra `AGENTS.md`
(~1.100 líneas). Ya no bloquea el hook desde que el provider es
Nemotron 3 Ultra (~50s), pero el costo de review se mantiene.

**Mitigación:** cambiar `EXCLUDE_PATTERNS` a
`**/*.test.*,**/*.spec.*` y verificar que el hook salte los tests.

**Urgencia:** MEDIA. A resolver en el PR de skills (F1-F5).
