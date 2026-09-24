# Diseño — Cierre formal de Fase 1

**Fecha:** 2026-09-24
**Rama:** `chore/close-fase1`
**Estado:** pendiente de aprobación tras revisión del usuario

## Objetivo

Cerrar formalmente la Fase 1 del Blueprint v2.6: completar T11, T13, retirar permisos DML de `plans` para el runtime, alinear la documentación y registrar la deuda que queda fuera de alcance.

## Alcance

- Actualizar el contrato de variables de entorno de MercadoPago.
- Agregar una prueba de aislamiento RLS real contra Neon usando el rol `app_user`.
- Agregar una migración append-only que revoque `INSERT`, `UPDATE` y `DELETE` sobre `plans` para `app_user`, conservando `SELECT`.
- Reparar el drift de Blueprint, hoja de ruta, bitácora y SETUP.
- Registrar las deudas 18–22 y, si corresponde, 23–25 sin reemplazar los cinco acuerdos base.
- Actualizar ADR-024 para documentar `publicKey` e `isVerified` y aclarar que están fuera del mínimo original.
- Ajustar el cierre de T12 a mock-only y dejar el roundtrip real como deuda de Fase 3.
- Ejecutar el Definition of DoD completo antes de abrir el PR.

No se modifican migraciones aplicadas ni se cambia el comportamiento de runtime de MercadoPago en esta tarea.

## 1. Variables de entorno

### Contrato

- `MP_TOKEN_ENCRYPTION_KEY` será obligatoria siempre y se validará con `z.string().min(32)`, sin condicional por `NODE_ENV`.
- `MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` serán opcionales hasta Fase 2.
- La clave real vivirá únicamente en Vercel y en archivos `.env.local` ignorados por Git. El worktree de implementación usará un `.env.local` local, sin incluir el valor en documentación, logs, ejemplos ni commits.
- `.env.local.example` contendrá únicamente un valor de ejemplo y la instrucción de generación.

### Archivos

- `.env.local.example`: agregar las tres variables y el comando de generación de la clave.
- `packages/validation/src/env.ts`: hacer `MP_TOKEN_ENCRYPTION_KEY` required en todos los modos con longitud mínima 32; agregar las dos variables platform como optional.
- `turbo.json`: declarar las tres variables en el entorno de build.
- `SETUP.md`: documentar generación, configuración local, configuración Vercel por entorno y el hecho de que la misma clave debe usarse en las tres apps.

## 2. Prueba real de RLS cross-tenant

### Conexión y ejecución

La prueba vivirá en `packages/db/src/__tests__/rls-cross-tenant.test.ts` y será una prueba de integración real, sin mocks de Drizzle, `db`, `withTenantContext` ni políticas RLS.

- `withTenantContext` se importará dinámicamente para que la ausencia de configuración no provoque un error de importación antes de la evaluación del skip.
- La prueba usará `DATABASE_APP_URL` como conexión del rol `app_user` sin `BYPASSRLS`.
- El agente editará `.github/workflows/e2e.yml` para agregar `DATABASE_APP_URL: ${{ secrets.NEON_DATABASE_APP_URL }}` desde un secreto del mismo proyecto Neon, separado de `NEON_DATABASE_URL` owner. No se debe reutilizar la URL owner para probar RLS.
- La prueba debe ejecutarse siempre que el workflow tenga la URL app configurada. Si no se tiene acceso para agregar el secreto de GitHub, se reportará al humano el bloqueo concreto antes de modificar el test para permitir un skip.
- El skip solo se aplica si el humano confirma explícitamente que no puede agregar la variable ahora. Si se autoriza, el bloqueo se documentará como ítem 19; no se ocultará el fallo.
- Si la URL apunta a un rol con `rolbypassrls=true`, la prueba fallará con un error de configuración explícito en vez de producir un falso verde.
- Antes de editar `.github/workflows/e2e.yml`, ejecutar `gh secret list | grep -i NEON`. Si `NEON_DATABASE_APP_URL` existe, agregar `DATABASE_APP_URL: ${{ secrets.NEON_DATABASE_APP_URL }}` al job E2E. Si no existe, no editar el workflow: reportar al humano que debe crear el secret con la connection string de `app_user` y esperar confirmación antes de aplicar cualquier skip.
- Los casos 5–7 de escritura usan la policy `USING` como `WITH CHECK` implícito. Si el caso 5 (`INSERT` de B bajo contexto A) pasa, la policy de 0014 tiene un problema real: detener el trabajo y reportar un hallazgo CRÍTICO antes de continuar.
- El workflow CI seguirá usando su URL dummy; la prueba solo podrá ejecutarse contra un entorno con `DATABASE_APP_URL` real.

