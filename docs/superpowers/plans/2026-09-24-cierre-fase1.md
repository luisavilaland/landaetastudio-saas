# Plan de implementación — Cierre formal de Fase 1

> **Para agentes:** este plan se ejecutará inline en la sesión actual, con checkpoint humano antes de cualquier cambio de schema o datos en Neon.

**Objetivo:** cerrar T11, T13, los grants DML de `plans`, la documentación y la deuda de Fase 1 sin aplicar la migración en Neon antes del checkpoint acordado.

**Arquitectura:** las variables de MercadoPago se validan en el paquete compartido; T11 será una integración real contra el rol `app_user` y no usará mocks; los permisos de `plans` se reducirán mediante una migración append-only; la documentación y el PR distinguirán cierre parcial de T12.

**Stack:** TypeScript, Zod, Drizzle ORM, PostgreSQL/Neon, Vitest, GitHub Actions, pnpm/Turborepo.

---

## Tarea 0 — Preflight y secretos

**Archivos:** ninguno; solo entorno local y comandos de verificación.

- [ ] En el worktree `chore/close-fase1`, ejecutar `pnpm install --frozen-lockfile` para disponibilizar las dependencias del worktree.
- [ ] Ejecutar `gh secret list | grep -i NEON`.
- [ ] Si `NEON_DATABASE_APP_URL` aparece, guardar únicamente el nombre del secret y continuar con la edición del workflow en la Tarea 5.
- [ ] Si no aparece, no editar `.github/workflows/e2e.yml`; reportar al humano que falta crear el secret con la connection string de `app_user` y esperar confirmación antes de permitir cualquier skip.
- [ ] Mantener la clave de cifrado únicamente en `.env.local` ignorado. No imprimirla, no incluirla en ejemplos, documentación, logs, diffs ni commits.
- [ ] Verificar que `.env.local` no aparece en `git status`.

## Tarea 1 — T13: contrato de variables y documentación de setup

**Archivos:**
- Modificar: `.env.local.example:26-33`
- Modificar: `packages/validation/src/env.ts:10-67`
- Modificar: `turbo.json:8-28`
- Modificar: `SETUP.md` en la sección de variables de entorno
- Testear: `packages/validation/src/__tests__/env.test.ts`

- [ ] Escribir primero tests de validación para confirmar que una clave de menos de 32 caracteres falla y que las tres variables nuevas son aceptadas cuando sus valores son válidos. Usar `vi.resetModules()` + `vi.stubEnv()` y una importación dinámica `await import('../env')`; limpiar con `vi.unstubAllEnvs()` en `beforeEach` para evitar falsos verdes por estado residual del módulo.
- [ ] Ejecutar `pnpm vitest run packages/validation/src/__tests__/env.test.ts`; el test nuevo debe fallar antes de modificar `env.ts` por la ausencia de `MP_TOKEN_ENCRYPTION_KEY` en el schema.
- [ ] Agregar a `coreSchema` `MP_TOKEN_ENCRYPTION_KEY: z.string().min(32, 'MP_TOKEN_ENCRYPTION_KEY must be at least 32 characters')`, `MP_PLATFORM_ACCESS_TOKEN: z.string().min(1).optional()` y `MP_PLATFORM_WEBHOOK_SECRET: z.string().min(1).optional()`.
- [ ] Mantener `MP_TOKEN_ENCRYPTION_KEY` en `coreSchema`, por lo que será required en desarrollo y producción, sin rama condicional por `NODE_ENV`.
- [ ] Agregar las tres variables a `turbo.json.tasks.build.env`.
- [ ] Agregar al template los nombres, el comentario de generación con `openssl rand -base64 32` y valores de ejemplo no secretos.
- [ ] Documentar en `SETUP.md` que la clave debe tener al menos 32 caracteres, que debe ser idéntica en storefront/admin/superadmin y que la variable real solo vive en Vercel y `.env.local`.
- [ ] Ejecutar nuevamente `pnpm vitest run packages/validation/src/__tests__/env.test.ts`; debe pasar.
- [ ] Ejecutar `pnpm --filter @repo/validation typecheck`.

## Tarea 2 — T11: test real de RLS cross-tenant

**Archivo:**
- Crear: `packages/db/src/__tests__/rls-cross-tenant.test.ts`

