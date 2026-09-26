# ADR-008: Validación con Zod en toda la API

**Fecha:** 2026-04-22
**Contexto:** Elegir biblioteca y estrategia de validación para los endpoints de la API.

## Decisión

Usamos Zod para validar todos los endpoints porque ofrece tipos TypeScript automáticos, errores estructurados y consistencia en toda la API. Los schemas se definen en `@repo/validation` y se reutilizan en múltiples endpoints. Cada handler usa `safeParse()` con los schemas definidos centralizadamente.

## Estado

**Aceptada — ver discrepancia**

- ✅ 18 schemas definidos en `packages/validation/src/schemas.ts`
- ✅ 16+ endpoints usan `safeParse()` desde `@repo/validation`
- ⚠️ `storeSettingsSchema` está definido localmente en `apps/admin/app/api/config/settings/route.ts:9` en lugar de importarse desde `@repo/validation`
- ⚠️ CSV import (`apps/admin/app/api/products/import/route.ts`) parsea manualmente sin Zod — heredado del prototipo inicial, pendiente de migración

## Consecuencias

- Los schemas son la fuente de verdad para tipos y validación
- El frontend puede reutilizar los mismos schemas (via `@repo/validation`)
- Schemas locales y endpoints sin Zod son deuda técnica identificada