### Fixtures y casos

Se usarán los tenants `tienda1` y `tienda2` del seed, con fixtures aislados y limpieza segura, sin sobrescribir datos existentes. Las operaciones DML de prueba usarán siempre `withTenantContext` y consultas parametrizadas.

Casos mínimos:

1. Con contexto de A, `SELECT` de `subscriptions` no devuelve filas de B.
2. Con contexto de B, `SELECT` de `subscriptions` no devuelve filas de A.
3. Con contexto de A, `SELECT` de `tenant_mp_config` no devuelve filas de B.
4. Con contexto de B, `SELECT` de `tenant_mp_config` no devuelve filas de A.
5. Con contexto de A, un `INSERT` dirigido a B falla por RLS.
6. Con contexto de A, `UPDATE` dirigido a B no afecta filas; la operación devuelve cero filas.
7. Con contexto de A, `DELETE` dirigido a B no afecta filas; la operación devuelve cero filas.
8. Una consulta directa sin `set_tenant_id` devuelve cero filas en tablas RLS.

La prueba también verificará que el rol conectado no tiene `BYPASSRLS` y que las fixtures se limpian al finalizar.

## 3. Migración 0015 y doble guard

Se agregará una migración nueva, sin modificar migraciones existentes:

`packages/db/migrations/0015_revoke_plans_dml.sql`

La migración revocará para `app_user`:

- `INSERT` sobre `plans`;
- `UPDATE` sobre `plans`;
- `DELETE` sobre `plans`.

No revocará `SELECT` ni habilitará RLS sobre `plans`, porque es una tabla global de catálogo.

La entrada correspondiente se agregará a `packages/db/migrations/meta/_journal.json` y se generará el snapshot `0015_snapshot.json` a partir del snapshot 0014, sin modificar el snapshot anterior.

### Guard obligatorio antes de aplicar en Neon

1. Grep exhaustivo de `dbPlans`, `plans`, `insert`, `update`, `delete` y `onConflict` en runtime, scripts, jobs y tests. La única inserción esperada es el seed de planes; cualquier DML runtime será CASO B.
2. Aplicar el REVOKE en una base de prueba o ejecutar el E2E completo posterior al REVOKE. La verificación debe confirmar que el runtime sigue funcionando y que `plans` conserva `SELECT`.
3. Si falla cualquier test, no aplicar el REVOKE en Neon. Se documentará el DML encontrado, se marcará CASO B y se mantendrá el estado actual de privileges.

Solo después de los dos guards exitosos se aplicará la migración en Neon usando una URL owner, verificando con `pg_catalog` que `app_user` conserva `SELECT` y no tiene `INSERT`, `UPDATE` ni `DELETE`.

## 4. Documentación y deuda

- `docs/superpowers/specs/2026-09-blueprint-v2.6.md`: usar los seis estados de la spec transversal, agregar `abandoned` y marcar Fase 1 como completada.
- `docs/superpowers/specs/2026-09-blueprint-v2.6.md`: eliminar el estado de arranque de Fase 1 y conservar la sección de cierre.
- `docs/adr/ADR-024-pgcrypto-tokens.md`: agregar `publicKey` e `isVerified` a la sección de schema y dejar explícito que están fuera del mínimo descrito originalmente.
- `bitacora.md`: decodificar el tramo UTF-16/NUL a UTF-8 preservando todo el contenido previo y agregando solo la entrada de cierre de Fase 1.
- `SETUP.md`: documentar las variables nuevas, la clave de cifrado y la configuración de Vercel.
- `docs/deuda-tecnica.md`: registrar los ítems 18–22 acordados, sin duplicar hallazgos existentes; los posibles ítems 23–25 se agregan después y no reemplazan los cinco primeros:
  - 18: `encryptToken` es UPDATE-only, no hace upsert; bloqueante de Fase 3.
  - 19: T11 en CI, solo si el skip es inevitable; documentar el bloqueo concreto.
  - 20: falta test del seed y de los datos de planes.
  - 21: `publicKey` e `isVerified` están fuera de ADR-024; actualizar el ADR.
  - 22: T12 se ajusta a DoD mock-only; el roundtrip real de DB queda como deuda de Fase 3.
  - 23: snapshots 0012/0013/0014 tienen `id`/`prevId` colisionados; la corrección requiere una tarea separada.
  - 24: se agrega solo si una verificación posterior confirma que admin usa owner; en esta verificación admin usa `app_user`, por lo que no se registra.