- [ ] Escribir el test antes de cualquier cambio de schema. Importar estáticamente solo `postgres`, `drizzle-orm` y el schema; importar `../index` dinámicamente dentro de `beforeAll` para que una URL ausente no provoque un error de import antes de la evaluación del caso. Para el caso 8, usar una conexión dedicada nueva o ejecutar `BEGIN; RESET app.tenant_id; SELECT ...; ROLLBACK;` explícito, garantizando que no existe contexto residual del pool.
- [ ] Determinar si el runner tiene `DATABASE_APP_URL` real. Si existe, comprobar `current_user` y `rolbypassrls`; si el rol tiene bypass, fallar con error explícito. Si no existe en el entorno local, el caso queda sin ejecutar hasta que se disponga del secret, y se reporta el bloqueo antes de aplicar cualquier skip.
- [ ] Obtener `tienda1` y `tienda2` por `slug` y fallar explícitamente si el seed no está presente.
- [ ] Crear fixtures aisladas únicamente cuando no existan, sin sobrescribir filas reales, y registrarlas para cleanup. Usar `withTenantContext` para toda operación sobre tablas RLS.
- [ ] Implementar los casos 1–4: lecturas de `subscriptions` y `tenant_mp_config` desde A y B solo ven filas del tenant activo.
- [ ] Implementar el caso 5: con contexto A, insertar una fila dirigida a B debe fallar por RLS. Si la inserción pasa, detener inmediatamente la tarea y reportar `CRÍTICO`: la policy 0014 no está aplicando `WITH CHECK` implícito y no se debe continuar con 0015.
- [ ] Implementar los casos 6–7: con contexto A, `UPDATE` y `DELETE` dirigidos a B devuelven cero filas. No usar `rowCount` de una API no verificada; usar `returning({ id: ... })` y afirmar que el arreglo está vacío.
- [ ] Implementar el caso 8: una consulta directa sin `set_tenant_id` devuelve cero filas en tablas RLS.
- [ ] Limpiar fixtures en `afterAll` usando contexto del tenant propietario y cerrar el cliente `postgres` con `end()`.
- [ ] Ejecutar `pnpm vitest run packages/db/src/__tests__/rls-cross-tenant.test.ts` con `DATABASE_APP_URL` real. Si el caso 5 pasa, detener todo y reportar el hallazgo crítico; no editar la policy ni aplicar la migración.
- [ ] Ejecutar `pnpm --filter @repo/db typecheck`.

## Tarea 3 — Migración 0015 y snapshot

**Archivos:**
- Crear: `packages/db/migrations/0015_revoke_plans_dml.sql`
- Modificar: `packages/db/migrations/meta/_journal.json`
- Crear: `packages/db/migrations/meta/0015_snapshot.json`
- No modificar: migraciones `.sql` o snapshots existentes

- [ ] Confirmar que no existe `0015` antes de crearla y que el worktree está limpio en `packages/db/migrations/`.
- [ ] Generar la entrada custom con el comando soportado por la versión instalada de Drizzle; si el comando no está disponible, crear manualmente el archivo SQL y el snapshot derivado de 0014 sin tocar 0014.
- [ ] Escribir únicamente estos objetos en 0015:

```sql
REVOKE INSERT ON TABLE plans FROM app_user;
REVOKE UPDATE ON TABLE plans FROM app_user;
REVOKE DELETE ON TABLE plans FROM app_user;
```

- [ ] No revocar `SELECT`, no habilitar RLS sobre `plans` y no agregar política.
- [ ] Copiar el snapshot 0014 a 0015, cambiar solo el identificador del snapshot y su `prevId` para apuntar a 0014; conservar el schema porque la migración no cambia columnas ni tablas.
- [ ] Agregar en `_journal.json` la entrada idx `15`, tag `0015_revoke_plans_dml`, version `7` y timestamp actual, sin alterar entradas anteriores.
- [ ] Ejecutar `git diff --check` y el guard de migraciones; no ejecutar `db:migrate` todavía.
- [ ] Ejecutar el grep exhaustivo de `dbPlans`, `plans`, `insert`, `update`, `delete` y `onConflict` en runtime, scripts, jobs y tests. Clasificar cada coincidencia como seed o DML runtime. Cualquier DML runtime activa CASO B y bloquea la aplicación de 0015.
- [ ] Revisar el diff de 0015, journal y snapshot. En este punto ejecutar el checkpoint intermedio y reportar al humano antes de tocar Neon.

## Tarea 4 — Checkpoint intermedio obligatorio

**Archivos:** ninguno; no aplicar migraciones ni seeds todavía.

- [ ] Confirmar que el test T11 fue escrito y ejecutado, y que el caso 5 no pasó inadvertidamente.
- [ ] Confirmar que 0015 fue creada sin modificar migraciones previas.
- [ ] Reportar al humano: archivos modificados, resultado del test RLS, resultado del grep de grants, disponibilidad de `NEON_DATABASE_APP_URL` y estado del workflow E2E.
- [ ] Esperar confirmación humana antes de ejecutar cualquier `db:migrate`, REVOKE o `db:seed` sobre Neon.

## Tarea 5 — E2E workflow, solo si el secret existe

**Archivo:**
- Modificar: `.github/workflows/e2e.yml` solo si `NEON_DATABASE_APP_URL` apareció en el preflight

- [ ] Si el secret no existe, no editar el workflow. Reportar que falta `NEON_DATABASE_APP_URL` y esperar confirmación humana antes de cualquier skip.
- [ ] Si existe, agregar al job que ejecuta la suite E2E:

```yaml
DATABASE_APP_URL: ${{ secrets.NEON_DATABASE_APP_URL }}
```

