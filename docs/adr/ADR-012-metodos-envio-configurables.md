# ADR-012: Métodos de envío configurables por tenant

**Fecha:** 2026-04-22
**Contexto:** Permitir que cada comercio configure sus propias opciones de envío.

## Decisión

Implementamos los métodos de envío como una tabla independiente (`shipping_methods`) vinculada a `tenantId`. Cada tenant configura sus propias opciones (estándar, express, retiro en tienda) con precios, descripciones, umbral de envío gratis y ordenamiento. La validación Zod en `@repo/validation` asegura consistencia en la API.

## Estado

**Aceptada**

- ✅ Schema: `packages/db/src/schema.ts:187-204` — `dbShippingMethods` con `tenantId`, `name`, `description`, `price`, `freeShippingThreshold`, `isActive`, `sortOrder`, etc.
- ✅ Schemas Zod: `createShippingMethodSchema`, `updateShippingMethodSchema` en `packages/validation/src/schemas.ts:130-141`
- ✅ CRUD admin en `apps/admin/app/api/shipping/` y `[id]/`
- ✅ GET público en `apps/storefront/app/api/shipping/route.ts`
- ✅ Cálculo dinámico en checkout con selector visual

## Consecuencias

- Cada tenant tiene control total sobre sus métodos de envío
- El checkout calcula costo dinámicamente basado en el método seleccionado
- Umbral de envío gratis configurable por método
