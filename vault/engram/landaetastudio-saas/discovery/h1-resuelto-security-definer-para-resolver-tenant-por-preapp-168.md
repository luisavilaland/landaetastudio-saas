---
id: 168
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 15:35:49"
updated_at: "2026-10-06 15:35:49"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "H1 resuelto: SECURITY DEFINER para resolver tenant por preapprovalId"
---

# H1 resuelto: SECURITY DEFINER para resolver tenant por preapprovalId

**What**: H1 de la auditoria mid-phase (#197) resuelto con una funcion `SECURITY DEFINER` acotada, `resolve_tenant_by_preapproval(preapproval_id TEXT) RETURNS UUID`, en la migracion `0002_resolve_tenant_by_preapproval.sql`. El handler la invoca con `db.execute(sql\`SELECT resolve_tenant_by_preapproval(...)\`)` en lugar de consultar `subscriptions` con `db` directo.

**Why**: `withTenantContextByPreapproval` resolvia el tenant sobre `subscriptions`, que tiene `FORCE ROW LEVEL SECURITY`, fuera de todo contexto de tenant. Sin `app.tenant_id` el predicado `tenantId = current_setting('app.tenant_id', true)::UUID` nunca es TRUE, asi que la query no podia devolver nada: la estrategia L era codigo muerto y el indice `subscriptions_mp_preapproval_idx` (de T1) no se usaba nunca. Todo caia en la estrategia R.

**Where**: `packages/db/migrations/0002_resolve_tenant_by_preapproval.sql` (nueva), `packages/db/migrations/meta/_journal.json` (idx=2), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`withTenantContextByPreapproval` -> `resolveTenantIdByPreapproval`), `packages/db/src/__tests__/preapproval-tenant-resolution.test.ts` (nuevo, 6 casos contra Neon real), `vault/01_ADRs/ADR-026-resolucion-tenant-preapproval.md`.

**Learned**:
- El defecto NO era de seguridad sino de funcionalidad. El codigo lo justificaba como "es seguro porque el filtro es el indice unico parcial"; el razonamiento era falso y la consulta nunca podia devolver nada.
- El sintoma tiene DOS caras y la documentada no era la de produccion. Sesion virgen: `current_setting` devuelve NULL, predicado NULL, 0 filas en silencio. Sesion tibia (ya paso por `withTenantContext`, que hace SET LOCAL): al revertirse el GUC vuelve a `''` en vez de desaparecer, y `''::uuid` revienta con **22P02**. El webhook corre sobre el pool `db` compartido, calentado por toda la app, asi que en produccion domina la excepcion, no el cero silencioso.
- `FORCE ROW LEVEL SECURITY` aplica al owner de la tabla, pero un rol con `BYPASSRLS` bypasea siempre. En este proyecto el owner de `subscriptions` es `neondb_owner` con `rolbypassrls = true`, y las migraciones corren como ese rol, asi que la funcion creada por la migracion bypasea RLS.
- `REVOKE ALL ... FROM PUBLIC` es obligatorio: PostgreSQL otorga `EXECUTE` sobre las funciones a PUBLIC por defecto.
- El bypass es de la FUNCION, no de la tabla: un SELECT directo desde el contexto de otro tenant sigue devolviendo 0 filas. Verificado en test.
- De 162 archivos, 21 usan `db.<mutacion>()` directo, y este era el UNICO que tocaba una tabla con FORCE RLS fuera de contexto. Los demas tocan `tenants` o `admin_users` (sin RLS) o ya usan `withTenantContext`.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
