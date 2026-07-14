# ADR-022: Estado real de Row Level Security

**Fecha:** 2026-07-10
**Contexto:** Auditoría de seguridad post-producción (P0 hotfixes de tenant isolation).

## Hallazgo

RLS está definido en migraciones de base de datos con políticas `tenant_isolation`, pero:

- `withTenantContext` **nunca se llama** en ningún handler de API.
- La conexión a la base de datos usa `neondb_owner` (rol owner de tabla) que bypasses RLS automáticamente.
- PostgreSQL solo evalúa RLS para roles que no son owner de la tabla.
- Por lo tanto, RLS es **puramente decorativo** — la seguridad multi-tenant depende 100% de filtrado manual `WHERE tenantId = ?`.

## Verificación de logs

Se revisaron los logs de Vercel (storefront, admin, superadmin) durante la auditoría. **No se encontró evidencia de tráfico a las rutas vulnerables**, consistente con no tener aún tenants/usuarios reales en producción. No se detectaron accesos cross-tenant ni intentos de explotación.

## Decisión

1. **No activar `FORCE ROW LEVEL SECURITY`** hasta que `withTenantContext` esté implementado en todos los handlers que tocan tablas de negocio. Activarlo ahora rompería todas las queries existentes.
2. Los P0 hotfixes cierran los 12 gaps de filtrado manual encontrados en la auditoría.
3. `withTenantContext` debe usar `db.transaction` internamente con `tx` pasado al callback — el SET LOCAL en auto-commit se pierde antes de las queries del callback.

## Estado

- ✅ Filtrado manual `tenantId` en los 12 handlers con gaps (hotfixes 1–9)
- ✅ Plan P1-1 diseñado: `withTenantContext` con `db.transaction` + `tx` callback. Ejecución en 4 PRs.
- ❌ `withTenantContext` sin implementar en runtime (PR2 + PR3)
- ❌ RLS decorativo, sin efecto real
- ⏳ **Pendiente:** PR1 (CI con tests) → PR2 (18 handlers Patrón A) → PR3 (5 handlers Patrón B, transacción angosta) → validación contra Neon branch → PR4 (FORCE RLS)
