# ADR-019: Centralización de lógica de negocio en @repo/commerce

**Fecha:** 2026-05-15
**Contexto:** Originalmente la lógica de carrito, productos, emails y resolución de tenant estaba en `apps/storefront/lib/`. Esto representaba deuda técnica al no haber ubicación clara para nueva lógica compartida.

## Decisión

Se creó `packages/commerce` moviendo toda la lógica de negocio de storefront hacia este paquete centralizado. Las apps ahora importan desde `@repo/commerce` (a veces mediante re-export en `@/lib/`). Los módulos incluyen cart, categories, email, products, redis, y tenant.

## Estado

**Aceptada**

- ✅ Módulos en `packages/commerce/src/`: `cart.ts`, `categories.ts`, `email.ts`, `products.ts`, `redis.ts`, `tenant.ts`
- ✅ Barrel export en `index.ts`
- ✅ Storefront reexporta desde `@/lib/` → `@repo/commerce/*`
- ✅ Tests en `packages/commerce/src/__tests__/categories.test.ts`

## Consecuencias

- La lógica de negocio es compartible entre apps
- Storefront podría migrar a importar directamente desde `@repo/commerce` sin la capa `@/lib/` (refactor menor)
- Nuevas funcionalidades de negocio tienen una ubicación clara
