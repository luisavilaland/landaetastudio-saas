-- H1 (auditoria mid-phase #197): resolver el tenant desde un mpPreapprovalId
-- sin depender de un contexto de tenant.
--
-- El problema es un chicken-and-egg: el webhook de suscripciones necesita el
-- tenantId para abrir withTenantContext, asi que no puede usar el contexto para
-- buscarlo. La tabla subscriptions tiene FORCE ROW LEVEL SECURITY y su policy
-- compara contra current_setting('app.tenant_id', true)::UUID. Sin el setting el
-- lookup falla siempre, y falla de dos formas segun el estado de la sesion:
--
--   - sesion virgen      -> current_setting devuelve NULL -> predicado NULL
--                           -> 0 filas, en silencio.
--   - sesion ya usada por withTenantContext (SET LOCAL) -> el GUC vuelve a ''
--                           -> ''::UUID -> error 22P02.
--
-- La funcion es el escape hatch acotado: corre como neondb_owner, que tiene
-- BYPASSRLS (FORCE RLS si aplica al owner de la tabla, pero BYPASSRLS siempre
-- gana), y devuelve UNICAMENTE el tenantId de un preapprovalId. No expone filas
-- ni otras columnas, asi que no es un bypass de RLS de proposito general.

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
--> statement-breakpoint
-- PostgreSQL otorga EXECUTE sobre las funciones a PUBLIC por defecto. Sin este
-- REVOKE, cualquier rol conectado podria enumerar tenants por preapprovalId.
REVOKE ALL ON FUNCTION resolve_tenant_by_preapproval(TEXT) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolve_tenant_by_preapproval(TEXT) TO app_user;