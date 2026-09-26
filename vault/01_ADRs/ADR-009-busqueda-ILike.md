# ADR-009: Búsqueda server-side con ILIKE

**Fecha:** 2026-04-22
**Contexto:** Elegir estrategia de búsqueda de productos para el MVP. Alternativas: ILIKE en PostgreSQL vs motor externo (Meilisearch, Algolia, Elasticsearch).

## Decisión

Usamos ILIKE de PostgreSQL en lugar de un motor de búsqueda externo. Esto simplifica la arquitectura, no añade dependencias adicionales y es suficiente para el MVP con un catálogo pequeño/medio. La búsqueda se aplica sobre `name`, `description` y `sku` de productos/variantes.

## Estado

**Aceptada**

- ✅ `apps/storefront/app/api/search/route.ts` usa `ilike` de drizzle-orm
- ✅ `apps/storefront/app/buscar/search-results.tsx` usa el mismo patrón
- ✅ Tests verifican comportamiento ILIKE en `apps/storefront/app/api/search/__tests__/route.test.ts`

## Consecuencias

- Sin dependencia externa de búsqueda — menos costos operativos
- Rendimiento aceptable para catálogos de hasta miles de productos
- Migrar a un motor de búsqueda externo en el futuro es un cambio localizado en los queries
