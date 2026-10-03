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

**Estado:** abierto (2026-10-01).

**Contexto:** MP tiene un estado `paused` para preapprovals (pausar una suscripcion sin cancelarla). El spec transversal no lo contempla.

**Impacto:** si el tenant pausa desde el panel de MP, la DB no lo refleja. El estado sigue en `active` y el tenant conserva acceso completo, cuando la intencion de MP es suspenderse. Divergencia silenciosa entre MP y nuestra DB.

**Decision (Luis, planning Fase 2):** documentar como **no soportado** en Fase 2. El webhook registra `warn` y **no transiciona** cuando recibe `paused`. No se inventa un estado nuevo ni se mapea a `past_due` (que tiene semantica de dunning, que es otra cosa).

**Se agrega al transversal cuando Fase 3 defina la semantica de pausa:** ¿es `past_due`? ¿un estado nuevo? ¿bloquea el panel admin? ¿el storefront sigue accesible? Requiere decision de producto.

**Nota:** `put /preapproval/{id} {status: "paused"}` es la via por API. Si Fase 3 expone pausar, debe decidir si pasa por la API nuestra o se deja solo el panel de MP.

**Severidad:** MEDIA.

**Urgencia:** BAJA.

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
