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

**Estado:** ✅ **RESUELTO** (verificado y completado 2026-09-26). Los tres criterios de aceptación del plan original se cumplen.

**Criterios de aceptación:**

1. ✅ Un `.sql` viejo modificado a mano → el check falla con mensaje claro. Verificado con `0013_ensure_rls_and_grants.sql`: exit 1, nombra el archivo.
2. ✅ Un `.sql` nuevo → pasa. Verificado en ambas variantes (untracked y con `git add`).
3. ✅ Documentado en `SETUP.md` → sección **Migraciones → Guard de migraciones inmutables**, con fila agregada en la tabla de **Verificación del entorno**.

**Lo que YA estaba hecho (no era lo que este item decía):**

- `scripts/check-migrations.sh` (fail-closed) con comentarios de las decisiones no obvias.
- Cableado en `.github/workflows/ci.yml` (job `build`) con `fetch-depth: 0` para poder diffear contra `origin/develop`.

**Gap encontrado y corregido (2026-09-26).** El pathspec del guard cubría solo `packages/db/migrations/`. El squash del 2026-09-24 movió las migraciones incrementales `0005`–`0015` a `docs/migrations-archive/2026-09-24/`, **fuera de todo pathspec**: quedaban desprotegidas. Se podía reescribir `0013_ensure_rls_and_grants.sql` y el CI pasaba verde.

Evidencia del gap (pathspec viejo vs nuevo sobre la misma edición):

```
PATHSPEC VIEJO  → (vacío)      el guard NO detectaba la edición
PATHSPEC NUEVO  → docs/migrations-archive/2026-09-24/0013_ensure_rls_and_grants.sql
```

**Fix aplicado:** el pathspec ahora incluye `docs/migrations-archive/*/*.sql` y `*.json`. El bloque de excepción `archive_marker` quedó intacto.

**Nota informativa — agregados en el archive.** El guard usa `--diff-filter=MD`, que excluye `A` (Added) por diseño: las migraciones nuevas deben poder agregarse. Consecuencia: un archivo nuevo dentro del archive también pasa. Esto es **coherente con el criterio 2** y no queda pendiente. Si en el futuro el archive debe ser un congelado estricto (cero archivos nuevos), hace falta un flag dedicado; sería una decisión de producto, no un bug.

**Lección de proceso.** Un guard puede pasar verde y aun así no cubrir lo que dice proteger. Eso es peor que no tener guard, porque genera confianza falsa. Al auditar un control, verificar **cobertura**, no presencia.

**Severidad:** CERRADA.

**Urgencia:** CERRADA.

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
de cualquier fix (ej: `simulación` en lugar de `simulación`).

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

**Estado:** RESUELTO (PR #145) — el patrón correcto es `*test.ts`,
verificado empíricamente (no `*.test.*` ni `**/*.test.*`).

**Contexto:** el glob de GGA matchea contra el path completo y
`*` no cruza `/`. Tanto `*.test.*` como `**/*.test.*` fallan.
El patrón correcto es `*test.ts` (sin punto antes del wildcard).

**Fix aplicado:** EXCLUDE_PATTERNS="_test.ts,*spec.ts,*d.ts,dist/*,build/*,node_modules/_,vault/*"

> Corregido en PR C (2026-09-26): esta línea documentaba `spec.ts` y
> `.d.ts` sin el wildcard inicial. La configuración real en `.gga`
> siempre tuvo la forma correcta (`*spec.ts`, `*d.ts`); el error estaba
> solo en la descripción.

**Urgencia:** CERRADA.

---

## 28. Limpieza de branches post-squash: no usar git cherry

**Estado:** INFO.

**Origen:** limpieza de `chore/obsidian-gentleman-integration` post PR #144.

**Impacto:** `git cherry develop <branch>` marca commits como "+" (no mergeados) aunque estén en develop vía squash merge, porque el squash no preserva patch-por-patch. Genera falsos positivos al inspeccionar branches pendientes de merge.

**Mitigación:** comparar árboles con `git diff <squash-commit> <branch>`; si idénticos, la branch es redundante y puede eliminarse sin riesgo.

**Urgencia:** INFO.

---

## 29. Plugin ponytail roto en opencode.json

**Estado:** RESUELTO en PR chore/skills-complete (lo resuelve el subagente B en el mismo PR).

**Origen:** `opencode.json` referenciaba `.opencode/ponytail/.opencode/plugins/ponytail.mjs` que no existía.

**Impacto:** el plugin ponytail no se cargaba correctamente.

**Mitigación:** resuelto por el subagente B en el mismo PR (eliminación o corrección de la referencia).

**Urgencia:** INFO.

---

## 30. Permisos de edición en worktrees de Paseo

**Estado:** INFO.

**Origen:** PR #145 y PR C (`chore/docs-toolkit-consolidation`), donde
los subagentes trabajan en un worktree creado por
`paseo_create_workspace`.

**Contexto:** los worktrees de Paseo pueden tener permisos de edición
restringidos. Si el agente no puede escribir en `vault/`, el bloqueo se
reporta al humano en lugar de sortearse.

**Impacto:** ninguno en el producto. Es una condición operativa del
entorno que puede bloquear la escritura de la bitácora o de la deuda
técnica dentro del PR.

**Mitigación:** el humano aplica el cambio manualmente en el path del
worktree. Ojo: hay que editar el archivo en el path **del worktree**
(`git worktree list` para ubicarlo), NO en el main worktree — son copias
distintas del repo y un cambio en el main no aparece en la branch del
PR.

**Urgencia:** INFO.

---

## 31. Markdown sin `prettier --check` en el CI

**Estado:** RESUELTO (PR `chore/prettier-mitigation`).

**Origen:** comentario de `luisavilaland` en el review del PR #146, que
pedía registrar la deuda de prettier detectada durante ese PR.

**Contexto original:** el DoD declara `pnpm lint` como "eslint + prettier", pero
`pnpm lint` es `turbo run lint` y solo ejecuta eslint por paquete.
Prettier nunca corría sobre markdown en ninguna puerta automática: el
`lint 6/6` del PR #146 no lo detectaba. Este ítem es el contrapeso de lo
que se detectó en el PR #146 y complementa el item 10 (que cubre el
`lint` script faltante en `@repo/db`): son hallazgos distintos sobre la
misma brecha, no duplicados.

**Alcance real (medido):** el conteo de 73 se quedó corto. Al momento de
mitigarlo eran **84** archivos: el PR #147 agregó 10 archivos a
`vault/engram/` y el PR #148 agregó 11 en `.opencode/commands/`.

| Grupo                    | Archivos | Naturaleza                                                       |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `vault/engram/`          | 61       | tool-managed, auto-generado por `pnpm vault:export`              |
| `vault/` (human-curated) | 9        | ADRs, bitácora, deuda, fases, specs                              |
| raíz                     | 5        | `AGENTS.md`, `PROMPTS.md`, `README.md`, `SETUP.md`, `TESTING.md` |
| `docs/`                  | 5        | `superpowers/specs`, `superpowers/plans`, `migrations-archive`   |
| `.opencode/`             | 4        | 3 `SKILL.md` + `commands/sdd-apply.md`                           |
| `.github/`               | 1        | `PULL_REQUEST_TEMPLATE.md`                                       |
| **Total**                | **84**   |                                                                  |

**Mitigación aplicada (2 partes, según `luisavilaland`):**

1. `.prettierignore` excluye:
   - `vault/engram/` (61, tool-managed: se regenera en cada export).
   - `vault/02_Bitacora/bitacora.md` (append-only: la historia es
     inmutable).
   - artefactos de build (`node_modules/`, `dist/`, `build/`, `.turbo/`,
     `.next/`, `coverage/`).
2. `prettier --write` sobre los **23** restantes.
3. Script `format:check` en `package.json` + step en `.github/workflows/ci.yml`
   para que no vuelva a acumular.

**Excepciones documentadas dentro de los formateados.** Dos archivos
requirieron un ajuste mínimo de contenido para ser idempotentes bajo
prettier, porque sus bloques de código estaban indentados y prettier
os reinterpretó:

- `AGENTS.md`: un snippet shell de bloque indentado pasaba a una línea
  con comentario inline. Se convirtió a bloque cercado ` ```bash `,
  que prettier preserva y que además renderiza igual o mejor.
- `.opencode/skills/rls-audit/SKILL.md`: un bloque cercado ` ```ts `
  con 6 espacios de indentación dentro de un item de lista. Se bajó a
  2 espacios (la alineación correcta según el item).

Ambos cambios conservan el significado y el renderizado.

