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
- ✅ `withTenantContext` implementado en runtime (PR2 + PR3)
- ✅ FORCE ROW LEVEL SECURITY activo en las 8 tablas de negocio (migración 0010) — aplica incluso al owner de tabla
- ⏳ **Pendiente (histórico):** la auditoría de "accesos directos fuera de withTenantContext" con grep de una línea dio 0 matches sobre `seed.ts` porque no matchea queries multilínea (`db` / `.select()` / `.from()`). Ese resultado fue la "herramienta rota" que se corrigió el 2026-08-08; reveló 9 Server Components en runtime leyendo tablas con RLS sin `withTenantContext` (incidente de paneles vacíos + 500 en /buscar, ver bitacora) — ya corregidos (rama `develop`).

## Estado actualizado (2026-08-08)

- ✅ RLS activo y forzado en producción (migraciones 0009 + 0010, commit `3b2d77c` del 2026-07-29)
- ✅ `app_user` (rol de runtime) sin `rolbypassrls` → RLS se aplica en producción
- ✅ Páginas de admin/storefront que consultaban tablas con RLS sin contexto: corregidas (9 archivos) — 2026-08-08, ver bitacora
- ⚠️ **Lección de auditoría:** los greps de acceso directo a `db` deben usar patrones multilínea (`\.from\(db\w+\)`) y cubrir `db.execute(sql...)` y `db.query.*`; los patrones de una línea producen falsos negativos
