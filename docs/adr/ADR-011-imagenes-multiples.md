# ADR-011: Imágenes múltiples con tabla product_images

**Fecha:** 2026-04-22
**Contexto:** Modelar imágenes de producto — múltiples imágenes por producto con ordenamiento.

## Decisión

La tabla `product_images` permite múltiples imágenes por producto, con soporte para galería, ordenamiento por `position` (integer) y eliminación individual. Usa R2 (MinIO en desarrollo) para almacenamiento. FK a `products` con `ON DELETE CASCADE`.

## Estado

**Aceptada**

- ✅ Schema: `packages/db/src/schema.ts:35-48` — `dbProductImages` con `id`, `productId`, `tenantId`, `url`, `alt`, `position`, `createdAt`
- ✅ API en `apps/admin/app/api/products/[id]/images/route.ts` (GET + POST)
- ✅ Delete en `apps/admin/app/api/products/[id]/images/[imageId]/route.ts`

## Consecuencias

- Las imágenes se suben vía FormData a R2 y se almacena la URL pública
- El orden de visualización se controla con `position`
- FK cascade elimina imágenes al eliminar el producto