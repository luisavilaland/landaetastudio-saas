# ADR-001: Multi-tenant con columna tenantId

**Fecha:** 2026-04-22
**Contexto:** Elegir el modelo de aislamiento multi-tenant para el SaaS. Alternativas consideradas: bases de datos separadas por tenant, esquemas separados, o columna compartida con tenantId.

## Decisión

Usamos una única base de datos compartida con columna `tenantId` en todas las tablas de negocio. Esto simplifica la gestión de datos y las migraciones. El aislamiento se implementa mediante Row Level Security (RLS) con políticas `tenant_isolation` que evalúan `tenantId = current_setting('app.tenant_id')::UUID`.

La conexión runtime usa un rol de aplicación (`app_user`) sin atributo `BYPASSRLS`, creado explícitamente para que RLS tenga efecto real. Las migraciones y seed usan `neondb_owner` (con BYPASSRLS, necesario para DDL).

El helper `withTenantContext(tenantId, callback(tx))` abre una transacción, ejecuta `SELECT set_tenant_id(tenantId)` (SET LOCAL transaction-scoped), y pasa `tx` al callback. Toda query contra tablas de negocio debe ejecutarse dentro de este callback.

## Estado

**Aceptada — ver discrepancia**

- ✅ Tablas con tenantId en schema de Drizzle
- ✅ withTenantContext implementado con db.transaction + SET LOCAL
- ✅ 27 handlers wireados (21 Patrón A + 5 Patrón B + checkout)
- ✅ FORCE RLS activo en 8 tablas de negocio
- ✅ app_user con rolbypassrls=false en producción
- ⚠️ checkout/route.ts quedó fuera de PR2/PR3. Hotfix aplicado el 2026-07-16 (commit 121a1a8)

## Consecuencias

- Toda query de negocio debe pasar por `withTenantContext` — no se puede usar `db` directamente
- Las migraciones deben otorgar permisos explícitos a `app_user` para cada tabla nueva
- `admin_users` no tiene RLS por diseño: el login de NextAuth necesita buscar por email globalmente
