---
name: rls-audit
description: Usar al auditar, agregar o revisar Row Level Security en landaetastudio-saas. Trigger - agregar una tabla de negocio, escribir una query, tocar withTenantContext, habilitar ENABLE/FORCE ROW LEVEL SECURITY, o depurar un tenant que ve datos de otro (0 filas o filas ajenas). Tambien al tocar roles de DB, DATABASE_APP_URL vs DATABASE_URL, o el tracking drizzle.__drizzle_migrations.
---

# Auditoria de RLS

## Modelo mental

RLS en este proyecto no es decorativo: es el unico aislamiento real entre tenants. Si una query escapa de `withTenantContext`, no falla con error, **devuelve cero filas**. Ese es el sintoma clasico y el mas peligroso porque parece un bug de datos.

Cadena de confianza, en orden:

1. `DATABASE_APP_URL` apunta a un rol con permisos reducidos, tipicamente `app_user`, que **no** tiene `rolbypassrls`.
2. `packages/db/src/index.ts` hace `throw` si `DATABASE_APP_URL` falta. No hay fallback silencioso a `DATABASE_URL`, y la razon es exactamente esta: el owner (`neondb_owner`) tiene `rolbypassrls=true` y anula todas las policies.
3. `withTenantContext(tenantId, callback)` abre una transaccion, ejecuta `SELECT set_tenant_id(${tenantId}::uuid)` como `SET LOCAL`, y pasa `tx` al callback.
4. Dentro del callback, toda query usa `tx.`, nunca `db.`.

## Techo de la trampa: return await

```ts
// Correcto
return await withTenantContext(tenantId, async (tx) => { ... })

// Trampa: la rejection de db.transaction se escapa del try/catch
return withTenantContext(tenantId, async (tx) => { ... })
```

`async function f() { return promiseRejected }` no dispara el `catch` de quien llama a `f()`. Un error de DB se convierte en un 500 sin log y sin pasar por el manejo de errores del handler. **Siempre `return await`.**

## Tablas globales sin RLS por diseno

No agregar RLS a estas. `admin_users` necesita login cross-tenant (NextAuth busca por email global), y las otras dos son la raiz del modelo.

| Tabla         | Por que queda fuera                                                  |
| ------------- | -------------------------------------------------------------------- |
| `tenants`     | Es la tabla raiz. El isolation se define por las tablas hijas.       |
| `admin_users` | Autenticacion cross-tenant. Sin esta excepcion el login no funciona. |
| `plans`       | Catalogo global de la plataforma, no pertenece a ningun tenant.      |

Cualquier otra tabla de negocio necesita columna `tenantId` **y** policy `tenant_isolation`.

## Checklist antes de aprobar ENABLE ROW LEVEL SECURITY

- [ ] La tabla tiene columna `tenantId`.
- [ ] Existe una policy `tenant_isolation` que referencia `tenantId`.
- [ ] La tabla no es una de las tres globales de la tabla de arriba.
- [ ] Si se agrega `FORCE ROW LEVEL SECURITY`, el owner (usado por migraciones y seed) sigue pudiendo leer/escribir. Verificar que el seed y `apply-all-migrations.ts` no se rompen.

Una tabla con `ENABLE RLS` pero sin policy es **fail-closed**: cero filas para todos, incluyendole al owner que pase por el rol correcto. Agregar `ENABLE` sin policy es peor que no agregar nada.

## Checklist al escribir una query

- [ ] Va dentro de `withTenantContext(tenantId, cb)`.
- [ ] Usa `tx.select()`, `tx.update()`, `tx.insert()`, `tx.delete()`.
- [ ] El handler hace `return await withTenantContext(...)`.
- [ ] El filtro por `tenantId` es explicito en el `where` **ademas** de la policy. La policy es la red de seguridad, no la implementacion.
- [ ] Si la query usa `IN (...)` sobre un array de IDs, hay un guard `array.length === 0` antes de construirla. PostgreSQL rechaza `IN ()` con error de sintaxis y eso es un 500.

## Checklist al testear un handler que usa withTenantContext

- [ ] No mockear `db.transaction`. `withTenantContext` cierra sobre el `db` real del modulo, no sobre la exportacion mockeada.
- [ ] Mockear `withTenantContext` directo:
  ```ts
  vi.mock('@repo/db', async () => ({ ...actual, withTenantContext: vi.fn() }))
  ```
- [ ] En `beforeEach`: `vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) => cb(makeTxMock()))`
- [ ] `makeTxMock()` (de `@repo/test-utils`) retorna `as any` para compatibilidad con `DbLike`.

## Suite de integracion real

`packages/db/src/__tests__/rls-cross-tenant.test.ts` prueba el aislamiento contra una DB real, no contra mocks. Los 8 casos son:

1. Contexto A no lee suscripciones de B
2. Contexto B no lee suscripciones de A
3. Contexto A no lee `tenant_mp_config` de B
4. Contexto B no lee `tenant_mp_config` de A
5. Rechaza INSERT de B bajo contexto A
6. UPDATE de B bajo contexto A no afecta filas
7. DELETE de B bajo contexto A no afecta filas
8. Sin `set_tenant_id`, una conexion nueva devuelve cero filas RLS

El caso 8 es el que mas se olvida: documenta que el aislamiento depende de que `set_tenant_id` se ejecute. Sin el SET LOCAL, no hay policy que matchee y RLS devuelve cero filas.

La suite se saltea sola si `DATABASE_APP_URL` no es usable (vacia, `localhost`, `127.0.0.1`, `dummy`). Si corre en CI y dice que paso, verificar que efectivamente se ejecutaron los 8 y no se saltearon.

## Correr la suite

```bash
pnpm vitest run packages/db/src/__tests__/rls-cross-tenant.test.ts
```

Necesita `DATABASE_APP_URL` apuntando a un rol sin BYPASSRLS y el schema migrado.

## Tracking de migraciones

El control canonico esta en `drizzle.__drizzle_migrations`, schema **`drizzle`**. drizzle-kit 0.31.x **no** lee `public.__drizzle_migrations`. Ese tracking obsoleto en `public` fue un artefacto inútil y provoco el sintoma opuesto: `pnpm db:migrate` respondia "Everything's fine" con migraciones pendientes. Si alguien consulta el estado de migraciones, tiene que ser contra el schema `drizzle`.

## Verificacion manual contra la DB

```sql
-- RLS realmente habilitado y forzado
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('subscriptions', 'tenant_mp_config');

-- El rol de la app NO debe tener bypass
SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_user';

-- Estado del tracking de migraciones
SELECT count(*) FROM drizzle.__drizzle_migrations;
```

`rolbypassrls = true` para el rol de la app significa que RLS no protege nada, sin importar cuantas policies existan.

## Diagnostico de "el tenant ve cero filas"

En orden:

1. La query usa `db.` en vez de `tx.` (o esta fuera del callback). Sintoma: cero filas.
2. Falta `FORCE ROW LEVEL SECURITY` y se esta conectando como owner. Sintoma: **ve todas las filas**, peor que cero.
3. `DATABASE_URL` (owner) se coló donde debia ir `DATABASE_APP_URL`. Sintoma: ve todas las filas.
4. La tabla quedo con `ENABLE RLS` y ninguna policy. Sintoma: cero filas para todos.
5. El array de IDs vacio genero `IN ()` y la exception se manifesto como otro error. Revisar el log del 500, no la query.
