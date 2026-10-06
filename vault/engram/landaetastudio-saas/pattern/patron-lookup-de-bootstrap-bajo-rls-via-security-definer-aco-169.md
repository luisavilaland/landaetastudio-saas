---
id: 169
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 15:36:24"
updated_at: "2026-10-06 15:36:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Patron: lookup de bootstrap bajo RLS via SECURITY DEFINER acotada"
---

# Patron: lookup de bootstrap bajo RLS via SECURITY DEFINER acotada

**What**: Cuando RLS bloquea un lookup de bootstrap (el tenant es justamente lo que hay que resolver, asi que no se puede abrir contexto de tenant para buscarlo), una funcion `SECURITY DEFINER` acotada es mas segura y mas chica que un `BYPASSRLS` global. Patron aplicado en H1 con `resolve_tenant_by_preapproval`.

**Why**: El rol de servicio con `BYPASSRLS` puede leer la tabla entera, no solo la columna necesaria. Una funcion que retorna un escalar y acepta un solo argumento expone exactamente una cosa, y su superficie se puede testear como contrato.

**Where**: `packages/db/migrations/0002_resolve_tenant_by_preapproval.sql`, `packages/db/src/__tests__/preapproval-tenant-resolution.test.ts`, `vault/01_ADRs/ADR-026-resolucion-tenant-preapproval.md`, deuda item 56.

**Learned**: Checklist para una funcion `SECURITY DEFINER` en este schema:
1. `RETURNS` un escalar, nunca `TABLE`/`SETOF`. Un record deja filtrar filas enteras.
2. `SET search_path = <esquemas de confianza>, pg_temp`. El de la sesion era `"$user", public`; `pg_temp` va **ultimo** para que un esquema temporal no resuelva primero.
3. `REVOKE ALL ... FROM PUBLIC` **siempre**: PostgreSQL otorga `EXECUTE` sobre funciones a PUBLIC por defecto.
4. `GRANT EXECUTE` solo al rol que la usa.
5. `LIMIT 1` para garantizar una sola fila.
6. Verificar que el owner tenga `BYPASSRLS`: `FORCE ROW LEVEL SECURITY` aplica al owner de la tabla, pero `BYPASSRLS` bypasea siempre. Sin eso la funcion no bypasea nada.
7. Fijar el contrato con tests: `prosecdef`, `prorettype`, `pronargs`, `proconfig`, columnas de `SELECT *`, y que `PUBLIC` no tenga `EXECUTE`. Sin eso, agregar una salida mas a la funcion es una fuga cross-tenant silenciosa.
8. `STABLE` si es solo lectura, para que el planner pueda inlinearla.

El chicken-and-egg no es una excepcion: **cualquier** lookup de bootstrap que deba resolver el tenant antes de tener contexto va a necesitar este patron. Es deuda de seguridad permanente, por eso el item 56.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
