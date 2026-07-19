# ADR-020: Normalización de slugs

**Fecha:** 2026-05-15
**Contexto:** Asegurar que todos los slugs de productos y categorías sigan un formato consistente para URLs amigables y evitar duplicados.

## Decisión

Se implementó la función `normalizeSlug()` en `@repo/validation/src/utils.ts` que convierte a minúsculas, elimina acentos, reemplaza espacios por guiones, y limpia guiones duplicados o en extremos. Se aplica tanto en creación como en edición. La centralización en `@repo/validation` garantiza que toda la API use el mismo criterio.

## Estado

**Aceptada — ver discrepancia**

- ✅ `normalizeSlug()` definida en `packages/validation/src/utils.ts:10`
- ✅ Reexportada en `packages/validation/src/index.ts`
- ✅ 10 tests unitarios en `packages/validation/src/__tests__/utils.test.ts`
- ✅ Usada en create/edit de categories y products
- ⚠️ `apps/admin/app/api/products/import/route.ts:27` tiene una copia local duplicada de `normalizeSlug()` en lugar de importar desde `@repo/validation` — pendiente de migración

## Consecuencias

- URLs consistentes y SEO-friendly
- Un solo punto de cambio para la lógica de normalización
- La copia local en CSV import es deuda técnica identificada