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

## 6. Gaps en _journal.json (pre-existente)

**Contexto:**
El _journal.json no incluye entradas para varias migraciones:
- 0010_force_rls.sql (salto idx 9 → 11, falta idx 10).
- 0005_add_admin_users.sql (huérfano, no en journal, duplica parcialmente 0005_fluffy_triathlon).
- Snapshots faltantes para idx 3, 4, 9, 10.

**Impacto:**
En entornos frescos (dev/CI/preview), `pnpm db:migrate` solo aplica las migraciones registradas. 0010_force_rls.sql nunca se aplica en esos entornos → FORCE RLS no se activa. Divergencia silenciosa de postura de seguridad con producción (que tiene 0010 aplicada manual).

**Mitigación:**
- Registrar 0010 en el journal con idx 10.
- Decidir qué hacer con 0005_add_admin_users.sql (¿eliminar? ¿registrar?).
- Verificar snapshots 3/4/9/10 (¿faltan o son huérfanos?).

**Urgencia:** 🔴 Antes de T7 (RLS). Bloqueante: si T7 activa FORCE RLS en producción pero no en entornos frescos, futuros deploys tendrán comportamiento inconsistente.

**Fecha de reevaluación:** antes de arrancar T7.

---

## 7. GRANTs a app_user faltantes en las 3 tablas nuevas

**Contexto:**
Las tablas plans, subscriptions y tenant_mp_config no tienen GRANT explícito para el rol app_user. Las 10 tablas pre-existentes obtuvieron permisos manualmente en Neon; las 3 nuevas no.

En PostgreSQL, RLS (Row Level Security) y privileges (GRANT) son capas separadas. RLS no otorga privilegios.

**Impacto:**
Cuando T7 aplique FORCE RLS, app_user va a recibir "permission denied" al intentar SELECT/INSERT/UPDATE/DELETE sobre estas 3 tablas. Bloquea checkout (tenant_mp_config), webhooks de suscripciones (subscriptions) y cualquier operación sobre planes.

**Mitigación:**
- En T7 (o antes): GRANT SELECT, INSERT, UPDATE, DELETE ON plans, subscriptions, tenant_mp_config TO app_user;
- Agregar ALTER DEFAULT PRIVILEGES para futuras tablas.
- Incluir este paso en el checklist de T7.

**Urgencia:** 🔴 Antes de T7. Bloqueante para que RLS funcione.

**Fecha de reevaluación:** antes de arrancar T7.

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

## Referencia

Plan aprobado el 2026-08-08 (ítem 3 de la tarea de calidad: limpieza email + health check + deuda técnica). Rama `quality/calidad-y-monitoreo`. Ver bitacora.md → entrada 2026-08-08 — Calidad.