## 5. Issues

Se actualizarán los issues existentes o se abrirán referencias equivalentes para T11, T13, CASO A/Caso B de grants, drift de documentación y debt 18–22. El PR declarará explícitamente `Cierra parcialmente #112 (mock-only)` para T12. El roundtrip real de DB de T12 quedará registrado como deuda de Fase 3. Los issues se cerrarán solo después de la verificación correspondiente en CI y Neon.

## 6. Verificación y entrega

1. Ejecutar la prueba RLS contra `DATABASE_APP_URL` real y confirmar que falla antes de cualquier ajuste de implementación cuando corresponda.
2. Ejecutar los dos guards de grants y aplicar 0015 solo si ambos pasan.
3. El backup con `pg_dump` es obligatorio por defecto. Para esta ejecución, el humano autorizó una excepción: Paseo no dispone de `pg_dump`/`psql` y no permite instalarlos; se documentará que el REVOKE es reversible con `GRANT INSERT, UPDATE, DELETE ON plans TO app_user` y que no se ejecuta seed.
4. Confirmar el estado pre-migración con `DATABASE_URL` owner: deben existir `DELETE`, `INSERT`, `SELECT` y `UPDATE`; luego aplicar 0015 con `DATABASE_URL` owner.
5. Detener el proceso en un checkpoint humano antes de ejecutar `pnpm db:seed`. El seed solo se ejecuta si el humano lo aprueba explícitamente en ese checkpoint.
6. Verificar el guard de seed en entorno local aislado (no Neon):
   `NODE_ENV=production DATABASE_URL=postgresql://dummy pnpm db:seed`
   → debe fallar con el mensaje del guard. NO ejecutar contra Neon con `NODE_ENV=production`.
7. Ejecutar `pnpm lint`.
8. Ejecutar `pnpm typecheck`.
9. Ejecutar `pnpm test`.
10. Ejecutar `pnpm build`.
11. Revisar `git diff` y `git status`, haciendo stage solo de archivos explícitos.
12. Crear commit, push de la rama y PR contra `develop`, sin mergear.

## Criterios de aceptación

- `MP_TOKEN_ENCRYPTION_KEY` es required en todos los entornos y valida al menos 32 caracteres.
- Las variables platform están documentadas y pueden activarse en Fase 2.
- ADR-024 documenta `publicKey` e `isVerified` y aclara su inclusión fuera del mínimo original.
- T12 queda explícitamente como `Cierra parcialmente #112 (mock-only)`; el roundtrip real queda para Fase 3.
- T11 ejecuta una prueba real con `app_user` cuando existe `DATABASE_APP_URL`; no usa mocks tautológicos.
- El workflow E2E recibe `DATABASE_APP_URL` desde `secrets.NEON_DATABASE_APP_URL` del mismo Neon, nunca la URL owner; cualquier skip requiere confirmación humana y bloqueo documentado.
- La migración 0015 es append-only y solo aplica el REVOKE si los dos guards pasan.
- `plans` mantiene `SELECT` para runtime y pierde solo DML.
- La excepción de backup sin `pg_dump` está documentada y autorizada para esta ejecución; no se ejecuta `db:seed` contra Neon.
- El guard de seed en producción sigue bloqueando la ejecución antes de cualquier intento de seed; la verificación del guard se hace solo con `postgresql://dummy`.
- El caso 5 confirma `WITH CHECK` implícito; si el INSERT de B bajo contexto A pasa, el trabajo se detiene y se reporta como CRÍTICO.
- `gh secret list | grep -i NEON` se ejecuta antes de editar E2E; la ausencia de `NEON_DATABASE_APP_URL` impide editar el workflow hasta confirmación humana.
- Blueprint, hoja de ruta, bitácora, SETUP, ADR y debt quedan consistentes.
- No se imprimen ni versionan secretos.
- La rama queda lista para PR y no se modifica directamente `develop` ni `main`.
