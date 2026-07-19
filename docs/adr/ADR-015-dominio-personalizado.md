# ADR-015: Dominio personalizado con verificación

**Fecha:** 2026-05-15
**Contexto:** Permitir que cada tenant configure su propio dominio (ej. `tienda.com`) para la tienda.

## Decisión

Cada tenant puede configurar un dominio personalizado guardado en el campo `customDomain` (UNIQUE). La verificación se hace vía API pública (`/api/domain-check` en admin y superadmin). El proxy (`middleware.ts`) resuelve el tenant tanto por subdominio como por dominio personalizado, ofreciendo flexibilidad total para comercios que ya tienen su propio dominio.

## Estado

**Aceptada**

- ✅ `customDomain: text("customDomain").unique()` en schema de tenants
- ✅ Schema Zod: `customDomainSchema` en `packages/validation/src/schemas.ts:88`
- ✅ Domain check en `apps/superadmin/app/api/domain-check/route.ts` y `apps/admin/app/api/domain-check/route.ts`
- ✅ Proxy resuelve por `customDomain` y subdominio
- ✅ Tests de proxy en `apps/storefront/__tests__/proxy.test.ts`

## Consecuencias

- El tenant puede usar su marca sin depender de subdominios de la plataforma
- La verificación evita conflictos entre tenants por el mismo dominio
- El proxy maneja resolución tanto por subdominio como por dominio personalizado