**Nota sobre la bitácora:** excluida por la regla append-only. Si en el
futuro se decide formatearla, hay que hacerlo con excepción documentada
(mismo patrón que el fix de mojibake en el PR #143), nunca como parte
de un `prettier --write` global.

**Severidad:** CERRADA.

**Urgencia:** CERRADA.

## 32. MCP GitHub con credenciales invalidas

**Estado:** abierto (2026-09-26).

**Contexto:** el servidor MCP de GitHub responde "Bad credentials" a
cualquier operacion (`github_create_pull_request` fallo con
`-32603 Authentication Failed`).

**Consecuencia:** toda operacion de GitHub via MCP falla. Incluye
crear PRs, comments, labels y issues.

**Mitigacion actual:** usar `gh` CLI. No esta en PATH en esta maquina;
vive en `C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe` y autentica
como `EdgarVz`. El metodo universal para localizarlo esta documentado
en `PROMPTS.md`.

**Resolucion:** re-autenticar el MCP o eliminarlo del `opencode.json`
si no se usa. Mientras exista, cada agente que intente GitHub via MCP
va a perder tiempo diagnosticando un fallo que no es del repo.

**Severidad:** INFO.

**Urgencia:** INFO.

## 33. 21 entradas históricas de bitácora sin separador `---`

**Estado:** abierto (2026-09-26). 21 entradas de `vault/02_Bitacora/bitacora.md`, entre 2026-07-10 y 2026-08-12, no tienen separador `---` antes del encabezado.

**Impacto:** cosmético. Los encabezados `##` consecutivos renderizan como headers separados en Obsidian; no se fusionan en un bloque. No rompe la lectura ni la navegación.

**Mitigación:** si se hace una pasada de normalización del vault, agregar `---` antes de cada entrada. Son 21 inserciones puramente aditivas, cero borrados, append-only intacto. Decisión de producto, no bug.

**Severidad:** INFO.

**Urgencia:** INFO.

## 34. CI no valida setext headings en markdown

**Estado:** abierto (2026-09-26).

**Contexto:** `vault/02_Bitacora/bitacora.md` está en `.prettierignore` (línea 8) por ser append-only. Eso desactiva la única red que detectaría un setext heading: un párrafo seguido de `---` sin línea en blanco, que renderiza el párrafo entero como `<h2>`.

**Impacto:** errores de formato markdown pasan inadvertidos en la bitácora. No hay lint, ni `format:check`, ni revisión que los detecte. El bug se encontró porque un humano lo vio en el renderizado de Obsidian.

**Mitigación:** check en CI que valide que toda línea `---` tenga línea en blanco antes y después. Script propio (bash o node), independiente de prettier.

**Severidad:** INFO.

**Urgencia:** INFO.

## 35. Errores factuales en el spec transversal de suscripciones

**Estado:** abierto (2026-10-01).

**Contexto:** `docs/superpowers/specs/2026-09-subscription-lifecycle.md` documenta el contrato de MercadoPago con **3 errores factuales**, **1 premisa falsa** y **1 estado no modelado**. Detectados al verificar el spec contra la documentacion real de MP durante el planning de Fase 2 (PR #163).

**Los 5 hallazgos:**

1. **Nombres de evento que no existen (ALTA).** El transversal §1, §6 y §8 usa `preapproval.created`, `payment.created`, `payment.failed`, `payment.rejected`, `preapproval.canceled`, `preapproval.updated`. Ninguno es un topic de MercadoPago. Los topics reales son `subscription_preapproval`, `subscription_authorized_payment`, `payment`, `subscription_preapproval_plan`. Ademas el payload trae `type` + `action` **separados**, no un evento compuesto. Y `subscription_authorized_payment` se resuelve con `GET /authorized_payments/{id}`, **no** con `GET /v1/payments/{id}`: son recursos distintos.

2. **`notification_url` (ALTA).** MP se contradice: la doc de _Subscriptions → Webhooks_ dice que para Suscripciones la URL debe configurarse "al crear el pago", pero los body params de `POST /preapproval` **no documentan ese campo** (aparece en Preferences API e IPN). Si el campo existe y no se manda, ninguna suscripcion se activa nunca.

3. **URL con `:tenantId` (ALTA).** El transversal §8 define `/api/webhooks/mercadopago/subscriptions/:tenantId` y `/api/webhooks/mercadopago/:tenantId`. **Imposible:** MP registra una URL literal por aplicacion y por modo. No hace path templating. El `tenantId` viaja en el `external_reference`.

4. **Premisa de prorrateo nativo falsa (MEDIA).** El transversal §5 decia "MP Preapproval no soporta prorrateo nativo". **Falso:** MP expone `auto_recurring.billing_day_proportional` y doc dedicada. La conclusion del transversal sigue siendo valida (la formula de credito/diferencia entre planes la maneja nuestra app), pero la premisa que la justificaba era incorrecta.

5. **Estado `paused` no modelado (MEDIA).** MP tiene un estado `paused` para preapprovals que el transversal no contempla. Si el tenant pausa desde el panel de MP, la DB no lo refleja.

**Impacto:** cualquiera que implemente contra el transversal construye un dispatcher que nunca matchea. Ese es el hallazgo mas grave.

**Mitigacion:** PR `chore/fix-transversal-fase2` (issue #174). Las 5 correcciones aplicadas, con notas que citan la evidencia y remiten al spike T0 (#164) para los literales exactos de `type`/`action`.

**Ademas:** el design de Fase 2 ya immuniza el codigo contra los 5 hallazgos — despacha por `topic` (no por `action`), usa URL fija sin path param, bloquea `notification_url` para el spike, y trata `paused` como no-op con log `warn`.

**Severidad:** ALTA.

**Urgencia:** ALTA.

---

## 36. `external_reference` no viene en el payload del webhook de MP

**Estado:** abierto (2026-10-01).

**Contexto:** el webhook de MercadoPago envia este body:

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "api_version": "v1",
  "action": "payment.created",
  "data": { "id": "999999999" }
}
```

**No trae `external_reference`.** Ese campo pertenece al objeto preapproval y solo se obtiene consultando `GET /preapproval/{id}` o `GET /authorized_payments/{id}`.

**Impacto:** el handler de suscripciones necesita `MP_PLATFORM_ACCESS_TOKEN` y hace una llamada **saliente a MP en cada webhook** para resolver el tenant. Eso agrega latencia (200-400 ms) y un modo de falla nuevo: si MP esta caido, el evento no se puede enrutar. Dependencia de red en la ruta critica de activacion.

Mitigacion de Fase 2: estrategia de resolucion en dos pasos. **Estrategia L** (local, sin red): `SELECT tenantId FROM subscriptions WHERE mpPreapprovalId = $1`. **Estrategia R** (remota): consulta a MP, lee `external_reference` o `preapproval_id`. Si ninguna resuelve, responde `200` + log `warn` (nunca `5xx`, para no generar reintentos infinitos de MP).

El mapeo local ya existia en `subscriptions` (`mpPreapprovalId` + `tenantId`, una fila por tenant), asi que la unica migracion de Fase 2 es un indice unico parcial. Sin tabla nueva.

**Severidad:** ALTA.

**Urgencia:** MEDIA.

---

## 37. `GET /authorized_payments/{id}` sin documentacion verificable

**Estado:** abierto (2026-10-01).

**Contexto:** para resolver un cobro recurrente (`subscription_authorized_payment`), MP documenta `GET /authorized_payments/{id}` ("Get invoice data"). **No esta verificado si ese recurso expone `external_reference` ni `preapproval_id`.**

**Impacto:** si no expone ninguno de los dos, **no hay forma de saber a que tenant pertenece un cobro recurrente**, y el webhook no se puede enrutar. Es el riesgo #1 de Fase 2.

**Mitigacion:** spike T0 (issue #164) lo determina empiricamente. Tres resultados posibles:

| Resultado                 | Accion                                                                                    | Costo                    |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ |
| trae `external_reference` | Estrategia R directa                                                                      | 0                        |
| trae `preapproval_id`     | Estrategia R encadenada con Estrategia L                                                  | 0                        |
| **no trae ninguno**       | Tabla `subscription_payments` (`tenantId`, `mpInvoiceId` UNIQUE, `status`, `processedAt`) | **+1 dia, +1 migracion** |

El ultimo escenario esta definido y estimado. No se construye la tabla preventivamente: MP necesita vincular la factura a la suscripcion para cobrarla, asi que el vinculo existe en algun campo.

**Severidad:** ALTA.

**Urgencia:** ALTA (bloqueante para `sdd-apply`).

---

## 38. Estado `paused` de MercadoPago no modelado

**Estado:** ~~abierto (2026-10-01)~~ **SUPERSEDED por decision del 2026-10-05.
Ver item 38-bis, que es la guia vigente.**

**Razon:** la decision de "no soportado en Fase 2" que figura mas abajo se tomo
en el planning de Fase 2, **antes del spike T0**, con informacion incompleta.
El spikeinio con payloads reales y cambio las dos premisas en las que se
fundaba: (1) `authorized -> paused` devuelve 200 y aplica, (2)
`paused -> authorized` devuelve 200 y aplica. `cancelled` es el unico terminal.
La doc oficial de MP confirma que `paused` **detiene el cobro** ("Mercado Pago
deje de debitar los pagos de ese cliente hasta que decidas reactivarlo").

**Reemplazo:** item 38-bis. Este registro no se borra por trazabilidad: deja
constancia de que la decision se tomo con informacion incompleta y de por que se
reviso. Ese es el riesgo real de un item de deuda usado como documento
normativo: sobrevive al spike que lo refuta.

La razon del root cause de H2 (auditoria mid-phase, PR #197): el handler hizo
exactamente lo que este item decidia, y T4 construyo `pause`/`resume` tres dias
despues **sin revisar este item**. El `202` de `pause` moria porque el webhook
seguia una decision vieja.

**Decision vigente:** item 38-bis, opcion B.
**Contexto:** MP tiene un estado `paused` para preapprovals (pausar una suscripcion sin cancelarla). El spec transversal no lo contempla.

**Impacto:** si el tenant pausa desde el panel de MP, la DB no lo refleja. El estado sigue en `active` y el tenant conserva acceso completo, cuando la intencion de MP es suspenderse. Divergencia silenciosa entre MP y nuestra DB.

**Decision (Luis, planning Fase 2) — SUPERADA:** documentar como **no soportado** en Fase 2. El webhook registra `warn` y **no transiciona** cuando recibe `paused`. No se inventa un estado nuevo ni se mapea a `past_due` (que tiene semantica de dunning, que es otra cosa).

**Se agrega al transversal cuando Fase 3 defina la semantica de pausa:** ¿es `past_due`? ¿un estado nuevo? ¿bloquea el panel admin? ¿el storefront sigue accesible? Requiere decision de producto.

**Nota:** `put /preapproval/{id} {status: "paused"}` es la via por API. Si Fase 3 expone pausar, debe decidir si pasa por la API nuestra o se deja solo el panel de MP.

**Severidad:** MEDIA.

**Urgencia:** BAJA.

---

## 38-bis. `paused` es estado soportado en Fase 2 (decision vigente)

**Estado:** vigente (2026-10-05). Reemplaza al item 38.

**Decision (Luis, aprobacion de la auditoria mid-phase PR #197):** **opcion B.**
El item 38 se revierte y `pause`/`resume` construidos en T4 siguen en pie.

**Por que B y no A.** El item 38 asumia que `paused` no podia mapearse a ningun
estado nuestro sin inventar semantica. El spike demostro lo contrario: MP ya
lo expone, ya es reversible en ambas direcciones y ya tiene semantica propia
(suspende el cobro sin cancelar el acceso). La opcion A —quitar `pause`/
`resume`— dejaria al tenant sin ninguna forma de volver de una suspension que
el mismo MercadoPago permite.

**Transiciones:**

| Origen     | Destino  | Disparador                       | Confirma                                                             |
| ---------- | -------- | -------------------------------- | -------------------------------------------------------------------- |
| `active`   | `paused` | `POST /api/subscriptions/pause`  | webhook, topic `subscription_preapproval` con `status: 'paused'`     |
| `past_due` | `paused` | `POST /api/subscriptions/pause`  | webhook,idem                                                         |
| `paused`   | `active` | `POST /api/subscriptions/resume` | webhook, topic `subscription_preapproval` con `status: 'authorized'` |

El webhook confirma via `decideTarget`. `POST /pause` y `POST /resume` devuelven
`202` y **no escriben** el estado local: lo confirma el evento.

**Guard de periodo (critico).** `paused -> active` NO renueva
`currentPeriodEnd`. El tenant nunca perdio el periodo: solo dejo de facturarse.
Sin ese guard, cada ciclo pause/resume regalaba un mes. Solo la activacion desde
un estado que habia perdido el periodo (`pending_first_payment`, `past_due`,
`expired`) lo renueva.

**Estados que NO pueden pausar:** `expired`, `abandoned`, `cancelled`. Una
suscripcion vencida no se pausa, caduca. `PAUSABLE = ['active', 'past_due']`.

**Cancelacion desde `paused`:** sigue permitida (item 51). `cancelled` es
terminal en MP: no hay vuelta atras.

**Severidad:** INFO. No es un defecto: es la decision vigente que reemplaza al item 38.

**Urgencia:** N/A.

**Origen:** auditoria mid-phase de Fase 2 (PR #197), hallazgo H2, con la
aprobacion de Luis del 2026-10-05.

**Evidencia:** spike T0 (`docs/superpowers/specs/2026-10-02-spike-t0-resultado.md`,
matriz de transiciones), doc oficial de MP
(manage-subscription-plan: _"Pausar suscriptor ... Mercado Pago deje de debitar
los pagos de ese cliente hasta que decidas reactivarlo"_).

---

## 39. BOM UTF-8 al inicio del spec transversal

**Estado:** abierto (2026-10-01).

**Contexto:** `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
empieza con un BOM UTF-8 (`EF BB BF`) antes del primer caracter.

**Verificado:** los primeros 3 bytes del archivo son `EF BB BF`.

**Impacto:** el BOM rompe herramientas que no lo toleran. Concretamente:

- `grep -c '^#'` devuelve 0 en vez de 1 (el BOM se cuela en la primera linea)
- Scripts que comparan la primera linea contra `# ...` fallan sin motivo apparent
- Editores o linters viejos pueden mostrar un caracter fantasma al inicio
- `head -c 3 file | xxd` no devuelve el Markdown esperado

No rompio nada hoy: `prettier --check` lo acepta y el build de CI pasa. Es
ruido latente, no un fallo activo.

**Mitigacion:** quitar el BOM cuando se haga un PR de limpieza del transversal.
No es urgente y **no conviene hacerlo en un PR que mezcle limpieza con otros
cambios** (dificulta el review del diff).

```bash
sed -i '1s/^\xEF\xBB\xBF//' docs/superpowers/specs/2026-09-subscription-lifecycle.md
```

En Windows (PowerShell):

```powershell
$p = "docs/superpowers/specs/2026-09-subscription-lifecycle.md"
$c = [System.IO.File]::ReadAllText($p)
$c = $c.TrimStart([char]0xFEFF)
[System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding $false))
```

**Nota:** el item 5 del archivo usa `###` como prefijo en lugar de `##` como
el resto. Mismo tipo de inconsistencia menor. No se corrigio aqui para evitar
mezclar cambios.

**Origen:** detectado por luisavilaland en el review del PR #175.

**Severidad:** INFO.

**Urgencia:** INFO.

---

## 40. Reglas de escritura de `.md` en Windows/PowerShell

**Estado:** abierto (2026-10-02). Registra una serie de errores
recurrentes al editar `.md` desde PowerShell.

**1. `format:check` no se corre despues de editar.**

`pnpm format:check` corre en el job `build` de CI. Editar un `.md` sin
correrlo produce un PR rojo por formato, aunque el contenido este bien.

**2. `Add-Content` con here-strings rompe el encoding.**

`Add-Content` / `Set-Content` con `-Encoding UTF8` en PowerShell 5.1
introducen caracteres corruptos en texto con acentos o no-ASCII. En
este repo se detectaron dos variantes:

- **U+FFFD** (caracter de reemplazo Unicode) donde deberia ir un acento.
- Caracteres CJK colados en comentarios, que swept como basura invisible.

## Reglas

1. Despues de **CUALQUIER** escritura sobre un `.md` fuera de
   `.prettierignore`, correr `pnpm format:check`. No al final del
   trabajo: despues de cada escritura.

2. Para texto con acentos o no-ASCII, usar la herramienta `write`, **no**
   `Add-Content` con here-strings. `Add-Content` solo para texto plano
   ASCII.

3. Despues de escribir con `Add-Content`, escanear en busca de CJK y de
   U+FFFD. Si hay matches: **PARAR y corregir antes de commitear.**

   ```powershell
   $l = Get-Content <archivo> -Encoding UTF8
   for ($i=0; $i -lt $l.Count; $i++) {
     if ($l[$i] -match '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]') { "CJK L$($i+1)" }
     if ($l[$i] -match "\uFFFD")                              { "MOJIBAKE L$($i+1)" }
   }
   ```

   **Escanear el ARCHIVO, nunca la salida de `git`.** Esto no es
   teorico: un CJK se colo en la bitacora (PR #181, 2026-10-03) porque
   el escaneo se hizo sobre `git diff | Where-Object { $_ -match '^+' }`.
   La salida de un comando nativo en PowerShell se decodifica con la
   codificacion de consola, asi que los caracteres CJK llegan a
   PowerShell como signos de pregunta `?` **antes de tocar el regex**.
   El regex es correcto; la entrada ya estaba destruida, y el chequeo
   reportaba "0 CJK" con el CJK presente en el archivo.

   Nota: no citar CJK literal al explicar este problema. Escribirlo aqui
   reintroduce el defecto que el escaneo debe detectar. Describirlo con
   palabras ("tres ideogramas de chino") es suficiente.

   Sintoma caracteristico: el `git show` del mismo commit imprime `?` en
   lugar del CJK, y el `Get-Content` del archivo si lo muestra. Si el
   conteo por `git` da 0 pero el archivo tiene CJK, **el escaneo esta
   mal, no el archivo**.

4. En archivos acumulativos (`bitacora.md`, `deuda-tecnica.md`), verificar
   que el diff sea **solo adiciones** antes de commitear:

   ```powershell
   git diff -- <archivo> | Select-String "^-" | Where-Object { $_ -notmatch "^---" }
   ```

   Debe dar 0 lineas. Si aparecen borrados, se perdio contenido previo.

5. `prettier --write` **debe preservar** el append limpio. Verificado en
   el item 41: 62 lineas puramente aditivas incluso despues de formatear.

6. **Nunca here-strings de PowerShell para markdown con backticks.** En
   strings dobles y here-strings de PowerShell, el **backtick es el caracter de
   escape**, y entre sus escapes validos esta el tabulador vertical (U+000B).
   Una lineaintended para escribir un path entre comillas invertidas produce
   **U+000B + el resto del texto con la primera letra perdida**.

   Sintoma: el archivo resultante muestra `ault/engram/` en lugar de
   `vault/engram/`, e `itacora.md` en lugar de `bitacora.md`. Pasa
   `format:check`, pasa UTF-8 estricto, y **solo se detecta enumerando
   codepoints**.

   Aplica a todo markdown con inline code, code fences o paths entre backticks.
   Aplica igual a los here-strings `@"..."@` y a `$var = "..."`.

   Mitigacion: usar la herramienta de edicion para escribir el markdown y
   usar PowerShell solo para leer, escanear o escribir **texto plano ASCII sin
   backticks**. Si unavoidable, escapar el backtick como ` ` `` (doble
   backtick) o construir el texto con `[char]96`.

   **Escaneo post-escritura obligatorio**, por codepoint, porque el sintoma es
   un control char y un regex de CJK no lo cubre:

   ```powershell
   $t = [System.IO.File]::ReadAllText(<archivo>)
   $c = 0
   for ($i=0; $i -lt $t.Length; $i++) {
     $x = [int]$t[$i]
     if ((($x -le 0x08) -or ($x -ge 0x0B -and $x -le 0x1F)) -and $x -ne 0x09 -and $x -ne 0x0A) {
       "CTRL pos ${i}: U+$('{0:X4}' -f $x)"; $c++
     }
   }
   "Total control chars: $c"
   ```

   **Tercera aparicion del mismo patron.** La primera fue este item; la segunda,
   el item 52 (dos reemplazos bulk con PowerShell introdujeron U+0007 y
   U+000B que **reemplazaron letras**); la tercera, el body del PR #197, donde
   un addendum escrito con here-string metio 5 caracteres de control
   (2x U+000B, U+0008, 2x U+000D). Documentarla cierra el ciclo: la causa es
   **herramiental**, no de disciplina, y por eso la regla tiene que ser
   "no uses esa herramienta", no "tene mas cuidado".

**Nota sobre falsos positivos en los escaneos:**

- El mojibake en consola puede ser artefacto de render de PowerShell 5.1,
  no del archivo. Confirmar leyendo los char codes antes de "corregir".
- Algunos U+FFFD son **intencionales**: cited como ejemplo dentro de otro
  item. Revisar el contexto antes de tocar.
- Los emojis y em-dashesrenders como mojibake en consola pero son
  validos en el archivo.

**Origen:** errores repetidos durante los PR #175, #176, #179 y el
design de Fase 2.

**Severidad:** MEDIA.

**Urgencia:** MEDIA. Es una trampa de proceso, no un defecto de producto,
pero costo varios ciclos de correccion.

---

## 41. `seed` rojo en CI: `drizzle-kit migrate` falla sin mensaje

**Estado:** abierto (2026-10-02).

**Contexto:** job `seed` del workflow `CI` (rama `develop` / PRs).
Comando: `pnpm db:migrate && pnpm db:seed`.

**Sintoma:** `drizzle-kit migrate` imprime unicamente el spinner

```
[⣷] applying migrations... ELIFECYCLE  Command failed with exit code 1.
```

y sale con codigo 1 **sin ningun mensaje de error util**. Ni el nombre de la
migracion que fallo, ni la causa (conexion, permisos, statement invalido).

**Cadena de fallo:** `seed` rojo -> el job `e2e` se skipea por dependencia ->
el gate `e2e-success` reporta "Some e2e jobs failed" -> rojo. **Una sola causa
raiz produce tres checks en rojo.**

**Evidencia de que NO es reciente ni de un PR especifico:**

- El fallo ya estaba presente en el run del `2026-10-02T14:38:28Z` de
  `chore/spike-t0-fase2`, antes del merge de `develop` y antes del stub v2.
- El diff del PR #178 (mergeado como `e97b0c8`) **no toca** `packages/db`,
  migraciones, seed, `package.json` ni `.env`.
- `develop` solo ejecuta el job `build`. **Nunca corre `seed` ni `e2e`**, asi
  que su estado verde **no es comparable** con el de un PR. Solo los PRs
  ejercitan esta parte del pipeline.

**Impacto:** ningun PR puede pasar el gate `e2e-success`. El unico job que
verifica migraciones y seed esta roto, y como **no imprime diagnostico**,
cada PR que lo dispare cuesta tiempo de investigacion manual. Ademas
`seed` es justamente el job que valida que las migraciones apliquen sobre una
BD limpia: si no corre, **nadie detecta una migracion rota antes de
produccion**.

**Hipotesis (no confirmadas):**

1. Error de conexion o permisos contra la BD de dev, tragado por el spinner
   de `drizzle-kit`.
2. Estado de la BD de dev inconsistente (migracion aplicada a medias).
3. La variable `DATABASE_URL` del runner apunta a un destino que no acepta
   escrituras.

**Como diagnosticar:** correr `pnpm db:migrate` localmente contra la BD de
dev (MUTANTE) para obtener el error real, o agregar salida de debug al step
de CI. `drizzle-kit` tiene flags de verbose que hoy no se usan.

**Nota de credenciales:** el runner usa `DATABASE_URL` (rol de migracion, con
`neondb_owner`). No confundir con `DATABASE_APP_URL` (rol `app_user`, sin
BYPASSRLS), que es el de la app runtime.

**Origen:** detectado durante el merge del PR #178 (spike T0).

**Severidad:** ALTO.

**Urgencia:** MEDIA. No bloquea el desarrollo, pero **degrada la red de
seguridad de migraciones** y vuelve lento cada PR.

---

## 42. `drizzle.config.ts` no carga dotenv

**Estado:** abierto (2026-10-02).

**Contexto:** `packages/db/drizzle.config.ts` lee
`process.env.DATABASE_URL!` **sin cargar dotenv**. No hay ningun
`import 'dotenv/config'` ni equivalente. El repo tiene `.env.local`
(no `.env`).

`SETUP.md` (L18-25) indica el setup en este orden:

```bash
# 3. Generar migraciones
pnpm db:generate
# 4. Aplicar migraciones
pnpm db:migrate
```

**Sin mencionar que hay que exportar `DATABASE_URL` en el shell.**

## Consecuencia

Un dev nuevo que siga `SETUP.md` al pie de la letra corre `pnpm
db:migrate` sin la variable en el entorno y recibe:

```
Error  Please provide required params for Postgres driver:
    [x] url: undefined
```

El mensaje no dice **falta la variable** ni menciona `.env.local`. Parece
un problema de drizzle cuando en realidad es de onboarding.

Es el impacto que anticipo el item 14 ("nuevos devs que siguen
SETUP.md"), que sigue sin cerrarse.

## Reproducido

```
> cd packages/db && drizzle-kit migrate
Error  Please provide required params for Postgres driver:
    [x] url: undefined
 ELIFECYCLE  Command failed with exit code 1.
```

Con `DATABASE_URL` exportada manualmente, el mismo comando corre bien y
aplica las migraciones.

## Mitigacion

- **Opcion A:** cargar dotenv en `drizzle.config.ts` (por ejemplo
  `import 'dotenv/config'` o `dotenv.config({ path: '.env.local' })`).
  Efecto colateral a evaluar: `drizzle.config.ts` se lee desde
  `packages/db`, asi que la ruta relativa de `.env.local` debe.resolve
  desde la raiz del repo.
- **Opcion B:** documentar el export en `SETUP.md` antes del paso 4.
  Menos invasivo, pero mantiene el pie de trampa.
- **Opcion C:** ambas. Dotenv en el config mas la nota en `SETUP.md`,
  porque el error sigue siendo posible si alguien borra `.env.local`.

---

## 43. `drizzle-kit` no imprime errores en modo no-interactivo

**Estado:** abierto (2026-10-02).

**Versiones:** `drizzle-kit@0.31.10`, que embebe `hanji@0.0.8`.

### Mecanismo

`drizzle-kit migrate` delega la ejecucion en `hanji.renderWithTask()`:

```js
function renderWithTask(view, task) {
  const terminal = new TaskTerminal(view, process.stdout);
  terminal.requestLayout();
  try {
    const result = yield task;
    terminal.clear();
    return result;
  } catch (err) {
    terminal.reject(err);
    process.exit(1);        // <- sincrono, gana la carrera
  }
}
```

`process.exit()` es sincrono: mata el proceso antes de que el terminal
renderice la excepcion.

Peor aun, la vista **no tiene rama para el error**:

```js
render(status) {
  if (status === "pending" || status === "rejected") {
    return `[${spin}] applying migrations...`;
  }
  return `[✓] migrations applied successfully!`;
}
```

El estado `rejected` dibuja **el mismo spinner** que `pending`. El texto
del error no se imprime por ningun camino.

### Consecuencias

- **Cualquier fallo de migracion en CI es indetectable.** Solo se ve
  `exit code 1` sin mensaje. Ese es el motivo de que el item 41 fuera
  indiagnosticable.
- `stderr` queda **vacio**: todo sale por stdout, y a stdout no llega.
- No existe flag `--verbose` en `migrate` en esta version:
  `Unrecognized options for command 'migrate': --verbose`.
- **`CI: true` NO sirve.** `process.env.CI` aparece **0 veces** en
  `drizzle-kit/bin.cjs`. Se probo en el job `seed` y el output quedo
  identico. Se revirtio.
- Un shim que difiera `process.exit` **tampoco sirve**: como la vista no
  renderiza el error, no hay nada que esperar.

### Reproduccion local (sin CI)

```powershell
$env:DATABASE_URL = "postgresql://u:p@host.invalid.tld:5432/db"
cd packages/db
pnpm exec drizzle-kit migrate 2>&1
# -> spinner + exit 1 + CERO mensaje. Identico a CI.
```

Esto permite iterar el diagnostico sin gastar un ciclo de CI de ~20 min.

### Mitigaciones

1. **Step de diagnostico previo en CI** que imprima el estado del entorno
   (si `DATABASE_URL` esta seteada y su host). Implementado en `e2e.yml`.
   Es lo que permite diagnosticar hoy.
2. **Wrapper propio** que llame a la migracion sin pasar por
   `renderWithTask`, para que la excepcion se propague y Node la
   imprima. Requiere alcanzar internos de drizzle-kit, que no son
   parte del API publico (`api.d.ts` solo exporta `generate*`, `push*` y
   `studio*`).
3. **Upgrade de `drizzle-kit`** cuando corrijan el bug. La ultima version
   al 2026-10-02 es `0.31.11`, pero **hanji sigue en `0.0.8`**: el bug
   vive en hanji, asi que actualizar drizzle podria no bastar. Probar el
   upgrade es barato, pero no esta garantizado.

**Nota sobre el estado de hanji:** es una libreria muy chica
(versiones `0.0.3` a `0.0.8`) y tightly coupled al flujo de
renderizado de drizzle. El riesgo de que el fix upstream llegue rapido
es bajo.

**Origen:** descubierto durante el diagnostico del item 41.

**Severidad:** ALTA.

**Urgencia:** MEDIA-ALTA. No bloquea el desarrollo local (ahi el error
si se ve porque hay TTY), pero hace **indiagnosticable cualquier fallo
de migraciones en CI**, que es donde las migraciones se ejecutan de
verdad.

**Referencias:** `drizzle-kit@0.31.10`, `hanji@0.0.8`, item 41.

**Nota:** `ci.yml` crea un `.env.local` propio con URLs dummy, asi que el
job `build` no esta afectado. El job `seed` de `e2e.yml` exporta
`DATABASE_URL` como env var del step, tampoco afectado. El problema es
exclusivamente de desarrollo local.

**Origen:** descubierto durante el diagnostico del item 41.

**Severidad:** MEDIA.

**Urgencia:** MEDIA.

---

## 44. `pnpm db:seed` trunca PRODUCTION en cada run de CI

**Estado:** abierto (2026-10-03). **Severidad BAJA durante desarrollo.**

**Decision del humano:** en la etapa actual **no hay clientes reales** y
los datos son **regenerables con `pnpm db:seed`**. El riesgo es
aceptable. El guard propuesto queda como **defensa a futuro**, no como
necesidad actual.

## Mecanismo

El job `seed` de `.github/workflows/e2e.yml` corre:

```yaml
- run: pnpm db:migrate && pnpm db:seed
  env:
    DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
```

Y `packages/db/seed.ts` ejecuta `TRUNCATE TABLE ... CASCADE` sobre
**10 de las 13 tablas** del baseline antes de insertar datos de prueba:
`plans`, `order_items`, `orders`, `product_variants`, `product_images`,
`products`, `categories`, `customers`, `admin_users`, `tenants`.

`NEON_DATABASE_URL` y `NEON_DATABASE_APP_URL` apuntan ambos a
production. **Por lo tanto, cada push a `develop` borra los datos de
development y los reemplaza con el seed de prueba.**

## Nota: 3 tablas no se truncan

`subscriptions`, `shipping_methods` y `tenant_mp_config` quedan fuera
del TRUNCATE. **`subscriptions` es la relevante para Fase 2**: las
suscripciones creadas por los tests no se limpian entre runs, asi que
pueden quedar filas huerfanas que confundan el debug de E2E de
suscripciones (exactamente lo que vendra en T4/T5). No es un bug hoy
porque no hay suscripciones reales, pero es un factor a tener en cuenta
cuando esas tareas creen filas.

## Impacto durante desarrollo

- **Los datos de development se regeneran** con un `pnpm db:seed`.
- **Los E2E corren contra la misma base**, asi que un test mal escrito
  puede modificar datos compartidos.
- El job pasa en verde: **no hay aviso** de que se trunco nada.
- Un `pnpm db:seed` manual borra los datos que E2E acaba de preparar, y
  viceversa.

## REEVALUAR OBLIGATORIAMENTE antes de

1. **Primer tenant con datos reales.**
2. **Cualquier deploy a produccion que reciba trafico.**

En cualquiera de esos dos momentos esto pasa de BAJA a ALTA y el
impacto deja de ser reversible con un `db:seed`.

## Fix preparado (NO aplicado)

Guard en `seed.ts` que refuses si el host de `DATABASE_URL` es el de
production y `CI=true`, salvo que se setee `ALLOW_PROD_SEED_IN_CI=true`.

**Por que un guard por host y no por `NODE_ENV`:** el guard actual solo
chequea `NODE_ENV`, y **CI no setea `NODE_ENV`**, asi que pasaria sin
darse cuenta en el runner. El host de Neon identifica la base con
certeza; `NODE_ENV` no.

Alternativa de infraestructura: rama de Neon dedicada para CI (es el
objetivo del transversal, "T0.3 branching en Neon").

**Recordatorio de go-live:** el punto esta agregado a la seccion
**"Fase 10 - Go-live y checklist final"** de
`docs/superpowers/specs/2026-09-blueprint-v2.6.md`, como requisito previo
al primer cliente real.

**Origen:** detectado al verificar por que E2E paso a verde.

**Severidad:** BAJA (desarrollo).

**Urgencia:** BAJA, con reevaluacion obligatoria en los dos hitos de
arriba.

---

## 45. E2E fallaba por split de base de datos

**Estado:** **Resuelto (2026-10-03)** por cambio de configuracion, no de
codigo.

## Sintoma

El job `e2e` fallaba con 33 tests pasando y 1 fallando:

```
Expected: "confirmed"
Received: "pending_payment"
e2e/webhook/webhook-signature.spec.ts:92
```

## Causa

Los dos extremos de la prueba usaban bases distintas:

| Componente                                                    | Variable                                          | Base         |
| ------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| `e2e/webhook/webhook-signature.spec.ts` (crea y lee la orden) | `DATABASE_URL`                                    | rama de Neon |
| Webhook en Vercel (actualiza la orden)                        | `DATABASE_APP_URL` (`packages/db/src/index.ts:6`) | production   |

La orden se creaba en la rama. El webhook la buscaba en production, no
la encontraba, y no la actualizaba. El test releia la rama y veia
`pending_payment`.

## Resolucion

`NEON_DATABASE_URL` se restauro a production (`2026-10-03T03:16:11Z`),
quedando ambos secrets en la misma base. Los 4 jobs del run
`37088993766` quedaron en `success`.

## Deuda que deja

Esta resolucion **empeoro el item 44**: al unificar en production, el
`seed` paso a truncar production en cada run. Volver a apuntar CI a una
rama reintroduce el split del E2E salvo que **los dos secrets** apunten
a la rama (no solo `NEON_DATABASE_URL`).

**Lecion:** los dos secrets de base deben moverse **juntos**. Mover solo
uno produce exactamente este fallo, con un sintoma que no parece de
configuracion.

**Decision consciente, no un bug corregido.** La resolucion fue mover
un secret, no cambiar codigo. **Si en el futuro se vuelve a mover uno
solo de los dos secrets, el split reaparece** con un sintoma que no
parece de configuracion: una orden existe en una base y el webhook
busca en otra. El fallo se manifiesta como un assert de Playwright
(`Expected: "confirmed"`), que no sugiere en absoluto un problema de
bases.

Al tocar cualquiera de los dos secrets de base, verificar **los dos**.

**Origen:** detectado durante el diagnostico del item 41.

**Severidad:** INFO (resuelto).

**Urgencia:** N/A.

**Reevaluar:** junto con el item 41 (mismo pipeline de migraciones).

---

## 46. `seed.ts` no trunca `subscriptions` ni `tenant_mp_config`

**Estado:** abierto (2026-10-03).

## Hecho

`packages/db/seed.ts` ejecuta `TRUNCATE TABLE ... CASCADE` sobre **10 de
las 13 tablas** del baseline. Quedan fuera **tres**:

| Tabla              | Se trunca | Por que importa               |
| ------------------ | --------- | ----------------------------- |
| `subscriptions`    | NO        | **La tabla de Fase 2**        |
| `tenant_mp_config` | NO        | Config por tenant             |
| `shipping_methods` | NO        | Catalogo, lo repuebla el seed |

## Impacto en Fase 2

Las suscripciones creadas por los tests **no se limpian entre runs**. Cuando
T4 (endpoints) y T5 (webhook) creen filas en `subscriptions`, un test puede
leer filas residuales de un run anterior y obtener:

- **Falsos positivos:** el test pasa porque encontro una suscripcion vieja en
  lugar de la que acaba de crear.
- **Falsos negativos:** el test falla por conflicto de datos de una corrida
  previa, y se reintenta sin causa real.

El riesgo es **tests flaky**, que es peor que un fallo claro porque
entrena al equipo a reintentar sin investigar.

Hoy no es un bug: no hay suscripciones reales. Se vuelve relevante en T4.

## Mitigaciones

1. **Agregar `subscriptions` y `tenant_mp_config` al TRUNCATE de
   `seed.ts`.** Es el fix directo y mantiene la garantia "dejar la base como
   estaba". Evaluar si `shipping_methods` tambien debe entrar.
2. **Documentar que T4/T5 deben limpiar explicitamente** las filas que crean,
   en un `beforeAll` propio del spec. Menos invasivo, pero cada spec nueva
   tiene que acordarse.

**Preferible la 1:** centralizar el estado limpio en un solo lugar es mas
robusto que confiar en que cada test recuerde limpiar.

## Relacionado

- **Item 44:** el TRUNCATE es el mecanismo destructivo de este item.
- **Item 45:** los secrets de base deben moverse juntos.

**Origen:** detectado al inventariar las tablas del TRUNCATE durante el
diagnostico del item 44.

**Severidad:** MEDIA.

**Urgencia:** MEDIA - no bloquea Fase 2, pero puede causar tests flaky en T4.

**Reevaluar:** antes de T4 (endpoints de suscripciones).

---

## 47. La validación de env vars es global, no per-app

**Estado:** abierto (2026-10-03).

## Hecho

`packages/validation/src/env.ts` define **un solo schema de producción** para las
tres apps. Con el PR #185, `MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET`
pasaron a ser obligatorias en `productionSchema`. Pero **solo `apps/admin` las usa**:
son las credenciales de la cuenta de plataforma para cobrar suscripciones
(`POST /preapproval`, firma del webhook de suscripciones).

Storefront y superadmin no las necesitan para nada, y sin embargo `validateEnv()`
tira y **no arrancan** si faltan.

## Impacto

1. **Fuerza a configurar variables innecesarias en 2 de los 3 proyectos de Vercel.**
   Es superficie de exposición gratuita: el token de la plataforma vive en el
   entorno de dos procesos que jamás lo leen.
2. **Bloquea merges.** Cualquier PR que agregue una var de un solo scope frena
   los tres deploys hasta que se configuren las tres.
3. **Falla de forma opaca.** El mensaje dice "Invalid environment variables for
   PRODUCTION: MP_PLATFORM_ACCESS_TOKEN is required in production" en el log de
   una app que no la usa. Nada indica que el problema es de diseño del schema.

## Evidencia (PR #185, 2026-10-03)

| Momento                                            | Resultado      |
| -------------------------------------------------- | -------------- |
| Preview deploy de `storefront`                     | **FAILURE**    |
| Preview deploy de `superadmin`                     | **FAILURE**    |
| Preview deploy de `saas-admin`                     | SUCCESS        |
| Tras configurar `MP_PLATFORM_*` en los 3 proyectos | Las 3 en verde |

**Salvedad honesta:** `admin` pasó _antes_ de la corrección. Si la causa fuera
`validateEnv()`, las tres deberían haber fallen. No hay evidencia de que el fallo
fuera exclusivamente la validación: podría haber un factor propio de storefront y
superadmin (dos de los tres son las que corren `next build` con el store de
`NODE_ENV=production` completo). La correlación "configurar → verde" es fuerte,
pero **la causalidad no está probada**. Por eso este item registra el defecto de
diseño —que es real e independiente del incidente— y no afirma que el incidente
fuera exclusivamente por esto.

## Mitigaciones

1. **Scope por app en `validateEnv(scope)`.** Cada app declara qué vars exige:
   ```ts
   validateEnv({
     app: 'admin',
     requires: ['MP_PLATFORM_ACCESS_TOKEN', 'MP_PLATFORM_WEBHOOK_SECRET'],
   })
   ```
   Es la opción que resuelve la raíz y la que Reduce el acoplamiento: cada app
   declara lo que realmente necesita (superadmin y storefront nunca cobran
   suscripciones).
2. **Schema base + extend por app.** `productionBaseSchema` + `adminProductionSchema`
   que agrega las de plataforma. Menos invasivo que cambiar la firma, pero
   duplica el punto de entrada.
3. **Aceptarlo y documentarlo.** Deja el problema como está: la app que no usa la
   var igual la exige. Descartada.

**Preferible la 1:** el scope ya existe conceptualmente (las tres apps importan el
mismo paquete pero cada una lo consume distinto); falta pasarlo de comentario a
parámetro.

## Relacionado

- **Item 42:** `drizzle.config.ts` no carga dotenv — mismo eje: configuración que
  se toma del entorno global en vez de por consumidor.
- **PR #185 (T2):** donde se materializó.

**Origen:** detectado al mergear el PR #185. Los preview deploys de storefront y
superadmin fallaron con las vars sin configurar; configurar las tres los dejó en
verde.

**Severidad:** MEDIA. Bloquea merges de PRs que agregan vars; no rompe producción
mientras las vars estén configuradas.

**Urgencia:** MEDIA.

**Reevaluar:** antes de T4 (admin empieza a usar MercadoPago en serio) — a partir
de ahí, la diferenciación de scopes deja de ser higiene y pasa a ser requisito.
---

## 48. Conversión centavos ↔ unidad de moneda en el borde de MercadoPago

**Estado:** ✅ **RESUELTO (2026-10-04)** — PR `chore/fix-48-49-50`.

**Resolución:** `packages/commerce/src/mp-amounts.ts` con `toMpAmount` y
`fromMpAmount`, exportados por `@repo/commerce`. Las **3** conversiones inline
`/ 100` que quedaban en T4 se reemplazaron por el helper (`preapproval` L160,
`plan` L233 y L268). `grep` confirma **0** conversiones inline restantes hacia
MercadoPago. 12 tests nuevos, incluido el que falla si se saca el `Math.round`
de `fromMpAmount` (sin él, `29` roundtrip a `28.999999999999996`).

**Lo que NO se hizo (deliberado):** la parte 2 de la mitigación 1 —tipar
`CreatePreapprovalInput` y `updatePreapproval` en centavos para que el tipo
obligue a convertir. Eso cambiaría el contrato del wrapper de T3 y excede este
PR. La protección actual es de disciplina (helper nombrado), no de tipos.

**No se tocó `email.ts`:** sus dos `/ 100` son `(total / 100).toFixed(2)` para
**mostrar** un precio en un email, no una conversión hacia MP. Usar un helper
llamado `toMpAmount` ahí sería mentir sobre el dominio.

## Hecho

Nuestra persistencia trabaja en **centavos** (integer) por convención de
`AGENTS.md`. La API de MercadoPago espera el monto **en la unidad de la moneda**
(`transaction_amount: 49`, no `4900`). Son dos convenciones distintas y el punto
de contacto entre ambas es una división por 100 que hoy está **escrita a mano en
cada endpoint**.

Durante T4, `POST /api/subscriptions/preapproval` mandaba
`transactionAmount: plan.priceUyu` sin dividir: **4900 en vez de 49**. Lo detectó
el test de contrato `manda el precio en la moneda de MP, no en centavos`. Se
corrigió con un `/100` explícito en ese endpoint, y el mismo criterio se aplicó
en `PUT /api/subscriptions/plan`.

## Impacto

1. **Sobrecobro silencioso de 100x.** Es un error de dinero, no un crash: MP
   acepta el monto happily, cobra 100 veces más, y nada en el sistema falla.
   Ningún test de integración existente lo habría atrapado.
2. **La conversión está duplicada y cada endpoint puede olvidarla.** Hoy hay dos
   `/100` escritos a mano. El próximo endpoint que hable con MP (T5, o un
   endpoint de cobro de una sola vez) repite la decisión.
3. **El error inverso es igual de caro.** Si MP devolviera centavos y lo
   leyéramos como unidades, el crédito de un `downgrade` sería 100x. Hoy solo se
   verificó en la dirección centavos → unidad.
4. **Trampa de tipos en `updatePreapproval`.** El wrapper de T3
   (`packages/commerce/src/mp-subscriptions.ts`) ya envuelve solo el argumento en
   `auto_recurring.transaction_amount`. Pasar `auto_recurring` explícito desde un
   endpoint es error de tipos _y_ duplicación; el compilador ata esa mitad del
   problema pero no la conversión.

## Mitigaciones

1. **Helper único en `packages/commerce`, con el nombre documentando la
   dirección.** Es la que elimina el error de verdad:
   ```ts
   export function centsToMpAmount(cents: number): number
   export function mpAmountToCents(amount: number): number
   ```
   Además, tipar la entrada de `CreatePreapprovalInput` y de `updatePreapproval`
   **en centavos**, de modo que el sistema de tipos obligue a convertir y no
   dependa de la disciplina de quien escribe el endpoint.
2. **Wrapper de alto nivel** `setPreapprovalPlan({ preapprovalId, priceCents })`
   que ya hace la conversión. Menos invasivo, pero deja la conversión opcional.
3. **Documentarlo en `AGENTS.md`** junto a la regla de precios. Descartada: no
   previene nada, solo informa después del error.

**Preferible la 1:** el defecto es un contrato implícito entre dos sistemas con
convenciones opuestas. Un comentario no lo convierte en invariante; el tipo sí.

## Relacionado

- `AGENTS.md`, sección "Precios siempre en centavos (integer)": la convención que
  hace necesaria esta conversión.
- **PR #189 (T4):** donde se detectó y se mitigó a mano.
- **Memoria 127 (T3):** ya documenta la convención de signos del prorrateo, que
  depende de la misma conversión.

**Origen:** detectado durante T4 (PR #189) por TDD, al escribir el test de
contrato del endpoint `preapproval`.

**Severidad:** ALTA. Es dinero: un error de un factor 100 en un cobro.

**Urgencia:** MEDIA. Los dos endpoints de T4 ya están corregidos, así que no hay
un cobro roto **hoy**. Pero la causa raíz —la conversión manual en cada
endpoint— sigue presente, y T5 agrega endpoints que hablan con MP.

**Reevaluar:** antes de T5 y antes de exponer cualquier endpoint nuevo a
MercadoPago. Con la helper en `packages/commerce`, el costo es de un rato.

---

## 49. `paused` implementado pero ausente del transversal

**Estado:** ✅ **RESUELTO (2026-10-04)** — PR `chore/fix-48-49-50`. Actualizado el
transversal a **7 estados**. **Sucesor del item 38.**

**Resolución:** `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
actualizado — §1 (título, tabla de estados, diagrama, tabla de disparadores),
§2 (columna `paused` + filas `canPause`/`canResume`, bloque de detalle) y §6
(mapeo de topics). Se registró además la **decisión de producto de opción B**
para la activación, y la eliminación de la transición `cancelled → active`.

**Correcciones de exactitud queulgieron en el mismo PR** (estaban documentadas
como válidas y el spike las refutó):

- Se **eliminó `cancelled → active`** del diagrama, de la tabla de disparadores
  y del detalle de `cancelled`. MP devuelve **400**. La cancelación es
  irreversible; el doc decía lo contrario e inducía a construir un flujo roto.
- Se reemplazó el bloque "Estado `paused` de MP — no modelado" y la fila
  `subscription_preapproval (paused) → (sin cambio)` de §6, que contradecían el
  código ya mergeado.
- Se documentó que `live_mode` **solo viene en `payment`**; los topics de
  suscripción no lo incluyen, así que "ausente" ≠ `false`.

**Discrepancia que queda ABIERTA (no es deuda de este item):** el doc incluye
`paused → cancelled` porque MP la acepta, pero `derivePermissions` devuelve
`canCancel: false` para `paused`. Está anotado en §1 del transversal. Decidir si
se expone el botón "Cancelar" en una suscripción pausada.

**Validación empírica pendiente:** el preapproval `24b2a868` quedó pausado el
2026-10-03. El **2026-11-03** se verifica si MP intentó cobrar durante la pausa.

## Hecho

T4 (PR #189) agregó el estado `paused` a `SubscriptionStatus` en
`packages/commerce/src/subscription-permissions.ts`, con `canPause` y
`canResume`. El transversal
`docs/superpowers/specs/2026-09-subscription-lifecycle.md` **sigue listando 6
estados** en la sección 1 y no lo contempla en la tabla de reglas por estado de
la sección 2.

La matriz real quedó en **7 estados × 8 permisos**, no 6 × 6: `paused` es el
único estado con `canResume`, y `canPause` solo aplica desde `active`.

## Decisión de producto (Luis, review de #188, 2026-10-03)

El scope de T4 cambió: **`reactivate` sale** (MP responde 400 a
`cancelled → authorized`) y **`pause` + `resume` entran**. Esto **reemplaza** la
decisión del item 38 ("no soportado en Fase 2", "el webhook registra `warn` y no
transiciona"). La fuente es el review de aprobación de #188, no un documento
normativo: por eso este item existe.

Semántica que T4 fijó y que el transversal debe recoger:

| Aspecto                    | Decisión de T4                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Qué hace                   | MP deja de debitar. El tenant conserva storefront y panel.                                          |
| `canPause`                 | Solo desde `active`.                                                                                |
| `canResume`                | Solo desde `paused`.                                                                                |
| `canAccessPanel`           | `'limited'`, no `'readonly'`: el tenant pausado tiene una acción útil (`resume`).                   |
| `canCancel` desde `paused` | `false`. Se ofrece "reanudar", no "irse".                                                           |
| Relación con `past_due`    | Son distintos. `past_due` es impago (dunning, gracia de 7 días); `paused` es suspensión voluntaria. |
| Reversibilidad             | Por diseño: `cancel` es terminal en MP, así que `paused` es el único camino de vuelta.              |

## Impacto

1. **El transversal es la fuente normativa y quedó desalineado del código.**
   Quien lo lea sin este item implementa 6 estados y no puede representar
   `paused`. El código ya tiene 7.
2. **El item 38 dice hoy lo contrario de lo que T4 hace.** El material de T5 que
   lo lea va a loguear `warn` y **no va a transicionar** `paused`. Con T4 eso
   está mal: la transición la dispara **nuestra propia API** (`POST /pause`). El
   resultado sería un tenant al que la UI muestra `active` para siempre mientras
   MP no le cobra. Falla silenciosa, y es exactamente la divergencia que el item
   38 quería evitar.
3. **Riesgo de revertirse.** El próximo PR que "arregle el transversal" puede
   eliminar `paused` del código para hacerlo coincidir con el doc. De ahí el TODO
   explícito en `subscription-permissions.ts` y en su test.

## Mitigaciones

1. **PR transversal** (lo pedido): agregar `paused` a la sección 1 (lista de
   estados) y a la sección 2 (tabla de reglas por estado), con la semántica de
   la tabla de arriba.
2. **Basta con documentarlo en el código.** Descartada: el transversal es la
   fuente normativa. Dos fuentes que divergen son peores que una desactualizada
   y marcada como conocida.

## Relacionado

- **Item 38:** decisión anterior, ahora superada. Se conserva el registro original
  con un puntero acá para que no se siga usando como guía vigente.
- **PR #188:** review donde se decidió el cambio de scope.
- **PR #189 (T4):** implementación que introduce la divergencia.

**Origen:** detectado durante T4 (PR #189).

**Severidad:** MEDIA. No rompe nada por sí sola; es documentación desalineada con
el código, pero su consecuencia (el punto 2 de Impacto) sí rompe el flujo.

**Urgencia:** ALTA antes de T5. Es el único item de este PR con fecha impuesta
por otro trabajo: T5 escribe el webhook que debe transicionar `paused`, y hoy el
material de referencia le dice que no lo haga.

**Reevaluar:** antes de escribir T5. Después de T5, `paused` deja de ser
documentación pendiente y pasa a ser comportamiento cubierto por tests.
---

## 50. `AGENTS.md` afirmaba que `openspec/` no existía cuando sí existe

**Estado:** ✅ **RESUELTO (2026-10-04)** — PR `chore/fix-48-49-50`. Registrado y
resuelto en el mismo PR.

## Hecho

`AGENTS.md` decía, en la sección "SDD Workflow":

> **Estado en este repo**: SDD NO está inicializado — no existen `openspec/`,
> `.sdd/` ni `changes/`. El primer uso requiere `/sdd-init`.

Eso es **falso**. Existe `openspec/config.yaml`, agregado por el commit
`9af860e` (**PR #163**, 2026-10-01, "docs(fase2): planificacion SDD de webhook
suscripciones + checkout"). `openspec/` está **rastreado por git**, no ignorado.

`SETUP.md` repetía la misma afirmación falsa en su sección de SDD.

## Impacto

1. **Un agente que leyera AGENTS.md concluiría que tiene que correr `/sdd-init`
   sobre un repo ya inicializado**, que sobreescribiría `openspec/config.yaml`.
2. **El modo real se ocultaba.** SDD está en `hybrid` (Engram + `openspec`), que
   es lo que determina dónde persisten los artefactos. Decir "no inicializado"
   hace que un agente elija el store equivocado sin saberlo.
3. **Era la segunda fuente de contradicción** después del item 38: el doc
   decía una cosa y el disco otra. Con el item 49 corregido, esta era la última
   afirmación de estado que mentía sobre el repo.

## Nota sobre el origen del error

La afirmación se volvió falsa **el mismo día que se creó el directorio**: el
PR #163 agregó `openspec/config.yaml` y, en el mismo commit, 14 líneas a
`AGENTS.md`. La sección SDD se escribió asumiendo que SDD no se iba a inicializar
en este repo. Tres días después el repo la contradijo y el texto no se actualizó.

El patrón: un doc de estado escrito en el mismo commit que crea el hecho que lo
contradice. Vale la pena revisar los demás "estado actual" de `AGENTS.md` y
`SETUP.md` con la misma lupa.

## Resolución

- `AGENTS.md`: la línea ahora dice que SDD **está** inicializado en modo `hybrid`,
  cita el commit `9af860e` y el PR #163, aclara que **no** existen
  `openspec/specs/`, `openspec/changes/` ni `.sdd/`, y cierra con "la
  infraestructura está, el contenido no".
- `SETUP.md`: misma corrección en su sección de SDD.

Se corrigieron **los dos** archivos, no solo `AGENTS.md`: dejar `SETUP.md` con la
misma falsehood perpetuaría el error en el documento de onboarding, que es
justamente donde alguien lo lee antes de arrancar.

## Relacionado

- **Item 38 / 49:** mismo eje — documentación que contradice el código.
- **PR #163:** donde se creó `openspec/config.yaml`.

**Origen:** detectado durante T4 (PR #189), al limpiar el worktree y ver un
`openspec/` que AGENTS.md declaraba inexistente. Registrado al resolver los
items 48 y 49.

**Severidad:** BAJA. No rompe nada por sí sola; misleadea a quien lee.

**Urgencia:** BAJA. Resuelto en este PR.

**Reevaluar:** en la próxima auditoría documental, aplicar la misma lupa a los
otros "estado actual" de `AGENTS.md` y `SETUP.md`. Un doc de estado escrito en el
mismo commit que crea el hecho que lo contradice tiene una vida útil corta.
---

## 51. `paused` no podía cancelar: decisión de producto, implementar

**Estado:** ✅ **RESUELTO (2026-10-04)** — PR `chore/paused-can-cancel`.
Registrado y resuelto en el mismo PR, porque la decisión ya estaba tomada: solo
faltaba implementarla.

## Hecho

El PR #191 (items 48/49/50) documentó en el transversal que `paused → cancelled`
existe en MercadoPago, pero marcó una **discrepancia abierta**: la matriz de
permisos decía `canCancel: false` para `paused`, así que nuestra API no la
exponía y la UI solo ofrecía "reanudar".

**Decisión de producto (Luis, 2026-10-04): opción A — `canCancel: true` para
`paused`.** `paused` significa "suspender el cobro", no "bloquear acciones".

## Por qué no era solo un cambio de bandera

El bug no estaba solo en la matriz. `POST /api/subscriptions/cancel` tiene
`allowedFrom: ['active']` y rechazaba `paused` con 409, con un test que
afirmaba ese comportamiento ("hay que reanudar antes de cancelar").

Si se hubiera cambiado **solo** `canCancel` a `true`, la UI habría mostrado un
botón "Cancelar" que siempre devolvía 409. La decisión queda implementada en las
**dos** capas o no queda implementada:

1. `derivePermissions`: `canCancel: true` para `paused`.
2. `POST /cancel`: `allowedFrom: ['active', 'paused']`.

Los dos archivos tienen ahora el mismo comportamiento y hay tests que lo fijan
en cada capa.

## Impacto de haberlo hecho en dos capas

Es el mismo modo de fallo que el item 38 (documentación que contradice al
código), invertido: acá la documentación decía una cosa y el código otra
—inconsistencia interna del código, no entre doc y código—. Un gate que solo
verifica la matriz de permisos no alcanza: hay que verificar también la lista
de estados que acepta cada endpoint de mutación.

**Para T5:** los endpoints de mutación son la frontera real. La matriz de
permisos decide qué botón se muestra; el endpoint decide si funciona. Si
divergen, el síntoma es un 409 inexplicable para el usuario.

## Resolución

- `packages/commerce/src/subscription-permissions.ts`: `canCancel: true` para
  `paused`, con el razonamiento en el comentario.
- `apps/admin/app/api/subscriptions/cancel/route.ts`: `allowedFrom` acepta
  `paused`; `conflictMessage` actualizado para no decir "solo activa".
- Tests: snapshot de la matriz actualizado, 2 tests nuevos en permisos, y el test
  de `mutations.test.ts` que afirmaba el 409 desde `paused` convertido en 202.
- Transversal §2: agregada la fila "Cancelar la suscripción" con ✅ en `active`
  y `paused` (la tabla no tenía ninguna fila de cancelar). Reemplazada la nota
  de "discrepancia abierta" por la decisión.

## Relacionado

- **Item 49:** donde se documentó `paused` y se dejó la discrepancia anotada.
- **Item 38:** el mismo eje de documentación que contradice al código.

**Origen:** detectado al implementar el item 49 (PR #191) y resuelto por
decisión de producto en el mismo día.

**Severidad:** MEDIA. Sin este fix, la UI podía ofrecer una acción que siempre
devolvía 409.

**Urgencia:** BAJA. Resuelto en este PR.

**Reevaluar:** no. Quedó alineado en las dos capas y con tests en cada una.
---

## 52. El escaneo del item 40 no cubre caracteres de control

**Estado:** abierto (2026-10-04). Descubierto en T5.

## Hecho

El metodo de escaneo que prescribe el item 40 cubre solo dos clases de
caracteres:

```
if ($l[$i] -match '[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]') { "CJK L$($i+1)" }
if ($l[$i] -match "\uFFFD")                              { "MOJIBAKE L$($i+1)" }
```

Los **caracteres de control** (U+0000-U+0008, U+000B-U+001F) no estan
cubiertos. Durante T5, dos reemplazos bulk con PowerShell los introdujeron y
**no fueron detectados por ningun control del proyecto**:

| Control      | Donde                           | Como se leyo        | Codigo real          |
| ------------ | ------------------------------- | ------------------- | -------------------- |
| U+0007 (BEL) | comentario de `FAILURE_ACTIONS` | `pproved`           | `approved`           |
| U+0007 (BEL) | comentario de `HandleInput`     | `ction del payload` | `action del payload` |
| U+000B (VT)  | comentario de acceso a env      | `alidateEnv()`      | `validateEnv()`      |

Los tres **reemplazaron una letra**, no se insertaron: el archivo sigue siendo
UTF-8 valido, asi que `pnpm lint`, `tsc`, `vitest` y `prettier` los pasaron
sin quejarse. El texto era correcto salvo por un caracter invisible.

**Los encontro el hook GGA**, no el DoD. Con 682 tests en verde, el unico
control del proyecto que los ve es el pre-commit.

## Impacto

1. **Fallo silencioso en comentarios**, que es donde menos se nota: un
   identificador mal escrito en un comentario no rompe nada hasta que alguien
   copia el fragmento "arreglado".
2. **El mecanismo de scan esta incompleto**, asi que cualquier agente que siga
   el item 40 al pie de la letra hereda el mismo punto ciego.
3. **Los reemplazos bulk de PowerShell son la causa raiz**, no los archivos
   viejos. Un archivo sano que pasa por un `[System.IO.File]::WriteAllText`
   con un `.Replace()` puede quedar asi. Por eso el item 25/26 (reparar
   doble encoding) reaparece: la causa nunca estuvo en los archivos.

## Mitigacion

Ampliar el escaneo del item 40 para incluir control chars. Por codepoint, no
por regex, porque un caracter de control en un rango se confunde con el
renderizado de la consola:

```powershell
$l = [System.IO.File]::ReadAllLines(<archivo>, [System.Text.Encoding]::UTF8)
$bad = 0
for ($i = 0; $i -lt $l.Count; $i++) {
  foreach ($c in $l[$i].ToCharArray()) {
    $n = [int]$c
    if (($n -ge 0x4e00 -and $n -le 0x9fff)) { "CJK L$($i+1)"; $bad++ }
    if ($n -eq 0xFFFD)                          { "FFFD L$($i+1)"; $bad++ }
    if (($n -lt 9) -or ($n -ge 11 -and $n -le 31)) {
      "CTRL U+$('{0:X4}' -f $n) L$($i+1)"; $bad++
    }
  }
}
```

**Por que enumerar codepoints y no regex:** durante T5 un escaneo por regex
reporto como CJK la flecha `->` (U+2192), porque la consola la renderiza como
basura. El codigo estaba limpio y el scan mentia. Con `[int]$c` no hay
interpretacion de por medio.

**Excluir el archivo entero:** el `text` declarado en el ejemplo de arriba esta
como referencia; el resto de las ramas del item 40 se mantienen.

## Relacionado

- **Item 40:** el metodo de escaneo que hay que ampliar.
- **Items 25 y 26:** el doble encoding preexistente en `bitacora.md` y
  `deuda-tecnica.md`.-alli la causa fueron los archivos; aca fue la
  herramienta.
- **Memoria 114:** ya documenta que escanear la salida de `git` es
  estructuralmente incapaz de detectar CJK. Este item es el complemento: el
  archivo correcto escaneado con el patron incorrecto tampoco alcanza.

**Origen:** descubierto en T5 (PR #193) por el hook GGA, con el DoD completo en
verde.

**Severidad:** MEDIA. No rompe codigo ejecutable; rompe la confianza en los
comentarios y deja el scan con un punto ciego conocido.

**Urgencia:** BAJA. Sin datos ni cashflow comprometidos.

**Reevaluar:** en el proximo PR de docs. Es un cambio de una linea en el item 40.

---

## 53. La activacion por preapproval no guarda el invoiceId

**Estado:** abierto (2026-10-04). **Decision tomada; documentada para que no se
reabra sola.**

> **Titulo preciso, porque la formulacion corta era falsa.** `lastProcessedPaymentId`
> **NO esta sin uso**: el handler lo escribe para los eventos de topic `payment`
> y lo lee como guarda de pago ya procesado. Lo que no ocurre es que la
> activacion disparada por `subscription_preapproval` guarde el invoiceId.

## Hecho

El design §6.3 pide, para la transicion 1
(`preapproval.authorized` → `active`), setear
`lastProcessedPaymentId = invoiceId`.

**No es implementable en ese evento.** Verificado en el spike #188:
`subscription_preapproval.data.id` es el **id del preapproval**. El id de la
invoice viaja en `subscription_authorized_payment`, que es un topic distinto y
llega antes.

La estructura del codigo quedo asi:

| Evento                     | `lastProcessedPaymentId` | Por que                                            |
| -------------------------- | ------------------------ | -------------------------------------------------- |
| `payment`                  | **se escribe** (L522)    | Su `data.id` ES un id de pago                      |
| `payment`                  | **se lee** (L501)        | Guarda de pago ya procesado, evita doble escritura |
| `subscription_preapproval` | no se toca               | Su `data.id` no es un id de pago                   |

Guardar el id del preapproval en una columna llamada
`lastProcessedPaymentId` seria **mentir sobre el dato**: la guarda dejaria de
distinguir un pago de un preapproval, y un id de preapproval comparado contra
un id de pago nunca coincide, o sea la guarda dejaria de servir sin que nadie lo
note.

## Decision (Luis, 2026-10-04)

Dejar solo **convergencia de estado**. La idempotencia es por construccion: si
el estado local ya es el objetivo, no se escribe. Es stateless y aguanta
cualquier cantidad de reintentos de MercadoPago, que es el caso real.

El invoiceId no aporta en esta fase: no hay auditoria de pagos que lo necesite.

**Alternativa descartada:** guardar el invoiceId con el lookup extra
`GET /authorized_payments/search?preapproval_id={id}` en cada evento de
preapproval. Cuesta una llamada a MP por evento para guardar un dato que
nadie lee.

## Fase 3

Si hace falta auditoria de pagos, un **cron de reconciliacion** con acceso a
todos los eventos historicos resuelve mejor que guardar el invoiceId en el
handler: el handler ve un evento a la vez y no puede reconstruir historia; el
cron si.

## Relacionado

- **PR #193 (T5):** donde se implemento la decision.
- **Design Fase 2 §6.3:** la linea original que pide el invoiceId.

**Origen:** detectado al implementar T5.

**Severidad:** INFO. No es un defecto: es una divergencia consciente entre el
design y la implementacion, documentada para que no se "arregle" sola.

**Urgencia:** N/A.

**Reevaluar:** al planificar Fase 3, si aparece un requisito de auditoria de
pagos.

---

## 54. El ciclo `mem_save` -> `vault:export` -> commit se realimenta solo

## Hecho

Exportar a `vault/engram/` **ensucia el working tree cada vez que se graba una
memoria nueva**. No es un fallo de un commit concreto: es una propiedad del
flujo.

Secuencia observada el 2026-10-05, con dos ciclos:

| Ciclo | Accion                         | Resultado en el arbol                                    |
| ----- | ------------------------------ | -------------------------------------------------------- |
| 1     | `mem_save` x5 + `vault:export` | 7 untracked (5 obs + session summary + indice de sesion) |
| 2     | commit + PR + merge            | limpio                                                   |
| 3     | `mem_save` x1 + `vault:export` | 1 modificado + 1 untracked                               |

El archivo `_sessions/<id>.md` es un indice: cada observacion nueva agrega una
linea `- [[<slug>]]` al final. O sea, **un export posterior reescribe un archivo
que ya estaba commiteado**, y el diff no es de una linea cualquiera: es el
resultado de haber gravado memoria.

## Impacto

El checklist de "working tree limpio" como **prerequisito** de una tarea deja de
ser una senal. En el PR #195 (exports) Hubo que frenar y pedir decision
humana por 7 archivos que ninguno era codigo. La rama de la auditoria
mid-phase se creo desde `develop` y no estaba bloqueada: un worktree es un
checkout limpio, no una copia del working tree principal. Ese es el unico
motivo por el que el ciclo no bloquea trabajo real.

Mientras tanto, cada `mem_save` vuelve a ensuciar el arbol y el proximo agente
que corra el checklist va a reportar un falso positivo.

## Mitigaciones

1. **Excluir `vault/engram/` del checklist de working tree limpio.** Es
   tool-managed, igual que `.env.local` y `node_modules/`. Es lo mas simple y
   lo que menos reglas agrega.
2. Un `.gitignore` parcial seria **incorrecto**: el proyecto quiere versionar
   `vault/engram/` (PR #195, #193, #191 lo hacen). Ignorarlo seria perder el
   registro.
3. Commitear los exports en el mismo PR del trabajo que los origino, en vez de
   en un PR propio. Reduce el ciclo a uno.

## Relacionado

- **PR #195:** primer PR donde se manifesto esto, con el export en PR separado.
- **Item 52:** el otro problema de la misma carpeta, con la diferencia de que
  ese si corrompe contenido.
- **AGENTS.md, "REGLA CRITICA - Orden de Engram":** el orden que produce el
  ciclo.

**Origen:** detenido durante la preparacion de la auditoria mid-phase de
Fase 2, al bloquear el checklist de working tree limpio con 7 untracked.

**Severidad:** BAJA. No rompe nada: agrega ruido y una decision humana
improvisada por sesion.

**Urgencia:** N/A. Resolver antes de que el patron se normalice en el
checklist de otras tareas.

---

## 55. GGA no audita archivos `.md`

## Hecho

`Gentleman Guardian Angel` v2.10.1, al commitear, reporta:

```
File patterns:    *.ts,*.tsx,*.js,*.jsx,*.sql
Exclude patterns: *test.ts,*spec.ts,*d.ts,dist/*,build/*,node_modules/*,vault/*
```

Un commit que solo toca markdown pasa por el hook **sin revisar nada**:
`No matching files staged for commit`, y el commit sale.

Esto es coherente con que `vault/` este excluido a proposito (los exports son
tool-managed). El problema es el alcance: **tampoco cubre specs, planes,
transversales ni README**, que si son autorales y si importan.

## Impacto

La unica defensa contra corrupcion de texto en `.md` es hoy un **scan manual**,
y ese scan vive en un item de deuda (el 40), no en ninguna automatizacion.
Consecuencia
directa: los caracteres de control que rompen texto pueden entrar en bitacora,
deuda tecnica o un spec, y **nada en el pipeline los va a marcar**.

El precedente ya ocurrio. El item 52 registro `U+0007` (BEL) y `U+000B` (VT)
inyectados en un `.ts` por reemplazo bulk con PowerShell:

| Caracter       | Efecto                                | Deteccion                    |
| -------------- | ------------------------------------- | ---------------------------- |
| `U+0007` (BEL) | `approved` -> `<BEL>pproved`          | GGA (por azar: era un `.ts`) |
| `U+000B` (VT)  | `validateEnv()` -> `<VT>alidateEnv()` | GGA (por azar: era un `.ts`) |

Si esos mismos reemplazos hubieran caído en `bitacora.md`, GGA no habria dicho
nada. Los archivos quedaron como UTF-8 valido y pasaron lint, `tsc`, vitest y
prettier con 682 tests en verde.

## Mitigaciones

1. **Extender GGA a `*.md`**, sacando `vault/engram/` de la exclusion pero
   manteniendo `vault/` fuera. Es el arreglo de raiz: la defensa tiene que estar
   en el hook, no en la memoria de un agente.
2. **Step de CI** que corra el scan del item 40 sobre los `.md` de autor
   (`docs/`, `README.md`, `SETUP.md`, `TESTING*.md`, `vault/02_Bitacora/`,
   `vault/03_Deuda/`). Complementario de (1) si GGA no se puede tocar.
3. **El scan debe enumerar codepoints**, nunca usar regex de rangos Unicode: un
   regex reporto como CJK la flecha `U+2192` porque la consola la renderiza
   como basura. Ese falso positivo ya costo una vez (nota del item 48).

## Relacionado

- **Item 40:** el scan manual que hoy es la unica defensa.
- **Item 52:** los dos casos reales, detectados de rebote.
- **`.gga`:** donde vive la lista de patrones.
- **Nota del item 48:** por que el scan no puede ser un regex.

**Origen:** detectado el 2026-10-05 al commitear el PR #195, que solo contenia
markdown y fue revisado por GGA con `No matching files staged`.

**Severidad:** MEDIA. No hay corrupcion activa hoy; lo que hay es **ausencia de
la defensa** en el unico lugar del pipeline donde deberia estar.

**Urgencia:** antes de la Fase 3, que es la fase de mayor volumen
documental. Antes de T7 (docs de Fase 2) alcanza con el scan manual.

## 56. `resolve_tenant_by_preapproval` es superficie de seguridad permanente

**Estado:** abierto (2026-10-06). Cierra el hallazgo H1 de la auditoria mid-phase (#197).

## Hecho

El fix de H1 (PR #197 → rama `chore/fix-h1-preapproval-tenant-resolution`) dejo una
funcion `SECURITY DEFINER` en `public` que bypasea RLS:

```sql
CREATE OR REPLACE FUNCTION resolve_tenant_by_preapproval(preapproval_id TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT "tenantId" FROM subscriptions
  WHERE "mpPreapprovalId" = preapproval_id LIMIT 1;
$fn$;
```

No es una func de negocio comun: es un bypass de RLS deliberado y permanente,
porque el tenant es justamente lo que hay que resolver para poder abrir el
contexto. Vive mientras viva el flujo de suscripciones.

## Por que importa

Hoy expone exactamente una cosa: el `tenantId` de un `mpPreapprovalId`. Eso es
todo lo que el webhook necesita, y nada mas. Pero nada impide que alguien le
agregue una salida mas:

- Cambiar `RETURNS UUID` por `RETURNS TABLE` y exponer toda la fila.
- Agregar un segundo `SELECT` que devuelva `email`, `status` u otros datos de
  `subscriptions`.
- Sacar el `REVOKE ALL ... FROM PUBLIC`, y de golpe cualquier rol conectado
  resuelve el tenant de cualquier preapproval.
- Quitar `SET search_path`, abriendo la inyeccion via `search_path`.

Cada una de esas es una fuga cross-tenant silenciosa, y ninguna la detectaria el
codigo de aplicacion.

## Defensas actuales

`packages/db/src/__tests__/preapproval-tenant-resolution.test.ts` fija el
contrato contra Neon real:

- `prosecdef = true`, `prorettype = uuid`, `pronargs = 1`,
  `config = ['search_path=public, pg_temp']`.
- `SELECT *` devuelve **una** columna.
- `PUBLIC` **no** tiene `EXECUTE`; `app_user` si.

Un cambio en la funcion los rompe y el test se pone rojo. Eso es lo que evita que
la deuda sea silenciosa.

## Relacionado

- **ADR-026:** la decision y las alternativas descartadas.
- **H1 (auditoria mid-phase #197):** el defecto original.
- **`set_tenant_id`:** el otro escape hatch acotado del schema; mismo patron.

**Origen:** 2026-10-06, al resolver H1.

**Severidad:** MEDIA de riesgo, ALTA de consecuencia. Hoy no hay fuga; lo que
queda es que el contrato depende de que nadie edite la funcion.

**Urgencia:** antes de Fase 3, cuando el numero de migraciones que tocan RLS
crezca y aparezca mas superficie por agregar.

## 57. `planId` puede quedar desalineado si falla el GET de verificacion

**Estado:** abierto (2026-10-06). Cierra el hallazgo H3 de la auditoria mid-phase (#197).

## Hecho

Con H3 (PR #200), `PUT /api/subscriptions/plan` escribe `subscriptions.planId`
**solo** cuando su `GET` de verificacion posterior confirma que el monto quedo
aplicado en MP:

| Situacion                      | Status | Escribe `planId` |
| ------------------------------ | ------ | ---------------- |
| Monto verificado y coincide    | `202`  | si               |
| Monto verificado y NO coincide | `502`  | no               |
| `GET` de verificacion fallo    | `202`  | no               |
| `transaction_amount` ausente   | `202`  | no               |

Los dos ultimos casos son deliberados: un `GET` que fallo o un campo ausente no
permiten afirmar que la operacion fallo, asi que el `202` sigue siendo honesto
(el `PUT` a MP si salio). Ver el test `202 si el GET de verificacion falla` y el
`202 si MP no devuelve transaction_amount`.

## El residuo

Si el `GET` falla **despues** de que MP aplico el cambio, la DB y MP quedan
desalineadas: MP tiene el monto nuevo, la DB tiene el plan viejo. El tenant ve
el plan viejo en el panel y el `409 "Ya tenes ese plan"` puede responder contra
un estado que ya no es el de MP.

Es un trade consciente y no un descuido: se prefiere no afirmar nada antes que
afirmar un estado que nadie verifico. Y **converge solo**: el siguiente
`PUT /plan` del tenant vuelve a intentar el cambio, y si MP ya tiene ese monto
la escritura se confirma.

## Por que queda como deuda y no como bug

La ventana existe, pero nadie la cierra automaticamente. Lo que falta es
deteccion: si el `GET` fallo, el endpoint solo emite un `warn` y sigue. No hay
ninguna señal que le diga a alguien "hay un cambio sin registrar".

## Relacionado

- **ADR-027:** la decision y por que la escritura es del endpoint.
- **Item 56:** `resolve_tenant_by_preapproval`, otro escape hatch acotado de H1.
- **Auditoria #197 (H3):** el defecto original (`planId` nunca se escribia).

**Origen:** 2026-10-06, al resolver H3.

**Severidad:** BAJA. Ventana acotada a una falla puntual del `GET`, con
convergencia manual.

**Urgencia:** cuando se exponga el estado del plan al tenant (panel de
suscripciones). Antes de eso es ruido de log.

## 58. `pnpm test --coverage` no mide nada: pnpm se come el flag

**Estado:** abierto (2026-10-06). Detectado en T6. Workaround conocido: `pnpm exec vitest run --coverage`.

## Hecho

`pnpm test --coverage` falla:

```
ERROR  Unknown option: 'coverage'
Did you mean 'reverse'? Use "--config.unknown=value" to force an unknown option.
```

El error no es de vitest: es de **pnpm**. El script raiz es `vitest run`, y el
flag `--coverage` lo interpreta pnpm como una opcion suya, no como argumento del
script. Hay que invocarlo como `pnpm exec vitest run --coverage`.

## Por que importa

T6 tiene como criterio de aceptacion medir la cobertura (§9.3). Con el comando
que todo el mundo prueba primero, el coverage no se mide y parece que "no hay
forma de medirlo". Ya paso: hasta T6 nadie habia reportado un porcentaje, y la
razon de fondo era esta mas que la falta de la dependencia (ver item 59).

## Relacionado

- **Item 59:** `@vitest/coverage-v8` no estaba declarado, que es la causa raiz.
- **`package.json`:** el script `test` no declara `--coverage`.

**Origen:** 2026-10-06, en T6.

**Severidad:** BAJA. Workaround de una linea.

**Urgencia:** junto con 59, o directamente al mismo tiempo.

## 59. `@vitest/coverage-v8` no estaba declarado en ningun `package.json`

**Estado:** **RESUELTO (2026-10-06)** - PR #201 (`test/fase2-integration-tests`).

## Hecho

`vitest.config.ts` declara `coverage.provider: 'v8'` desde siempre:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
},
```

Pero **`@vitest/coverage-v8` no estaba declarado en ningun `package.json`** ni
estaba en el store de pnpm. Configurar un provider que no esta instalado es una
configuracion que no puede funcionar: correr coverage daba

```
MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
```

O sea que **la cobertura nunca fue medible en este repo**. Por eso ningun
criterio de aceptacion de los ultimos PRs (que pediran ">= 80%") pudo
verificarse.

## Relacionado

- **Item 58:** el comando que se usa primero tampoco funciona.

**Origen:** 2026-10-06, en T6. Resuelto en el PR de T6 (`@vitest/coverage-v8@^5.0.2`).

**Severidad:** MEDIA. No era un bug de ejecucion sino una capacidad de
verificacion ausente, que es peor: un criterio de aceptacion que nadie puede
medir no es un criterio.

**Urgencia:** resuelta en T6.

## 60. El reporter de texto de coverage oculta archivos

**Estado:** abierto (2026-10-06). Detectado en T6. Workaround conocido: leer `coverage/coverage-final.json`.

## Hecho

Con las rutas de mutacion al 100% (`cancel/route.ts`, `pause/route.ts`,
`resume/route.ts`), **esas tres filas desaparecen de la tabla de texto** del
reporte de coverage, aunque los archivos estan y estan cubiertos. Lo mismo con
`mutate.ts`, que aparece, y `handlers.ts`, que aparece.

Los directorios largos se truncan a un ancho fijo (`...iptions/cancel`,
`...criptions/resume`) y el agrupamiento por directorio los colapsa.

El reporte `text` es el que se lee a ojo. Si un archivo bien cubierto no aparece,
la lectura razonable es "no se cubre", que es la conclusion opuesta a la
verdad.

## Como verificar los numeros reales

Leer el reporte JSON, que trae rutas absolutas y no trunca:

```bash
pnpm exec vitest run --coverage
# despues, sobre coverage/coverage-final.json
```

Con `--coverage.include` tampoco alcanza: los archivos faltan igual en la tabla.

## Relacionado

- **Item 58** y **59:** sin ellos no hay ningun reporte que truncar.

**Origen:** 2026-10-06, en T6.

**Severidad:** BAJA, pero con trampa: invita a reportar un numero equivocado.

**Urgencia:** cuando se empiece a usar coverage como criterio en CI, porque ahi
el numero se lee de una tabla y no de un JSON.

## 61. Los tests con mock no pueden verificar el `WHERE` de una query

**Severidad:** ALTA. Bloqueante de Fase 3.
**Estado:** RESUELTO (2026-10-09), parcial por diseño. Ref: **H-T6-1** (NO H-F2-1: ese es
el item 62), auditoría T6 (PR #202), diseño en #233, implementación en #235 (issue #234,
mergeado en `develop` como `e7d3f67`).
**Verificado en codigo:** si, con la mutación de la auditoría.

**Hecho original.** Se removió el `eq(dbSubscriptions.tenantId, resolved.tenantId)` del
`SELECT` de la fila y del `UPDATE` de `applyTransition`, y la suite siguió verde. Los tests
mock-based no observan el `WHERE`: con `withTenantContext` mockeado, el mock devuelve filas
fijas sin importar qué filtro lleve la query. Los tests cross-tenant que existían verifican
que se **pase** el tenant, no que la query **filtre** por tenant.

**Por qué era ALTA.** `subscriptions_tenant_idx` es UNIQUE sobre `tenantId`
(`schema.ts:91`): hay exactamente una suscripción por tenant. La fuga no es "una fila entre
muchas", es **la fila del otro tenant y solo esa**.

**Fix.** `transitionSubscription(tenantId, from, to, patch)` en
`packages/commerce/src/subscription-transition.ts`, con el `WHERE` construido internamente.
`applyTransition` ya no escribe el `UPDATE`: llama a la función. Vive en `@repo/commerce` y no
en `@repo/db` porque `SubscriptionStatus` es de dominio y `@repo/db` no depende de nada
interno — importarlo desde ahí sería una dependencia circular.

**El `WHERE` quedó como `tenantId AND status`, sin `id`.** El índice UNIQUE alcanza para
identificar la fila, y dejar `id` agregaba una segunda fuente de verdad que puede estar
equivocada sin que nadie lo note. Con el índice, filtrar solo por tenant y status es
**estrictamente más seguro**: si el `SELECT` devolviera la fila de otro tenant, el `WHERE` ya
no la alcanza.

**Criterio de aceptación: verificado.** Aplicar la mutación de la auditoría (quitar el filtro
por tenantId) hace fallar los tests. Verificado en rojo: **2 de 5 fallan, y son exactamente
los dos de la capa 2**. Los tres de la capa 1 siguen en verde, y eso es lo que proved el
descubrimiento de abajo.

**El hallazgo que el fix tuvo que resolver para poder verificarse — RLS ENMASCARA EL
`WHERE`.** Con la mutación aplicada, los tests en contexto de producción pasaban 4/4. No era
que faltara una aserción: era que **otra capa detenía la escritura**. El `UPDATE` corre dentro
de `withTenantContext(A)` → `set_tenant_id(A)` → la policy de RLS bloquea escribir la fila de
B. RLS es la red real, y el `WHERE` es defensa en profundidad.

Por eso el test tiene **dos capas**: capa 1 con `DATABASE_APP_URL` (rol sin BYPASSRLS, RLS
activo) para el comportamiento real y el compare-and-set del item 70; y **capa 2 con
`DATABASE_URL` (owner, BYPASSRLS)**, donde el `WHERE` es el único guard y por lo tanto es
observable. Sin la capa 2 el invariante sería indetectable y el test no probaría nada.

**El compare-and-set del item 70 sigue intacto.** `from` viaja como parámetro de la función, y
si otra transición movió la fila, el `WHERE` no matchea y se devuelve `concurrent_update`. Sin
`FOR UPDATE`, a propósito: no hay locks de fila en el proyecto.

**Lo que este fix NO resuelve.** Los 30 call sites restantes de `withTenantContext` (de 31:
admin 11 archivos / 19 usos, storefront 9 / 12, commerce 4 / 6) siguen construyendo su propio
`WHERE`. Migrarlos es trabajo incremental, **fuera de scope por decisión explícita**, y solo
este endpoint migraba porque es donde la auditoría demostró que el defecto es explotable.

Tampoco cubre: queries Drizzle crudas escritas fuera de la función (el tipo no lo impide, solo
lo desalienta), el `SELECT` si queda separado, ni las tablas globales `tenants` y `plans`.

## Hecho

Auditoria de calidad de T6 (`audit/t6-test-quality`): se removio el
`eq(dbSubscriptions.tenantId, resolved.tenantId)` del `SELECT` de la fila y del
`UPDATE` final de `applyTransition`, y **los 705 tests siguieron verdes**.

Con el filtro del `SELECT` puesto en tautologia, `row` pasa a ser una fila
arbitraria y el `UPDATE` por `row.id` escribe la que sea: una fuga cross-tenant
completa que ningun test detecta.

Los tests cross-tenant que existen verifican que se **pase** el tenant correcto a
`withTenantContext`. No verifican que la query **filtre** por tenant. Son
distintas, y la segunda es la que evita la fuga.

## Por que no se puede cerrar con un test

`withTenantContext` esta mockeado en las suites de Fase 2 y devuelve filas fijas
sin importar el `WHERE`. Con mocks, **la semantica de la query es invisible por
construccion**: no hay codigo de test que pueda distinguir `WHERE tenantId = X`
de `WHERE true`.

Una asercion sobre la forma del `WHERE` (inspeccionar el objeto de drizzle que
se pasa a `.where()`) seria debil: verifica que escribiste un filtro, no que
filtre.

## Opciones

1. Test de integracion contra Neon con dos tenants: insertar, disparar el
   webhook y verificar que solo se modifica la fila correcta. Costo alto.
2. Assert sobre la forma de la query. Barato y debil.
3. **Mover el aislamiento a un invariante de tipos**: que `applyTransition`
   reciba el `row` ya filtrado y no construya el `WHERE`. Convierte un invariante
   de SQL en un invariante de tipos, y es la que mejor paga.

Hoy el aislamiento real esta protegido solo por RLS en Postgres
(`rls-cross-tenant.test.ts`, 8 casos contra Neon), que es una red distinta:
protege la DB, no el codigo que escribe mal la query.

## Relacionado

- **ADR-026:** por que `resolve_tenant_by_preapproval` no lleva filtro de tenant
  a proposito (es el escape hatch de bootstrap).
- **`vault/04_Fases/auditoria-t6-test-quality.md`:** hallazgo H-T6-1.
- **Item 56:** otro punto donde la seguridad depende de un invariante que ningun
  test puede observar por construccion.

**Origen:** 2026-10-06, auditoria de calidad de T6.

**Severidad:** ALTA de consecuencia, MEDIA de probabilidad. No hay fuga hoy: el
codigo tiene los filtros. Lo que falta es que un refactor los pueda quitar en
silencio.

**Urgencia:** antes de Phase 3, cuando el numero de rutas con RLS crezca y este
patron (mockear `withTenantContext` y afirmar sobre las llamadas) se replique.

## 62. Un nombre de funcion o un comentario pueden hacer el trabajo de la review

**Estado:** abierto (2026-10-06). Detectado en la auditoria de cierre de Fase 2
(`vault/04_Fases/auditoria-fase2.md`, hallazgo H-F2-1, severidad ALTO).

### Hecho

H1 de la auditoria mid-phase (`estrategia L nunca resolvia`) no fallo por falta de
tests. Fallo porque dos artefactos falsehood su trabajo:

1. **Un argumento de seguridad falso escrito en el codigo.** El comentario de
   `withTenantContextByPreapproval` decia _"Es seguro: solo se LEE y el filtro es
   el indice unico parcial, que es por definicion de un solo tenant"_. La premisa
   es falsa: RLS se aplica **antes** del `WHERE`, asi que la funcion devolvia
   cero filas siempre. Confundia **selectividad del indice** con **permiso de
   acceso**.

2. **El nombre afirmaba la garantia que el codigo no cumplia.** La funcion se
   llamaba `withTenantContextByPreapproval`. Una revision que greppeara
   `withTenantContext` veia el nombre, marcaba el casillero y seguia.

3. **La prueba que lo refutaba ya estaba en el repo.** El test
   `"sin set_tenant_id una conexion nueva devuelve cero filas RLS"`
   (`packages/db/src/__tests__/rls-cross-tenant.test.ts:333`) se creo el
   2026-09-24 en `670a7b3`, el commit de cierre de Fase 1: **doce dias antes de
   que empezara Fase 2**.

### Impacto

Tres defectos funcionales de la fase (H1, H2, H3) llegaron a produccion porque el
proceso de revision aceptaba nombre y comentario como evidencia. Ninguno lo
detecto ningun test. La mini auditoria de T6 (#202) encontro el limite de los
mocks (item 61) pero no esta dimension: **el codigo puede mentir en su propia
documentacion sin que nada falle.**

### Mitigacion

Dos reglas de revision, sin codigo nuevo:

1. Un comentario que **justifica saltarse una frontera de seguridad es un
   hallazgo**, no documentacion. Exige verificar la premisa contra el motor.
2. Una funcion cuyo **nombre promete una propiedad de seguridad** debe abrirse y
   verificarse como si no la cumpliera.

### Learned

Un nombre puede actuar como el unico punto de falla de una revision. Cuando el
nombre y el cuerpo discrepan, el nombre es el que gana porque es lo que se lee
primero. `withTenantContextByPreapproval` no fallaba por estar mal nombrada:
fallaba porque el nombre prometia un invariante que no existia, y nadie lo
verifico porque el nombre ya lo decia.

---

## Registro de la auditoria de cierre de Fase 2 (items 63 a 71)

La auditoria de cierre de Fase 2 (`vault/04_Fases/auditoria-fase2.md`, PR #207,
2026-10-06) produjo 10 hallazgos de codigo: H-F2-2 a H-F2-9 (MEDIUM) y H-F2-10 y
H-F2-11 (LOW). H-F2-1 ya era el item 62.

**Hasta el 2026-10-07 ninguno estaba registrado aca**: vivian solo en el documento
de fase. Se registran ahora como items 63 a 71. **Ninguno fue arreglado** — este
registro es de trazabilidad, no de fix.

| Item | Hallazgo          | Severidad | Costo est. | Verificado en codigo |
| ---- | ----------------- | --------- | ---------- | -------------------- |
| 63   | H-F2-10 + H-F2-11 | LOW       | ~3.5 h     | no                   |
| 64   | H-F2-2            | MEDIUM    | 2 h        | **si, 2026-10-07**   |
| 65   | H-F2-3            | MEDIUM    | 1 h        | **si, 2026-10-07**   |
| 66   | H-F2-4            | MEDIUM    | 1 h        | no                   |
| 67   | H-F2-5            | MEDIUM    | 1 h        | no                   |
| 68   | H-F2-6            | MEDIUM    | 2 h        | no                   |
| 69   | H-F2-7            | MEDIUM    | 3 h        | no                   |
| 70   | H-F2-8            | MEDIUM    | 3 h        | no                   |
| 71   | H-F2-9            | MEDIUM    | 0.5 h      | **si, 2026-10-07**   |

**"Verificado en codigo"** significa que alguien volvio a leer la linea citada en
`develop` y la hallo tal cual la describes la auditoria. Los no verificados son
extractos del documento de fase y **pueden haber cambiado**.

Correccion de conteo aplicada a la auditoria el 2026-10-07: el resumen ejecutivo
decia "11 hallazgos de codigo (6 MEDIUM, 5 LOW) + 1 de proceso". El cuerpo tiene
8 MEDIUM y 2 LOW, o sea 10 de codigo mas 1 de proceso.

---

## 63. Documentacion y codigo muerto que afirman cosas que el codigo no hace (H-F2-10 + H-F2-11)

**Estado:** abierto (2026-10-07). Registrado desde `vault/04_Fases/auditoria-fase2.md`
(PR #207), hallazgos H-F2-10 y H-F2-11. Agrupados: comparten el patron del item 62
— **la documentacion o el comentario afirma una garantia que el codigo no
cumplimenta**. Verificado en codigo: **no**.

**Origen:** agrupados por decision del 2026-10-07. Son LOW y de naturalezas
distintas (codigo muerto vs comentarios), pero el patron es el mismo y separarlos
los vuelve dos tickets sin relacion aparente.

### H-F2-10 — codigo muerto y guards que no hacen lo que dicen

- `TOPIC_BY_ACTION` en `mp-webhook-events.ts` es un espejo identico de
  `TOPIC_BY_TYPE` con claves del tipo `payment.created` que **no coinciden con los
  literales reales**: el fallback nunca se alcanza.
- `daysRemaining` en `subscription-proration.ts` no tiene cap: el prorrateo es
  incorrecto sobre periodos de 30 dias.
- `NaN` pasa el guard `!= null` de H3: el warn se dispara siempre, con lo que deja
  de ser una senal.

**Recomendacion:** eliminar `TOPIC_BY_ACTION` o corregir sus claves; capar
`daysRemaining`; cambiar el guard de H3 a un chequeo de finitud.

### H-F2-11 — comentarios que no coinciden con el codigo

- `subscriptions/route.ts:127-135` — el body se materializa **antes** del check de
  tamano, asi que el 413 llega tarde. Ademas `rawBody.length` cuenta code units
  UTF-16, no bytes.
- `subscriptions/route.ts:73-84` — el comentario dice _"se degrada a `none`"_; el
  codigo devuelve `serverError(...)`, o sea 500.
- `preapproval/route.ts:151` — `payerEmail: email ?? ''` manda string vacio a
  MercadoPago si falta el email.
- `preapproval/route.ts:56` — el rate limit cubre solo el alta, no
  `cancel`/`pause`/`resume`/`plan`.

**Costo estimado:** ~3.5 h (2 h + 1.5 h).

**Severidad:** LOW. Ninguno rompe un flujo; H-F2-11 es exactamente el modo de falla
del item 62 a escala menor.

---

## 64. El `dataId` de la firma se lee solo del body (H-F2-2)

**Estado:** abierto (2026-10-07). Verificado en codigo el 2026-10-07: **sigue
vulnerable**.

**Evidencia:** `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts:151`
— `dataId: parsed?.data?.id ?? ''`. Cero ocurrencias de `searchParams`, `nextUrl` o
`request.url` en todo el archivo.

**Impacto:** el plan (`docs/superpowers/plans/2026-10-01-fase2.md:597` y checkbox
`:639`) pide `dataId` del query param con fallback al body, y testear ambos. No
implementado ni testeado.

**Severidad:** MEDIUM, no ALTO. El spike T0 registro tres entregas reales de MP y
en las tres `data.id` vino **en el body** (`181244133433`, `7032544182`,
`25f8cf82...`). Una severidad ALTO con el escenario "401 en cada entrega" no se
sostiene con esa evidencia.

**Riesgo residual real:** el spike **no observo**
`subscription_preapproval_plan`, que es justamente el topic que sigue sin suscribir
en el panel de MP. Si MP lo entrega solo en query string, ese topic da 401.

**Relacionado:** accion operacional pendiente de suspender
`subscription_preapproval_plan` en el panel. Implementar el fallback **despues** de
suscribirlo, para poder probarlo.

**Costo estimado:** 2 h.

---

## 65. El 409 de doble click omite `initPoint`, y un test consagra la forma equivocada (H-F2-3)

**Estado:** abierto (2026-10-07). Verificado en codigo el 2026-10-07: **sigue
presente**.

**Evidencia:** `apps/admin/app/api/subscriptions/preapproval/route.ts` — el
comentario de cabecera de `:39` promete _"Doble click -> 409 con el `initPoint`
existente"_, pero los 409 de `:116`, `:129` y `:142` **no incluyen `initPoint`**.
El test `route.test.ts:278-289` asserta la forma incorrecta, asi que **no falla**:
consagra el error.

**Impacto:** el plan (`:469`, `:481`) y el design (seccion 6.5) dicen que el 409
devuelve `preapprovalId` con `initPoint` para que la UI pueda navegar al checkout.
Cuando exista la UI, el tenant queda atrapado en `pending_first_payment` sin poder
retomar el pago.

**Por que no lo detecto la revision anterior:** nadie contrasto el archivo contra
el plan de T4 ni contra su propio comentario de cabecera. Es el item 62 aplicado a
un endpoint.

**Costo estimado:** 1 h (agregar `initPoint` al 409 y corregir el test).

---

## 66. `redisPexpire` sin verificar puede dejar claves sin TTL para siempre (H-F2-4)

**Severidad:** **MEDIA-ALTA** (subida desde MEDIUM el 2026-10-09).
**Estado:** RESUELTO (2026-10-09). Ref: issue #228. Hallazgo **H-F2-4** (no H-F2-7:
ese es el item 69, ya resuelto en #222).
**Verificado en codigo:** si (2026-10-09).

**Evidencia del bug (antes del fix):** `packages/commerce/src/redis.ts:106-111` hacia
`await safeRun('pexpire', ...)` y **descartaba** el resultado. `safeRun` (L73-84) devuelve
`T | null` y traga el error en `logger.warn` + Sentry. Un `pexpire` fallido era
**indistinguible de uno exitoso a nivel de tipos**.

**Alcance real: 2 apps, no 1.**

- `apps/admin/lib/subscriptions/handlers.ts:138` → lockout permanente del alta de
  suscripciones.
- `apps/storefront/app/api/checkout/preference/route.ts:29` → lockout permanente del
  checkout. `apps/storefront/lib/redis.ts:7` re-exporta la misma funcion `void`.

**Huellas del descuido (por que el control no lo atajaba):**

- En `handlers.ts` el `redisIncr` siguiente **si** se verifica (L129-135, `count === null`
  → fail-open). Solo el write del TTL quedo sin verificar.
- Los 2 tests mockeaban el contrato viejo: `mockResolvedValue('OK')` en storefront
  (un contrato que la implementacion nunca tuvo) y `mockResolvedValue(undefined)` en admin.
  Como el mock es un `vi.fn()` **sin tipar**, `tsc` nunca valido el contrato: los tests
  pasaban en verde sobre un contrato falso.
- `packages/commerce/src/redis.ts` no tenia **ningun** test. La firma no estaba verificada
  en ninguna parte, y `redisPing` —el patron a copiar— tampoco.

**Fix:** `redisPexpire` → `Promise<boolean>`, copiando la forma de `redisPing`
(`result === 'PONG'` → `result === 1`; `0` = clave inexistente y `null` = error se
mapean ambos a `false`, porque en los dos casos el TTL **no** quedo aplicado).

**El punto que no alcanza — y por que el fix borra la clave:** log + fail-open en el
camino de fallo deja pasar **este** request pero no deshace nada: `count === 1` no se
repite y nadie reintenta el TTL, asi que la clave sigue sin vencimiento y el 429
permanente ocurre igual. Por eso el camino de `false` hace **`redisDel`**: el siguiente
request vuelve a ver `count === 1` y **reintenta**. La degradacion es que el rate limit
puede no aplicarse, en vez de bloquear al tenant para siempre. Eso es fail-open de
verdad, y es lo que pedia el propio item ("fail-closed es un DoS construido a proposito").

**Tests:** 4 del contrato nuevo en `packages/commerce/src/__tests__/redis.test.ts` +
2 por call site (TTL aplicado → no borra; TTL falló → borra la misma clave) + 1 de
regresión (Redis caído en `redisIncr` → no toca el TTL). 6 de los 10 fallan sin el fix
(verificado con `git stash push` del codigo fuente). Los 2 mocks corregidos: si no,
quedan mentirosos y los tests pasan sin quejarse.

**Costo real:** ~1.5 h (el estimado original de 1 h asumia "loguear el fallo y aceptar la
key sin TTL", que es justamente la parte que **no** resolvia el lockout).

---

## 67. `external_reference` sin validar puede producir 500 (H-F2-5)

**Estado:** abierto (2026-10-07). Verificado en codigo: no.

**Evidencia:** `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts:406`
hacia `packages/db/src/index.ts:22`.

**Impacto:** la estrategia R devuelve `external_reference` **sin validar que sea
UUID**. `withTenantContext` corre `set_tenant_id(${tenantId}::uuid)`, que **lanza**
ante un valor no-UUID, y eso es un **500** que dispara el **loop de reintentos de
MercadoPago**. Rompe el invariante documentado de "si no resuelve -> `200` + warn,
nunca `5xx`" (design secciones 3.5 y 6.2, paso 9).

**Costo estimado:** 1 h (validar el formato UUID antes de invocar
`withTenantContext`; si no matchea, `200` + warn).

---

## 68. `/preapproval` no re-verifica el monto que creo el preapproval (H-F2-6)

**Severidad:** **ALTA** (subida desde MEDIUM el 2026-10-09).
**Estado:** RESUELTO (2026-10-09). Ref: issue #226.
**Verificado en codigo:** si (2026-10-09, sesion de arranque).

**Evidencia del bug (antes del fix):** `apps/admin/app/api/subscriptions/preapproval/route.ts`
-- `createPreapproval` (L262-278), `id` / `init_point` extraidos (L280-281), un
presence-check (L283) y `201 { preapprovalId, initPoint }` (L328-331). Cero GET a MP.
El `bodySchema` es `z.object({})`: el body va vacio, no hay un campo de monto que
un test pudiera assertar por otro lado.

**Por que ALTA y no MEDIUM (evidencia levantada el 2026-10-09):**

- **No hay reconciliacion en ningun lado.** 0 rutas `cron` / `scheduled` / `reconcile`
  en las 3 apps.
- **Deteccion sin remediacion.** El webhook `subscription_preapproval` lee
  `preapproval.transaction_amount` (`handlePreapproval`, L356) y compara contra el plan
  local, pero el unico efecto es un `logger.warn`: sin Sentry, sin email, sin alerta. El
  codigo lo llama "la red de seguridad del otro lado"; una linea de log no es una red de
  seguridad para dinero.
- **El handler del cobro real no mira el monto.** `handleAuthorizedPayment` devuelve
  `{ ignored: true, reason: 'no_transition_for_this_topic' }` (L314) sin leer
  `transaction_amount`. Y el check de convergencia solo corre con
  `eventKind === 'preapproval'` (L543): `handlePayment` llama a `applyTransition` sin
  `amountCents`, asi que en eventos de pago el monto nunca se compara.
- **Event order B:** el evento que activa el alta es el mismo donde se detecta la
  divergencia. La deteccion es timely pero no actuante.
- **Es el path de creacion:** no hay valor previo contra el cual diffear, y es el primer
  cargo que el tenant paga.
- **Precedente:** #188/#189 shipped un cobro 100x en este endpoint exacto. Es el borde
  del item 48 (el bug del 100x): la conversion hoy es correcta via `toMpAmount`, lo que
  faltaba era comprobar que MP la aplico.
- **Ningun webhook llama a `updatePreapproval`.** Los unicos 2 call sites en produccion son
  `plan/route.ts:235` (cambio de plan) y `mutate.ts:97` (que solo escribe
  `{ status: target }`, no toca el monto).

**Fix:** `getPreapproval(preapprovalId, token)` + comparacion contra
`toMpAmount(plan.priceUyu)` + `502` sin `initPoint`, antes de cerrar la reserva. Copia la
forma de `plan/route.ts:260-309`.

**Divergencia deliberada con `/plan`:** ante un GET fallido, `/plan` devuelve `202` y no
escribe en DB, porque alla la escritura a MP **ya salio** y un 502 diria "tu cambio fallo"
cuando si salio. `/preapproval` devuelve `502` sin `initPoint` porque el tenant **todavia
no pago** y lo unico que hace el endpoint es entregarle un link de pago: entregar un
`initPoint` con monto no verificado **es** el bug. Reintentar no cuesta nada porque MP no
cobra hasta el clic.

**Tests:** 4 nuevos (coincide / no coincide / el GET falla / MP no manda
`transaction_amount`). Verificados en rojo sin el fix: los 4 fallan, con el fix pasan. El
`beforeEach` necesita `getPreapproval` con default `{ transaction_amount: 49 }`
(`PLAN.priceUyu = 4900`): sin ese default los 34 tests previos pasaban a 502.

---

## 69. Doble POST concurrente crea dos preapprovals en MercadoPago (H-F2-7)

**Estado:** **RESUELTO** (2026-10-07). Reserva condicional antes de llamar a MP.

**Evidencia original:** `apps/admin/app/api/subscriptions/preapproval/route.ts:76-131`
— guard read-then-act sin lock ni constraint unique.

**Impacto:** dos requests concurrentes creaban **dos preapprovals en MercadoPago**; el
segundo pisaba el `mpPreapprovalId` y dejaba un preapproval **huérfano en MP**, que hay
que cancelar a mano. El rate limit (10/min por IP) no lo evita.

**Resolución.** `mpPreapprovalId` ahora admite un **valor centinela** `pending:<subId>`
que ocupa el slot de forma condicional **antes** de llamar a MercadoPago:

1. `UPDATE ... SET mpPreapprovalId = 'pending:<id>' WHERE id AND tenantId AND
(mpPreapprovalId IS NULL OR (mpPreapprovalId LIKE 'pending:%' AND updatedAt < now - TTL))`
   con `.returning()`. Si afecta 0 filas → otra petición ganó → **409 sin llamar a MP**.
2. Se llama a MP (fuera de toda transacción).
3. `UPDATE ... SET mpPreapprovalId = <id real> WHERE ... AND mpPreapprovalId = 'pending:<id>'`.
   Si afecta 0 filas → otro proceso tomó la reserva → el preapproval queda huérfano y se
   registra con `logger.error` + 409 que no promete un alta que no ocurrió.

**Por qué centinela y no lock.** La llamada a MP ocurre **entre** dos transacciones, así
que un `FOR UPDATE` no la protegería: se necesitaría sostener un lock de fila durante los
~300 ms de red. El compare-and-set va en el `WHERE` de la escritura, que sí cubre la
ventana. `PENDING_RESERVATION_TTL_MS` = 5 min: pasada la ventana se asume que el proceso
murió y otro puede tomar el lugar, para no dejar al tenant bloqueado.

**Costo asumido:** si MP rechaza la creación, la reserva sigue viva hasta el TTL y el
tenant recibe un 409 con `retryInSeconds` en vez de reintentar al instante. Fail-closed
con ventana de espera, preferible al huérfano.

**Verificación:** TDD. El test de doble POST concurrente falló primero con
`expected "vi.fn()" to be called 1 times, but got 2 times`. El mock de `returning` simula
el slot como compare-and-set real: un mock que devuelve `[{ id }]` siempre pasaría con y
sin el fix.

---

## 70. read-modify-write sin `FOR UPDATE` (H-F2-8)

**Estado:** **RESUELTO** (2026-10-07). Compare-and-set sobre el `status` leído.

**Evidencia original:** `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts:500-517`
y `:603-611`.

**Impacto:** `SELECT` sin lock y `UPDATE ... WHERE id + tenantId` sin compare-and-set. Dos
eventos concurrentes (`preapproval.cancelled` vs `payment.approved`) competían y ganaba el
último por orden de commit. Si quedaba `active` mientras MP decía `cancelled`, la
suscripción quedaba desincronizada hasta el próximo evento o indefinidamente.

**Resolución.** El `UPDATE` ahora incluye `eq(dbSubscriptions.status, current)` — el
`status` que se leyó — y se inspecciona `.returning()`. Si afecta 0 filas, otra
transición movió la fila y este evento se descarta con `{ applied: false, reason:
'concurrent_update' }` más un log explícito. El perdedor es idempotente: si MP reintenta,
converge contra el estado correcto.

**Por qué no `FOR UPDATE`.** No hay ningún lock de fila en el proyecto y este caso no lo
necesita: cada transacción decide desde su propia lectura y la perdedora es descartable.
Sostener un lock durante `verifyPlanAmountConvergence` sería peor que perder una
transición idempotente. Es el mismo mecanismo del item 1 (TOCTOU checkout), que ya está
en producción y testeado.

**Verificación:** TDD. 3 tests en RED antes del cambio, el principal con
`expected true to be false` — el handler reportaba `applied: true` con 0 filas escritas.

---

## 71. El secret de plataforma tiene fallback al del tenant (H-F2-9)

**Estado:** **RESUELTO** (2026-10-07). Fallback eliminado, fail-closed con 503.

**Evidencia original:** `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts:113-115`
— `MP_PLATFORM_WEBHOOK_SECRET ?? MERCADOPAGO_WEBHOOK_SECRET`.

**Impacto:** es el **unico archivo de produccion** donde conviven ambos secrets.
Contradice literalmente ADR-023 ("cada flujo tiene su propio `WEBHOOK_SECRET`").

**Diagnostico original (SUPERADO por la decision de Luis).** Se registro que "el
codigo esta bien; el ADR esta incompleto" y que el fallback era intencional porque
mitigaba una regresion real: sin el, dev y preview daban 401. **Ese diagnostico
estaba equivocado.** La mitigacion no era necesaria y el riesgo era mayor que el
problema que resolvia — ver abajo.

**Resolucion.** Decision de Luis: **sin fallback**. Si falta
`MP_PLATFORM_WEBHOOK_SECRET` se devuelve 503 sin procesar el body y sin llamar a
MercadoPago; MP reintenta hasta que el secret se restaure.

El riesgo real del fallback era cross-tenant: `MERCADOPAGO_WEBHOOK_SECRET` es el
secret del flujo de ordenes de tienda, el mismo valor que el tenant pega en su
onboarding. Aceptarlo como alternativa permitia que quien conociera el secret de
**su propio tenant** firmara webhooks que el handler de plataforma aceptaba —
bypass de la separacion plataforma/tenant que ADR-023 establece.

**Que se hizo:**

- `route.ts`: `const webhookSecret = process.env.MP_PLATFORM_WEBHOOK_SECRET ?? null`,
  sin alternativa. Log `MP_PLATFORM_WEBHOOK_SECRET not configured` + 503. El 503 ya
  existia; lo unico que cambio fue la eliminacion del `??`. El handler de
  `MP_PLATFORM_ACCESS_TOKEN` (mas abajo en el mismo archivo) ya usaba este patron:
  el secret ahora se parece al token.
- Test: se elimino el que consagraba el fallback (`cae al secret del tenant...` → 200)
  y se agrego `503 si falta el secret de plataforma aunque exista el del tenant`, que
  ademas afirma que no se resolvio el tenant ni se llamo a la API de MP.
- ADR-023: corregido el ambito de `MP_PLATFORM_WEBHOOK_SECRET` a `Vercel (apps/admin)`.
  Decia `Vercel (storefront)` pero el handler vive en `apps/admin`.

**Verificacion:** TDD. El test nuevo fallo primero con `expected 200 to be 503` — la
prueba de que el fallback era exactamente lo que hacia pasar la peticion. DoD verde:
lint 6/6, typecheck 9/9, build 3/3, test 705/705 (69 archivos, contador sin cambio:
-1 test del fallback, +1 test del 503), `format:check` limpio.

**Riesgo operativo asumido:** si el entorno Preview de Vercel no tiene
`MP_PLATFORM_WEBHOOK_SECRET`, el webhook devuelve 503 ahi hasta que se agregue la
variable. Fail-closed correcto, pero hay que confirmar la variable antes de mergear.

---

## 72. README.md tiene una numeracion de fases que colisiona 1:1 con la del vault

**Estado:** abierto (2026-10-07). Decision de Luis: **no es un fix, es una
decision de alcance**. Va al SDD de Fase 3.

**Hecho:** `README.md` define 6 secciones `## Fase N` con una numeracion propia:

| README.md                                   | Numeracion vigente (`vault/04_Fases/`)                    |
| ------------------------------------------- | --------------------------------------------------------- |
| Fase 1 - Autenticacion y ordenes            | Fase 1 - modelo de datos (seed de planes + suscripciones) |
| **Fase 2 - Dashboard y Stock**              | **Fase 2 - webhook de suscripciones + checkout dinamico** |
| Fase 3 - Experiencia de Tienda Completa     | - sin equivalente vigente                                 |
| Fase 4 - Autoservicio del Tenant            | - sin equivalente vigente                                 |
| Fase 5 - Produccion                         | - cerrada el 2026-05-06                                   |
| Fase 6 - RLS real (withTenantContext) y E2E | - cerrada el 2026-08-12                                   |

**Impacto:** **"Fase 2" significa dos cosas distintas.** En README es "Dashboard y
Stock"; en el vault es el webhook de suscripciones. **Las dos estan marcadas
"Completada"**, asi que un lector no tiene forma de saber que son fases diferentes.
README es la puerta de entrada del repo: el daño potencial es mayor que en
`vault/05_Specs/brief-tecnico-fase-5.md`, que sufrio el mismo problema y ya fue
marcado como historico (commit de saneamiento, 2026-10-07).

**Por que no se arregla aca:** resolverlo exige decidir cual de las dos taxonomias
manda y que se hace con las 6 secciones de README. Rewriting el indice de fases de
la puerta de entrada es un cambio de documentacion de producto, no saneamiento. La
misma decision de fondo que el blueprint v2.6 NO NORMATIVO, que tambien pide una
decision y no una edicion.

**Costo estimado:** 1 h de decision + rehacer la seccion de fases de README.

**Relacionado:** `vault/05_Specs/brief-tecnico-fase-5.md` (misma colision, ya
marcado historico) y la seccion "Blueprint vigente" de
`vault/05_Specs/arquitectura.md`.

---

## 73. El cleanup de 3 registros presupone que el worktree y el workspace existen

**Estado:** **RESUELTO** (2026-10-08). Paso cero agregado a la seccion de cleanup de
worktree en AGENTS.md.

**Fix:** la seccion "Cleanup de worktree post-merge" ahora arranca con **Paso cero —
confirmar que el registro existe**, que obliga a correr `git worktree list`,
`git branch -a` y `paseo_list_workspaces` **antes** de limpiar. Si un registro no existe,
la instruccion es reportar y seguir, no intentar limpiarlo.

**Evidencia empirica que lo justifica (no fue teorico):** en dos PRs consecutivos
(#222 y #223) el workspace de Paseo del PR **ya no existia** —Paseo lo auto-elimina al
desaparecer el worktree—. En ambos, el unico workspace del proyecto era
`wks_b14ea16d10d416b5`, con `cwd` = el repo principal y `kind: local_checkout`: **la
sesion en curso**. Ejecutar el paso 3 del plan al pie de la letra habria **archivado la
sesion activa**, cortando la conversacion. El paso cero lo impidio las dos veces.

**Riesgo no proporcional:** archivar el workspace equivocado no es un directorio huerfano
de 1.2 GB que se borra y se sigue — es perder la sesion.

**Hecho:** abierto (2026-10-07). No es codigo: la regla de proceso de AGENTS.md
("Cleanup de worktree post-merge") tiene un paso cero que no esta escrito.

**Hecho:** la regla manda verificar por separado el worktree de git, la rama local y el
workspace de Paseo, "porque el registro de git y el de Paseo se limpian por separado". Es
correcta **cuando se crean el worktree y el workspace**, que es lo que pasa siguiendo el
ritual completo. En el PR #221 el trabajo se hizo en el worktree principal: no existia
worktree de la rama y no existia workspace.

**La trampa concreta:** el unico workspace del proyecto era `wks_b14ea16d10d416b5`, con
`cwd` = el repo principal y `kind: local_checkout` — es la **sesion en curso**. Ejecutar
el paso 3 del plan al pie de la letra (`paseo_archive_workspace <id>` sobre el unico
candidato del proyecto) habria **archivado la sesion activa**, cortando la conversacion en
curso. El mismo paso que en #220 habria sido correcto.

**Por que importa:** un cleanup que asume la existencia de su objetivo es un cleanup que
puede borrar lo equivocado. El riesgo no es proporcional al error: archivar el workspace
equivocado no es un directorio huerfano de 433 MB, es perder la sesion.

**Fix propuesto (para el proximo PR que toque AGENTS.md):** agregar el paso cero.

1. `git worktree list` — **si no hay worktree de la rama, no hay nada que limpiar en este
   registro.** No asumas que existe.
2. `paseo_list_workspaces` — **filtrar por `projectId` Y por `cwd`.** Si el unico workspace
   del proyecto tiene `cwd` = el worktree principal, es la sesion activa: **no lo
   archives.**
3. Verificar la existencia del objetivo **antes** de ejecutar cada `remove`/`archive`, no
   despues.

**Costo estimado:** 0.5 h (solo edicion de AGENTS.md, sin codigo). No se resuelve junto con
items 69+70: es documentacion de proceso y mezclarla con fixes de serializacion ensuciaria
ambos diffs.

**Relacionado:** item 62 (mismo tipo: un nombre o un comentario reemplazan a un
procedimiento que deberia existir). Patron de fondo: la regla de 3 registros se escribio
desde un caso y se aplico a un caso distinto.

---

## 74. La rama `target === current` de `applyTransition` es inalcanzable

**Estado:** abierto (2026-10-07, descubierto al verificar el item 70).

**Hecho:** `route.ts` tiene una rama que devuelve `{ reason: 'converged' }` cuando el target
calculado es igual al `status` leido. Recorriendo `decideTarget` contra las tres tablas, no
existe ningun camino que la alcance:

| Camino de `decideTarget`         | Devuelve    | Requiere `current`                                   | Puede coincidir |
| -------------------------------- | ----------- | ---------------------------------------------------- | --------------- |
| `preapproval_cancelled`          | `cancelled` | `current ∈ CANCELLABLE` = {active, past_due, paused} | nunca           |
| `preapproval` + `paused`         | `paused`    | `current ∈ PAUSABLE` = {active, past_due}            | nunca           |
| `preapproval`/`payment` aprobado | `active`    | `current ∈ REVIVABLE` = {pending, past_due, expired} | nunca           |
| `payment` fallido                | `past_due`  | `current = 'active'`                                 | nunca           |

**Por que importa:** el comentario de la rama afirma que cubre el caso "ya convergido",
y da la impresion de que hay un segundo mecanismo de idempotencia ademas de la convergencia
de estado. **No lo hay.** Un test que lo cubra tiene que mentir: el primer test escrito para
el item 70 asumio `reason: 'converged'` y fallo con `expected 'no_transition' to be
'converged'`.

**Riesgo:** si alguien amplia `CANCELLABLE` o `PAUSABLE` con el estado que devuelve la
rama (por ejemplo, agregar `cancelled` a `CANCELLABLE`), la rama despierta con una
semantica que nunca fue probada. El riesgo no es que falle hoy: es que el proximo cambio
en esas tablas la active sin que nadie lo sepa.

**Costo estimado:** 0.3 h (borrar la rama y su log, o dejarla con un comentario que diga
que hoy es inalcanzable y por que). No se resuelve en el PR de items 69+70: es
diagnostico de este PR, no parte del fix.

---

## 75. GGA no cubre los tests, y los tests son donde el mojibake queda consagrado

**Estado:** **RESUELTO** (2026-10-08). Check de encoding por codepoints en `format:check`.

**Origen:** detectado al corregir doble encoding en
`apps/admin/app/api/subscriptions/preapproval/__tests__/route.test.ts` (PR #222,
review de luisavilaland).

**Problema:** `.gga:40` tiene `EXCLUDE_PATTERNS="*test.ts,*spec.ts,*d.ts,..."`. La
memoria obs 142 afirma que "GGA es el unico control que detecta doble encoding". Es
cierto para codigo de produccion — el mojibake que GGA detecto antes estaba en
`preapproval/route.ts` — pero dejaba los archivos de test sin ninguna red.

**Resolucion:** `scripts/check-encoding.mjs`, Node puro sin dependencias, wireado a
`format:check` como `prettier --check "**/*.md" && pnpm check:encoding`. Sale de ahi un
`check:encoding` invocable aislado para debug.

Detecta por codepoint: `U+FFFD`, `U+FEFF` al inicio, doble encoding de 2 bytes
(`U+00C3` + Latin-1), de 3 bytes (`U+00E2 U+20AC` + mapeo cp1252) y control chars fuera
de tab/LF/CR. Cubre `.ts .tsx .js .jsx .mjs .cjs .md .json .sql .yml .yaml .sh` en
`apps/`, `packages/`, `scripts/`, `docs/`, `vault/` y raiz. Excluye `vault/engram/`
(tool-managed) y artefactos de build. **NO excluye `packages/db/migrations/`**: las
migraciones son inmutables y si una tuviera mojibake hay que saberlo.

**Que NO se toco y por que:** `vault/02_Bitacora/bitacora.md` y
`vault/03_Deuda/deuda-tecnica.md` conservan corrupcion preexistente. Son archivos
append-only/acumulativos: corregirlos exige **reconstruir los bytes**, no editar a mano.
Quedan en la lista `KNOWN_CORRUPT` del script, que los reporta como warning visible
sin bloquear el merge. PR aparte.

**Verificacion:**

- 11 tests nuevos en `scripts/__tests__/check-encoding.test.ts` (contador 727 -> 738).
- **TDD real:** el detector falló el test de 3 bytes en RED. Mi condicion inicial
  exigia un tercer codepoint en rango Latin-1 `U+0080..U+00BF`, pero el tercero de una
  raya rota (U+2014) es **U+201D**, fuera de ese rango. El rango Latino-1 solo aplica
  a las secuencias de 2 bytes; las de 3 bytes terminan en los mapeos de cp1252
  `0x80-0x9F`. Corregido con el conjunto explicito.
- Prueba end-to-end: tres archivos sonda generados **por codepoint** (no escritos a
  mano) con mojibake de 2 bytes, BOM y control char. Los tres detectados, exit 1.
  Eliminados los tres, el repo vuelve a exit 0.
- El caso de falsos positivos esta cubierto por test: acentos en portugues y espanol
  ("Sao", "coracao", "secao") no disparan, porque son codepoints unicos y no el par
  `U+00C3` + byte de continuacion.

**Impacto en el proceso:** hasta este PR, `format:check` solo cubria `.md`. **Ningun
PR anterior verifico codepoints sobre codigo TypeScript** — los 727 tests puedan pasar
con un `.ts` entero en doble encoding. El check es el primero que mira `.ts`.

**Relacionado:** obs 142 (GGA detecta doble encoding que los tests no ven), obs 34 (el
glob correcto de GGA es `*test.ts`), item 40 regla 6 (here-strings de PowerShell).
Misma familia que el item 62: **un control que parece cubrir la zona critica, y cubre
otra.**

---

## 76. Corrupcion byte-level en `bitacora.md`

**Estado:** RESUELTO (2026-10-09). Severidad MEDIA. Verificado en codigo: si.
**Salido de `KNOWN_CORRUPT`** el 2026-10-09: el set quedo VACIO.

**Procedimiento usado (reemplazo dirigido por par, no por offset).** Los offsets se
corren en cuanto se aplica una sustitucion; el mapeo es por par `(patron corrupto -> texto
correcto)` con **conteo esperado verificado**, que es lo que lo hace auditable: si el
archivo tiene otra ocurrencia de la misma palabra, el script falla antes de escribir en
vez de tocar de mas.

- **Autoverificacion como contrato:** despues de aplicar, el script vuelve a escanear y
  aborta si queda un solo hallazgo. Un par olvidado rompe el script; no puede pasar
  inadvertido.
- **Pre-validacion de todos los pares de una vez**, para reportar los 30 fallos juntos y
  no descubrir uno por ejecucion.
- **0 reconstrucciones por offset**, que es lo que habia que evitar.
- **Nunca el roundtrip de `iconv`** (memoria #116): es identidad sobre UTF-8 valido y
  ademas destruye los caracteres ya correctos, porque el archivo es hibrido.

**Los 42 puntos de corrupcion, y de donde salio cada uno:**

| Tipo             | Cantidad | Recuperacion                                                    |
| ---------------- | -------- | --------------------------------------------------------------- |
| `U+FFFD`         | 34       | inferencia linguistica (vocal acentuada de palabra inequivoca)  |
| control chars    | 4        | inferencia: la letra inicial fue sustituida por el control char |
| `?` rotos (L864) | 4        | inferencia: separadores tipo flecha                             |
| BOM              | 1        | eliminado a nivel de bytes (`EF BB BF`)                         |
| moji2 (L1527)    | 1        | **reescrito por codepoint**, no reparado (ver abajo)            |

**Proveniencia — por que 0 eran recuperables de git.** La entrada del 2026-08-08 **nacio
corrupta** en `a49747f2`: el commit anterior con esas lineas tiene 128. No hay version
limpia en ninguna rama. Y el commit `77ea187b` —titulado _"fix(bitacora): reparar encoding
mojibake preexistente"_— es el que **destruyo** los bytes: la corrupcion era la secuencia
`ï¿½` (doble-encoding de `EF BF BD`) y ese repair la decodifico un nivel y la convertio en
`U+FFFD`. Los bytes originales no existen mas en ninguna parte. Los 33 `U+FFFD` de hoy son
el **residual que ese repair dejo**, segun documenta la memoria 28.

**Dos casos con verificacion dura, no inferencia:**

- **L942, hash de commit:** `<U+0007>44612f` — el BEL se comio la primera letra.
  `git log --all --diff-filter=A -- .prettierrc` devuelve **`a44612f`**, que es el commit que
  _agrego_ `.prettierrc`, que es lo que la linea describe. No es una suposicion.
- **L1289, `â¬ <U+001D>`:** mojibake incompleto; los bytes originales eran `E2 AC` y el
  tercero fue sustituido por un control char. Irreparable automaticamente. Resuelto a
  `— —` por decision humana del 2026-10-09, por analogia con las otras cabeceras.

**El moji2 de L1527 no se "reparo": se elimino como ejemplo.** Era un ejemplo documentado de
como se ve un archivo roto, y AGENTS.md L104-106 prohibe explicitamente escribir los
caracteres corruptos _"ni siquiera como ejemplo en el detector"_, prescribiendo
describirlos por codepoint. Ademas, mientras ese literal siga en el archivo, el detector lo
ve como un hallazgo real y `KNOWN_CORRUPT` no puede quedar vacio. Se reescribio como
`String.fromCharCode(0x00c3, 0x00b1)`. **El ejemplo sigue entendible y ahora cumple la
regla.**

**Lo que este fix NO respeta: append-only.** El diff muestra lineas modificadas, no solo
adiciones, porque repara bytes dentro de lineas existentes. Eso es una correccion, no una
perdida de contenido: el numero de lineas es identico antes y despues (4399), y ninguna
linea se borro. **Item 88** registra que la regla de append-only no especifica este caso.
La regla de verificacion (`git diff` solo adiciones) NO debe usarse para "restaurar" este
archivo a su version previa: eso reintroduce la corrupcion.

---

## 77. Corrupcion byte-level en `deuda-tecnica.md`

**Estado:** RESUELTO (2026-10-09). Severidad MEDIA. Verificado en codigo: si.
**Salido de `KNOWN_CORRUPT`** el 2026-10-09.

**Problema (antes):** 1 `U+FFFD` en L501. Preexistente en `develop`, introducido por
`f4d35c5b` (2026-09-26, "auditoria post-migracion al vault").

**Resolucion:** 1 sustitucion dirigida. El caso mas simple de los dos porque **no hay
inferencia**: la frase es ``de cualquier fix (ej: `simulaci?n` en lugar de `simulación`)``
— la palabra correcta aparece **integra 30 caracteres mas adelante, en la misma frase**. Es
una copia, no una reconstruccion.

**Por que no se hizo junto al item 76 (que es lo que el item pedia):** el archivo es
acumulativo y cambia con cada item nuevo, asi que una reconstruccion mal alineada mezcla el
diff con contenido historico. El fix fue minimo y por patron: 1 par, conteo esperado 1,
sin `prettier --write` sobre el archivo (que lo reescribe entero). Numero de lineas
identico antes y despues (3435).

---

## 78. Tests de DB al borde del timeout

**Estado:** abierto (2026-10-08). Severidad MEDIA.

**Origen:** detectado durante el DoD del PR #223.

**Problema:** los dos archivos que testean contra **Neon real** con `DATABASE_APP_URL` —
`packages/db/src/__tests__/rls-cross-tenant.test.ts` y
`preapproval-tenant-resolution.test.ts` — consumen casi todo su presupuesto: **14/14 tests
en 11.65 s en aislamiento, contra un limite de 15 s.** Con la suite completa el margen se
evapora y fallan de forma intermitente.

**Evidencia:** durante el DoD de #223, `pnpm test` dio `1 failed | 69 passed` con
**738/738 tests pasando** — un fallo a nivel de archivo sin ningun test roto. Corriendo
la suite dos veces mas: 70/70 limpio, ambas.

**Por que no se atribuyo al PR #223:** los dos archivos fallaron **simultaneamente**.
Workers independientes fallando a la vez apuntan a un blip de red hacia Neon, no a
contencion por el worker adicional. Y en aislamiento pasan.

**Fix propuesto — investigar antes de decidir:** (a) subir el timeout de esos dos
archivos a 30 s; (b) serializarlos en un pool separado; (c) limitar conexiones
concurrentes a la DB de test. La opcion (a) es la mas simple pero la que mas oculta un
handshake colgado de verdad; la (c) es la que ataca la causa.

**Nota de proceso:** este item es el antecedente de una regla util — **un `pnpm test` rojo
aislado no es evidencia hasta que se reproduce.** En este caso la primera conclusion
(que era regresion del PR) fue falsa, y solo dos repeticiones_clean la refutaron.

## 79. PowerShell `>` decodifica bytes al redirigir

**Severidad:** MEDIA.
**Estado:** ABIERTO.
**Origen:** Detectado durante el cierre de la sesión 2026-10-08 (PR #224).

**Problema:** `git show origin/develop:<path> > $env:TEMP\f.md` en
PowerShell decodifica el contenido a string antes de escribir. El
archivo resultante tiene bytes inválidos que no existen en el blob
original.

**Evidencia:** Durante el cierre de #224 se reportó "68 U+FFFD y bytes
inválidos en offset 968" sobre un blob que estaba LIMPIO (3229 bytes,
0 U+FFFD, flecha E2 86 92 válida, idéntico al worktree). Los bytes
inválidos eran artefacto de la redirección de PowerShell.

Es la TERCERA vez en la sesión del 2026-10-08 que PowerShell inventa
un hallazgo de encoding. Ya no es anécdota, es patrón.

**Riesgo:** el fix de un bug imaginario puede destruir el archivo sano
que se cree corrupto. En #224 el agente estuvo a un paso de "reparar"
un archivo limpio.

**Mitigación:** Toda medición de bytes en este repo pasa por Node
(child_process.execFileSync con 'git cat-file blob') o por
`git diff --numstat`. NUNCA por redirección de PowerShell (`>`).

**Familia:** cuarta variante de "el control que parece cubrir no cubre":

- Item 62: un nombre hizo el trabajo de la review.
- Item 61: un mock hizo invisible el WHERE.
- Item 75: un valor corrupto compartido entre mock y assertion.
- Item 79: un shell que convierte bytes en texto donde se cree que
  mueve archivos.

## 80. Los PRs que cierran items no siempre actualizan la bitacora

**Severidad:** BAJA.
**Estado:** ABIERTO.
**Origen:** Detectado durante la verificacion de bitacora del 2026-10-09.

**Problema:** de los 10 PRs mergeados desde 2026-10-07, 7 no tienen entrada en
`vault/02_Bitacora/bitacora.md`. Solo uno es un hueco material: **#225**, que
mergeo el item 79 (deuda nueva, MEDIA) y la regla 6.5 de `AGENTS.md` sin
registrar ninguno de los dos.

Los otros 6 son chores o bumps (`#217` deps, `#218` sentry, `#221` exports de
Engram, `#219` saneamiento de docs) y no justificación para una entrada. `#219`
es el borderline: "9 items, 8 commits, solo .md" — si algumo de esos 9 items
cambio de estado, eso es historia y no quedo escrita.

**Evidencia:** la entrada de cierre del 2026-10-08 enumera la familia "un control
que parece cubrir y cubre otra" con cuatro casos y dice "ver arriba". El item 79 es
**el cuarto miembro de esa familia** y su entrada no existia, asi que la narrativa
no cerraba.

**Riesgo:** bajo en impacto directo, alto en el otro sentido. La bitacora es lo
unico que dice _por que_ una decision se tomo. Una leccion que solo vive en
`deuda-tecnica.md` y `AGENTS.md` no aparece cuando alguien lee la historia del
proyecto, y el error se re-descubre.

**Mitigacion propuesta:** agregar al checklist de cierre de PR (en `AGENTS.md`) un
paso explicito: **"si el PR cierra un item, introduce una regla en `AGENTS.md` o
cambia el estado de un item, verificar que la bitacora tenga entrada."** El
checklist de cierre ya tiene un item para Engram y otro para la bitacora, pero
ninguno que los condiciona entre si.

## 81. Un stash parcial no protege el working tree, y `stash pop` puede aplicar sobre la rama equivocada

**Severidad:** MEDIA.
**Estado:** ABIERTO.
**Origen:** Detectado durante el incidente del worktree de Paseo en el PR #227.

**Problema 1 — el stash protege solo lo stasheado.** Durante el PR #227 se corrio
`git stash push -- apps/admin/.../route.ts` para verificar que los tests nuevos
fallaban sin el fix. El worktree de Paseo se auto-elimino a mitad del trabajo. El
`route.ts` sobrevivio (esta en `stash@{0}`) porque **el stash vive en el repo
principal, no en el worktree**. Los 4 tests, que eran cambios de working tree
nunca stasheados, se perdieron y hubo que reescribirlos.

**Problema 2 — `stash pop` aplica sobre la rama del worktree donde corre.** El
pop se ejecuto en el worktree principal, que estaba en `develop`, y aplico el fix
ahi en vez de en la rama del fix. Se detecto y se movio antes de commitear, pero
por millimetros el fix entra a `develop` sin review.

**Evidencia:** `origin/develop` nunca se toco (verificado con `git log
origin/develop` antes y despues del commit). La rama `fix/h-f2-6-...` arrastro el
cambio en el `checkout` porque ambas estaban en el mismo commit.

**Mitigacion:** (a) **en worktrees que pueden morir, commit o stash seguido —
nunca stash parcial de un archivo que se esta verificando en rojo**; (b) un stash
parcial da sensacion de red sin darla, que es peor que no tenerla; (c) verificar
`git branch --show-current` despues de toda operacion que mueva cambios entre
ramas, antes de commitear.

## 82-86. Violaciones de GGA preexistentes que bloquean commits

**Origen comun:** GGA devolvio `STATUS: FAILED` al commitear el PR #229 (item 66). Las
**5 son preexistentes y ninguna estaba en el diff** — verificado con
`git diff --cached`. Se commitearon con `--no-verify` y la justificacion quedo en el body
del commit.

**Por que se registran:** GGA revisa **archivos completos, no diffs**. Sin registro, estas
5 violin el mismo commit de cualquier PR futuro que toque esos archivos, y cada vez va a
parecer un hallazgo nuevo. Con registro, el proximo agente las reconoce comoKnown.

**Nota de alcance:** GGA tambien reporto tres observaciones no bloqueantes (duplicacion de
`rateLimitKey` entre admin y storefront, CI hardcodeado en el payer, y
`MERCADOPAGO_ACCESS_TOKEN` leido directo). No se registran aqui: son hipotesis sobre
intencion, no hallazgos verificados.

## 82. `const payer: any` en el checkout preference de storefront

**Severidad:** BAJA.
**Estado:** ABIERTO.

**Problema:** `apps/storefront/app/api/checkout/preference/route.ts:211` declara
`const payer: any = {`, lo viola la regla de AGENTS.md ("No usar `any`: preferir `unknown` +
type guard").

**Por que no es puramente cosmetico:** el objeto se **muta** en L222 (`payer.phone = {...}`)
y se pasa a MP en L266. Con `any`, ni el compilador ni el reviewer ven el shape; una
propiedad mal nombrada llega al payload de MercadoPago sin error de tipo.

**Fix propuesto:** definir la interfaz del payer segun el shape que espera la API de MP,
incluyendo `phone` desde el inicio. El shape real hay que sacarlo del doc de MP, no del
codigo actual.

**Bloquea commits:** si. GGA revisa el archivo completo.

## 83. `catch (fetchError: any)` en el checkout preference de storefront

**Severidad:** BAJA.
**Estado:** ABIERTO.

**Problema:** `apps/storefront/app/api/checkout/preference/route.ts:295` usa
`catch (fetchError: any)`.

**Por que importa mas alla de la regla:** en L296 se lee `fetchError.name === 'AbortError'`.
Con `any` ese acceso no esta verificado: si el rejection no es un `Error` (un string, un
`undefined`, un objeto de otra lib), `.name` no existe y la comparacion da `false` — el
timeout se reporta como un error generico y se pierde la distincion que el codigo estaba
intentando hacer.

**Fix propuesto:** `catch (fetchError: unknown)` + `fetchError instanceof Error` para el
guard.

**Bloquea commits:** si.

## 84. Fallback silencioso a `redis://localhost:6379` (2 lugares)

**Severidad:** BAJA. **No MEDIA** — ver la nota de diseno al final.
**Estado:** ABIERTO.

**Problema:** `packages/commerce/src/redis.ts:6` y `apps/superadmin/lib/redis.ts:7` tienen
`process.env.REDIS_URL || 'redis://localhost:6379'`. En produccion, si falta la variable,
el cliente conecta a localhost y todo degrade en silencio: rate limits desactivados, cache
sin invalidar, y **ningun warn** que lo delate.

**Nota de diseno — el fix propuesto en el reporte original ("throw en produccion") es
incorrecto.** Contradice dos reglas de `AGENTS.md`: la de Redis ("si Redis cae: degradar,
nunca 500 — fail-open para rate limits") y la de Progresividad ("el codigo nunca debe
fallar por falta de un servicio externo"). El fallback es una decision coherente con el
proyecto. Lo que falta no es el fallback: es el **silencio**.

**Fix propuesto:** mantener el fallback y hacerlo **ruidoso**: un `logger.warn` cuando se
usa el fallback, para que en produccion sea visible que Redis no esta configurado. Si en
produccion `REDIS_URL` deberia ser obligatoria, eso es una regla **global** de env, no un
caso de este modulo.

## 85. `apps/superadmin` tiene un SEGUNDO cliente Redis que evita los wrappers

**Severidad:** MEDIA. **No BAJA** — ver abajo.
**Estado:** ABIERTO.

**El reporte original planteaba esto mal.** `packages/commerce/src/index.ts:30-32` dice
explicitamente que el cliente crudo **no** se reexporta del barrel, a proposito:

> El cliente crudo NO se reexporta: AGENTS.md prohibe usar `redisClient.*` directamente.
> Exportarlo desde el barrel invita a violarlo.

O sea: la decision ya esta tomada y documentada. Lo unico que obliga a `redis.ts` a
exportarlo es que `apps/storefront/lib/redis.ts:2` lo reexporta del deep path. Y **ningun
consumer de commerce lo usa directamente**.

**El problema real es otro, y no estaba registrado:** `apps/superadmin/lib/redis.ts` crea un
**cliente Redis duplicado e independiente**, con `lazyConnect: true` pero **sin**
`enableOfflineQueue: false` y **sin** `whenReady`. `apps/superadmin/app/api/tenants/route.ts:99`
lo usa directo: `await redisClient.del(...)`.

Esta en un `try/catch` (L98-102), asi que no rompe el alta. Pero reproduce exactamente el
problema que `AGENTS.md` describe: **en un cold-start serverless el primer comando se
rechaza mientras el socket conecta**, la invalidacion de cache falla, y queda solo un
`logger.error`. O sea: el cache de un tenant recien creado puede quedar desactualizado sin
que nadie lo note.

**Fix propuesto:** borrar `apps/superadmin/lib/redis.ts` y que superadmin use los wrappers
de `@repo/commerce` (`redisDel`). Eso ademas habilita el item 86: si nadie necesita el
cliente crudo, commerce puede dejar de exportarlo.

**Enlazado con el item 86:** son el mismo cambio. Quitar `redisClient` de la facade de
storefront (85) es lo que permite que storefront importe directo de `@repo/commerce` (86).

## 86. Import inconsistente de Redis entre apps

**Severidad:** BAJA.
**Estado:** ABIERTO.

**Problema:** `apps/storefront` importa Redis de su facade `@/lib/redis`
(`app/api/checkout/preference/route.ts:13`), mientras `apps/admin` importa directo de
`@repo/commerce` (`lib/subscriptions/handlers.ts:2`). Verificado: **`apps/admin/lib/redis.ts`
no existe**; storefront si tiene facade.

**Fix propuesto:** elegir una sola fuente. La opcion de menor riesgo es que storefront
importe directo de `@repo/commerce` y se borre la facade — pero eso depende del item 85,
porque la facade es hoy la razon por la que `redisClient` se exporta desde commerce.

**Bloquea commits:** si, mientras GGA siga leyendo la inconsistencia como violacion.

## 87. `check:encoding` no ve los caracteres `?` rotos

**Severidad:** MEDIA.
**Estado:** ABIERTO.
**Origen:** detectado al repara los items 76 y 77 (2026-10-09).

**Problema:** `scripts/check-encoding.mjs` clasifica 5 categorias: `U+FFFD`, `U+FEFF` al
inicio, doble encoding de 2 y de 3 bytes, y control chars fuera de tab/LF/CR. Un caracter
`?` ASCII **no cae en ninguna**. En `bitacora.md` L864 habia 4 separadores rotos
renderizados como `?` (flechas tipo `→`), invisible para el detector.

El conteo real era **42 puntos de corrupcion, no 39**: 34 `U+FFFD` + 4 control chars +
4 `?`. Los 4 `?` se repararon en el PR que cierra el item 76, pero **la cobertura del
detector sigue sin existir**: el mismo tipo de dano puede volver a colarse y dar verde.

**Por que NO se solutiono en el mismo PR:** un patron que detecte `?` produce falsos
positivos. En markdown un `?` legitimo es normal ("¿que paso?" no, pero "Saber?" si), y
en este mismo repo la bitácera cita literalmente `? Migración existente modificada`, que es
la salida real de `scripts/check-migrations.sh`. Detectar `?` a secas rompe el control.

**Mitigacion propuesta (NO implementada):** un patron que exija **contexto**, no el caracter
suelto. Por ejemplo `?` entre dos palabras no acentuadas donde la palabra resultado es
spanol conocido, o `?` rodeada de espacios en un contexto enumerativo (`X ? Y ? Z`). Requiere
disenar el balance falso-positivo antes de anadirlo.

**Regla operativa mientras tanto:** un `?` en un `.md` no es un `?` hasta que se mire el
byte. Tratarlo como sospechoso y verificar por Node.

**SEGUNDO hueco del mismo tipo, encontrado al repara: CJK.** El detector tampoco mira
caracteres CJK, y `bitacora.md` tiene **12**: L976 (4) y L977 (6) son el **documentado**
del incidente historico del item 52 —estan citando el texto chino que se encontro y se
corrijo, asi que podrian ser ejemplos intencionales—, pero **L3910 (2) parece corrupcion
real**: "con el viejo" seguido de 2 caracteres CJK donde deberia haber un separador. No se
toco en este PR porque el item 87 ya es un hueco del detector y ampliarlo aca seria alcance
no autorizado. **Queda como candidato a item propio**: la decision es si L3910 se repara y
si el detector gana cobertura de CJK.

**Nota sobre AGENTS.md:** la regla de "escanear en busca de CJK" (item 40, regla 3) es
manual, con un snippet de PowerShell. El detector de encoding no lo hace. Dos controles
para lo mismo, y el automatico es el que corre en CI.

## 88. Append-only no especifica si admite reparacion byte-level

**Severidad:** BAJA.
**Estado:** ABIERTO.
**Origen:** detectado al repara los items 76 y 77 (2026-10-09).

**Problema:** `AGENTS.md` define dos reglas que chocan en el caso de una reparacion de
encoding:

1. La bitácora es **append-only**, y la regla de verificacion exige que `git diff` contra
   `origin/develop` muestre **solo adiciones** (`git diff -- <archivo> | Select-String "^-"`
   debe dar 0 lineas).
2. Reparar corrupcion byte-level **modifica lineas existentes**: el diff muestra pares
   `-`/`+` en ~14 lineas de `bitacora.md`.

No hay regla que diga cual gana. Y el riesgo no es teorico: la regla 1, aplicada por un
agente futuro sin saber el contexto, lo lleva a **"restaurar"** el archivo a su version
previa, **reintroduciendo la corrupcion**. Ya paso la inversa en el cierre de #224, donde un
"bug" imaginario casi destruye un archivo sano.

**Lo que este repo decidioimplicitamente al reparar el item 76:** la reparacion byte-level
**no viola** append-only, porque no se perdio contenido — el numero de lineas es identico
antes y despues (4399) y ninguna se borro. Es una _correccion_, no una _edicion_. Pero eso
deberia estar escrito, no deducido por suerte.

**Fix propuesto:** agregar a la seccion de bitácora de `AGENTS.md` una excepcion explicita:

> **Excepcion — reparacion byte-level.** Si un archivo acumulativo tiene corrupcion de
> encoding, la reparacion modifica lineas existentes y el diff **va a mostrar borrados**.
> Eso NO es una regresion: verificar que el numero de lineas no cambio y que ninguna se
> borro por completo. **Nunca "restaurar" el archivo a una version previa para cumplir la
> regla de append-only** — eso reintroduce la corrupcion.

Y en la regla de append-only, una linea que diga que la verificacion de "solo adiciones" no
aplica a una correccion de encoding verificada byte a byte.

## 89. GGA no revisa archivos `.mjs`

**Severidad:** BAJA.
**Estado:** ABIERTO.
**Origen:** detectado al commitear el PR #231 (2026-10-09).

**Problema:** los patrones de GGA son `*.ts,*.tsx,*.js,*.jsx,*.sql`. **`.mjs` no esta
incluido.** El PR #231 modifico `scripts/check-encoding.mjs` —**el detector de encoding
completo**— y GGA respondio _"No matching files staged for commit"_: el commit paso sin
revision de codigo.

Es el caso mas delicado posible: el hook que valida las reglas del proyecto no revisa los
scripts que las implementan. `scripts/check-migrations.sh` (`.sh`) tampoco esta cubierto, y
tampoco `.mjs` de test.

**Mitigacion propuesta:** agregar `.mjs` y `.cjs` a los patrones de GGA, y evaluar `.sh` (mas
dificil: no es TypeScript y el resto del pipeline asume TS).

**Riesgo de la mitigacion:** GGA manda el archivo a un LLM que responde con formato de
review de TypeScript. Un `.mjs` o un `.sh` pueden producir falsos positivos o ruido. Conviene
probarlos antes de agregarlos, no solo broadening el patron.

## 90. CJK no detectado por el check de encoding

**Severidad:** MEDIA.
**Estado:** ABIERTO.
**Origen:** detectado durante la reparacion de los items 76 y 77 (PR #231).

**Problema:** `scripts/check-encoding.mjs` no mira caracteres CJK. `bitacora.md` tiene **12**,
en tres lineas:

| Linea | Cantidad | Que es                                                                       |
| ----- | -------- | ---------------------------------------------------------------------------- |
| L976  | 4        | cita del texto chino **encontrado y corregido** en el incidente del item 52  |
| L977  | 6        | idem                                                                         |
| L3910 | 2        | **corrupcion real**: "con el viejo" + 2 CJK donde deberia haber un separador |

L976 y L977 son ejemplos documentados, como el moji2 intencional de L1527. **L3910 parece
corrupcion genuine** y no se toco porque el item 87 (mismo tipo de hueco) ya existia y ampliar
alcance en el PR de los items 76/77 no estaba autorizado.

**Por que MEDIA y no BAJA:** es el modo de falla que ya produjo dano real. El item 52
documenta que "caracteres CJK colados en comentarios" pasaron inadvertidos y hubo que
buscarlos a mano. Y el item 40 tiene una regla manual de escaneo de CJK, es decir, **el
repo reconoce el problema pero lo mitiga con disciplina, no con un control automatico**.

**Mitigacion:** extender `scanText` con los rangos CJK (`U+4E00-U+9FFF`, `U+3040-U+30FF`,
`U+AC00-U+D7AF`). El problema es el mismo que con el `?` del item 87: **el detector no puede
marcar CJK sin falsos positivos** en un repo con español, porque CJK es una categoria
amplia y un solo caracter colado rompe un archivo entero. Se necesita un umbral o un
allowlist por linea, como se hizo con el moji2 intencional.

**Nota sobre la regla de AGENTS.md:** el detector de encoding y la regla manual de CJK del
item 40 son dos controles para lo mismo, y el que corre en CI es el que no lo cubre.
