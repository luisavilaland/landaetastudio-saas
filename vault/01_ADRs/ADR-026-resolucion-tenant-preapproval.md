# ADR-026: Resolucion de tenant por preapprovalId sin contexto

- **Estado**: Aceptado
- **Fecha**: 2026-10-06
- **Decide**: H1 de la auditoria mid-phase (#197), rama `chore/fix-h1-preapproval-tenant-resolution`

## Contexto

El webhook de suscripciones de MercadoPago recibe eventos que traen un
`mpPreapprovalId` y nada que identifique al tenant. Para procesar el evento
necesita el `tenantId`, y con el `tenantId` abre `withTenantContext`.

Eso es un chicken-and-egg: el tenant es justamente lo que hay que buscar, asi que
no se puede abrir un contexto de tenant para buscarlo.

La estrategia L (local) existia para evitar llamar a MP: consultar
`subscriptions` por `mpPreapprovalId`, que tiene un indice unico parcial
(`subscriptions_mp_preapproval_idx`, de T1). El codigo justificaba la consulta
diciendo que era segura porque el filtro es un indice unico, o sea "por
definicion de un solo tenant".

**Ese razonamiento era falso, y el defecto no era de seguridad sino de
funcionalidad: la consulta nunca podia devolver nada.**

`subscriptions` tiene `FORCE ROW LEVEL SECURITY`, y su policy es:

```sql
USING ("tenantId" = current_setting('app.tenant_id', true)::UUID)
```

El rol de la app (`app_user`, via `DATABASE_APP_URL`) tiene `rolbypassrls = false`,
y `FORCE ROW LEVEL SECURITY` descarta el bypass del owner. Sin `app.tenant_id`,
`current_setting(..., true)` devuelve NULL, el predicado evalua a NULL en vez de
TRUE, y RLS rechaza la fila. La estrategia L era codigo muerto y el indice de T1
no se usaba nunca.

### El sintoma tiene dos caras, y la documentada no era la de produccion

El mecanismo falla siempre, pero **como** falla depende del estado de la sesion,
y eso no estaba aislado. Lo modelamos como "devuelve 0 filas":

1. **Sesion virgen** (nunca paso por `set_tenant_id`): `current_setting` devuelve
   NULL, el predicado es NULL, la query devuelve **0 filas en silencio**.
2. **Sesion tibia** (ya paso por `withTenantContext`, que hace
   `set_config('app.tenant_id', ..., true)`): al revertir el SET LOCAL, el GUC
   vuelve a `''` en lugar de desaparecer. `''::uuid` **revienta con 22P02**
   (`invalid input syntax for type uuid: ""`).

El webhook corre sobre el pool `db` compartido, que se calienta con cada
`withTenantContext` de toda la app. O sea: en produccion domina el caso 2, y el
sintoma real es una **excepcion, no un cero silencioso**. "Perdida silenciosa" era
la lectura optimista; la lectura correcta es "500 en el webhook, con MP
reintentando".

## Decision

Una funcion PostgreSQL `SECURITY DEFINER` acotada a exponer el `tenantId`:

```sql
CREATE OR REPLACE FUNCTION resolve_tenant_by_preapproval(preapproval_id TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT "tenantId"
  FROM subscriptions
  WHERE "mpPreapprovalId" = preapproval_id
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION resolve_tenant_by_preapproval(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant_by_preapproval(TEXT) TO app_user;
```

El handler la invoca con `db.execute(sql\`SELECT resolve_tenant_by_preapproval(...)\`)`,
que corre como `neondb_owner`.

### Por que funciona

`FORCE ROW LEVEL SECURITY` aplica al owner de la tabla, pero un rol con el
atributo `BYPASSRLS` bypasea RLS siempre. En este proyecto el owner de
`subscriptions` es `neondb_owner` y tiene `rolbypassrls = true` (verificado), y
las migraciones corren como ese rol (`DATABASE_URL`). Por eso la funcion creada
por la migracion bypasea RLS.

### Por que esta acotada

- Retorna **un escalar `uuid`**, no un record. No hay forma de leer filas ni
  otras columnas desde la funcion.
- Acepta **solo** un `mpPreapprovalId` y devuelve **solo** su `tenantId`. No es un
  bypass de proposito general: no enumera tenants, no filtra por tenant.
- `REVOKE ... FROM PUBLIC` es obligatorio: PostgreSQL otorga `EXECUTE` sobre las
  funciones a `PUBLIC` por defecto. Sin ese REVOKE, cualquier rol conectado
  podria resolver el tenant de cualquier preapproval.
- `SET search_path = public, pg_temp` fija el search_path (el de la sesion era
  `"$user", public`) y deja `pg_temp` al final, que es el patron recomendado
  para funciones `SECURITY DEFINER`.
- `LIMIT 1` garantiza una sola fila aunque el indice se degrade.

## Alternativas consideradas

- **Rol de servicio con `BYPASSRLS`.** Descartada: el rol puede leer toda la
  tabla, no solo la columna necesaria. Superficie de exposicion mas grande,
  gestacion de credenciales aparte y mas complejidad de setup para lo mismo.
- **Policy `SELECT` abierta sobre `subscriptions`.** Descartada: expone la tabla
  completa a `app_user`. Reemplaza un defecto de funcionalidad por una fuga de
  datos entre tenants.
- **Dejar la estrategia R siempre.** Descartada: el indice de T1 no se usaria,
  cada evento paga un GET a MP de mas, y si MP esta caido el evento queda en
  `tenant_unresolved` con 200. El fallo de MP se vuelve fallo de procesamiento.
- **`SET row_security = off` en la sesion.** Descartada: es un bypass global, no
  acotado, y no se puede activar sin `BYPASSRLS`.

## Consecuencias

- La estrategia L funciona: una query local indexada en lugar de un GET a MP.
- `subscriptions_mp_preapproval_idx` (T1) pasa a usarse de verdad.
- Con L activa hay **un solo** GET a MP por evento de preapproval (la lectura de
  status para decidir la transicion), en lugar de dos. El segundo queda acotado al
  fallback R.
- El fallo de MP deja de ser un fallo de procesamiento.
- La funcion es un escape hatch real y por lo tanto deuda de seguridad viva: si
  alguien le agrega mas salidas, o le saca el `REVOKE`, H1 vuelve a abrirse. Los
  tests 4 y 5 de `preapproval-tenant-resolution.test.ts` existen para que eso
  falle visible.
- Sigue siendo chicken-and-egg: **cualquier** lookup de bootstrap que necesite
  resolver el tenant antes de tener contexto va a necesitar un escape hatch
  parecido. Este es el patron, no una excepcion.

## Referencias

- Auditoria mid-phase de Fase 2 (T1-T5), PR #197, hallazgo H1.
- Spike T0, PR #188 (forma verificada de los payloads de MP).
- Migracion `0002_resolve_tenant_by_preapproval.sql`.
- Tests: `packages/db/src/__tests__/preapproval-tenant-resolution.test.ts` (6
  casos contra Neon real) y los casos `H1` de
  `apps/admin/app/api/webhooks/mercadopago/subscriptions/__tests__/handler.test.ts`.
- RLS y `withTenantContext`: `0000_baseline.sql` (policy `tenant_isolation`,
  `FORCE ROW LEVEL SECURITY`, `set_tenant_id`).