- [ ] Mantener `DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}` exclusivamente para seed/operaciones owner; no reutilizar esa URL para T11.
- [ ] Validar el YAML y revisar que no se impriman valores de secrets.

## Tarea 6 — Documentación, ADR y deuda

**Archivos:**
- Modificar: `docs/adr/ADR-024-pgcrypto-tokens.md`
- Modificar: `docs/superpowers/specs/2026-09-blueprint-v2.6.md`
- Modificar: `bitacora.md`
- Modificar: `docs/deuda-tecnica.md`
- Modificar: `docs/auditoria-fase1.md` solo si el cierre requiere reflejar el estado final
- Modificar: `SETUP.md` si el contenido de T13 no quedó completo en Tarea 1

- [ ] Actualizar ADR-024 para incluir `publicKey` e `isVerified` en la sección de schema y aclarar que están fuera del mínimo original de T4/ADR-024.
- [ ] Actualizar el Blueprint para seis estados, agregar `abandoned`, eliminar `ARRANCAR` de Fase 1 y conservar la sección de cierre.
- [ ] Reparar `bitacora.md` como append-only: convertir el tramo UTF-16/NUL a UTF-8 sin borrar entradas previas y agregar solo la entrada de cierre.
- [ ] Agregar los ítems 18–22 exactamente en este orden y con el texto acordado: UPDATE-only/upsert, T11 CI condicional, falta de test seed/plans, `publicKey`/`isVerified` fuera de ADR-024 y T12 mock-only con roundtrip real en Fase 3.
- [ ] Registrar el ítem 23 por la colisión de snapshots 0012/0013/0014; no modificar los snapshots existentes.
- [ ] Registrar el ítem 24 solo si una verificación posterior confirma que admin usa owner; la verificación actual confirmó `app_user`, por lo que no se agrega.
- [ ] Actualizar el issue #112 como cierre parcial mock-only y dejar explícito que el roundtrip DB es deuda de Fase 3.
- [ ] No cerrar issues hasta que la verificación final esté disponible.

## Tarea 7 — Verificación completa sin DB ni seed

**Archivos:** ninguno.

- [ ] Ejecutar `pnpm lint` y registrar el resultado.
- [ ] Ejecutar `pnpm typecheck` y registrar el resultado.
- [ ] Ejecutar `pnpm test` y registrar el resultado.
- [ ] Ejecutar `pnpm build` y registrar el resultado.
- [ ] Ejecutar el guard exacto del seed en entorno local aislado, sin Neon:

```text
NODE_ENV=production DATABASE_URL=postgresql://dummy pnpm db:seed
```

En PowerShell, la misma prueba se ejecuta con variables de entorno explícitas, sin conectarse a Neon:

```powershell
$env:NODE_ENV='production'; $env:DATABASE_URL='postgresql://dummy'; pnpm db:seed
```

- [ ] Confirmar que el comando falla por el guard de seed y no conectar a una base real. Restaurar las variables de entorno del shell después de la prueba.
- [ ] No ejecutar `pnpm db:migrate` ni `pnpm db:seed` contra Neon durante esta fase.

## Tarea 8 — Aplicación en Neon, solo después de aprobación humana

**Archivos:** ninguno; operación de DB. Excepción de backup autorizada para esta ejecución.

- [ ] Confirmar con `DATABASE_URL` owner que `app_user` tiene `DELETE`, `INSERT`, `SELECT` y `UPDATE` sobre `plans`.
- [ ] Documentar que `pg_dump`/`psql` no están disponibles en Paseo y que no se puede instalar; no ejecutar `db:seed`.
- [ ] Aplicar 0015 con `pnpm db:migrate` usando `DATABASE_URL` owner.
- [ ] Verificar con `pg_catalog` que `app_user` conserva únicamente `SELECT` sobre `plans`.
- [ ] Ejecutar smoke tests con `DATABASE_APP_URL`: `COUNT(*)` debe ser 3 y el INSERT de prueba debe fallar con 42501.
- [ ] Si cualquier test o guard falla, detener la secuencia y ejecutar el rollback `GRANT INSERT, UPDATE, DELETE ON plans TO app_user` solo si el REVOKE llegó a aplicarse; reportar el motivo.

## Tarea 9 — Revisión final y entrega

- [ ] Ejecutar `git diff --check` y revisar `git diff` contra `origin/develop`.
- [ ] Ejecutar `git status` y stagear únicamente los archivos explícitos del cierre.
- [ ] Actualizar contadores de tests en README, SETUP, TESTING y TESTING-MANUAL si la suite cambia.
- [ ] Crear commit con los archivos intencionados, push de `chore/close-fase1` y PR contra `develop` sin mergear.
- [ ] El cuerpo del PR debe incluir `Cierra parcialmente #112 (mock-only)`, los guards de 0015, el resultado de T11, el checkpoint de backup/seed y la referencia a la deuda 18–22.
- [ ] Reportar el resultado final con comandos ejecutados, archivos, checks y cualquier bloqueo; no mergear el PR.
