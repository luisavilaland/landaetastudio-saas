# Decisiones de arquitectura – saas-ecommerce

**Última revisión: 2026-09-17**

Este documento indexa las Decisiones de Arquitectura (ADR) del proyecto. Cada ADR está documentada individualmente en `vault/01_ADRs/`.

## ADRs

| ADR                                                            | Título                                                | Estado                      |
| -------------------------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| [ADR-001](../01_ADRs/ADR-001-multi-tenant-columna-tenantid.md) | Multi-tenant con columna tenantId                     | Aceptada — ver discrepancia |
| [ADR-002](../01_ADRs/ADR-002-nextauth-jwt.md)                  | NextAuth con JWT                                      | Aceptada                    |
| [ADR-003](../01_ADRs/ADR-003-precios-centavos-integer.md)      | Precios en centavos (integer)                         | Aceptada                    |
| [ADR-004](../01_ADRs/ADR-004-r2-mercadopago.md)                | R2 (Cloudflare) y MercadoPago                         | Aceptada                    |
| [ADR-005](../01_ADRs/ADR-005-redis-carrito.md)                 | Redis para el carrito                                 | Aceptada                    |
| [ADR-006](../01_ADRs/ADR-006-no-medusajs.md)                   | No usar MedusaJS                                      | Aceptada                    |
| [ADR-007](../01_ADRs/ADR-007-estructura-monorepo.md)           | Estructura de monorepo                                | Aceptada — ver discrepancia |
| [ADR-008](../01_ADRs/ADR-008-validacion-zod.md)                | Validación con Zod en toda la API                     | Aceptada — ver discrepancia |
| [ADR-009](../01_ADRs/ADR-009-busqueda-ILike.md)                | Búsqueda server-side con ILIKE                        | Aceptada                    |
| [ADR-010](../01_ADRs/ADR-010-variantes-jsonb.md)               | Variantes con JSONB                                   | Aceptada                    |
| [ADR-011](../01_ADRs/ADR-011-imagenes-multiples.md)            | Imágenes múltiples con tabla product_images           | Aceptada                    |
| [ADR-012](../01_ADRs/ADR-012-metodos-envio-configurables.md)   | Métodos de envío configurables por tenant             | Aceptada                    |
| [ADR-013](../01_ADRs/ADR-013-configuracion-visual-tenant.md)   | Configuración visual del tenant                       | Aceptada — ver discrepancia |
| [ADR-014](../01_ADRs/ADR-014-perfil-tienda-publica.md)         | Página de perfil de tienda pública                    | Aceptada                    |
| [ADR-015](../01_ADRs/ADR-015-dominio-personalizado.md)         | Dominio personalizado con verificación                | Aceptada                    |
| [ADR-016](../01_ADRs/ADR-016-nextresponse.md)                  | NextResponse en lugar de new Response()               | Aceptada                    |
| [ADR-017](../01_ADRs/ADR-017-tests-logica-pura.md)             | Tests de "lógica pura" para endpoints                 | Aceptada — ver discrepancia |
| [ADR-018](../01_ADRs/ADR-018-consolidacion-nextauth.md)        | Consolidación de NextAuth en @repo/auth               | Aceptada                    |
| [ADR-019](../01_ADRs/ADR-019-logica-negocio-commerce.md)       | Centralización de lógica de negocio en @repo/commerce | Aceptada                    |
| [ADR-020](../01_ADRs/ADR-020-normalizacion-slugs.md)           | Normalización de slugs                                | Aceptada — ver discrepancia |
| [ADR-021](../01_ADRs/ADR-021-placeholder.md)                   | Gap de numeración (no emitido)                        | —                           |
| [ADR-022](../01_ADRs/ADR-022-rls-status.md)                    | Estado de RLS (decorativo → activo con app_user)      | Aceptada — actualizada      |
| [ADR-023](../01_ADRs/ADR-023-dos-flujos-mp.md)                 | Dos flujos MP independientes (plataforma vs tenant)   | Aceptada                    |
| [ADR-024](../01_ADRs/ADR-024-pgcrypto-tokens.md)               | Cifrado de tokens con pgcrypto + clave en env var     | Aceptada                    |
| [ADR-025](../01_ADRs/ADR-025-plantillas-composiciones.md)      | Sistema de plantillas intercambiables (composiciones) | Aceptada                    |

## Blueprint vigente

- **Blueprint v2.6:** `docs/superpowers/specs/2026-09-blueprint-v2.6.md` — plan completo 10 fases (pre-lanzamiento)

## Convenciones clave

- **Nombres en camelCase** para columnas y tablas en Drizzle.
- **Migraciones inmutables**: una vez generadas, no se editan.
- **Carrito anónimo en Redis**: 7 días TTL.
- **Validación Zod**: toda la API usa schemas de `@repo/validation`.
- **Búsqueda**: ILIKE en PostgreSQL.
- **return await con withTenantContext**: siempre usar `return await withTenantContext(...)`, nunca `return withTenantContext(...)`.
- **DATABASE_APP_URL obligatorio**: sin fallback silencioso a DATABASE_URL.
- **Precios siempre en centavos**: integer en DB, dividir/100 solo en frontend.
- **IDs**: UUIDs nativos de PostgreSQL (`gen_random_uuid()`).
- **Sentry condicional**: activo solo si SENTRY_DSN está configurado (`@sentry/nextjs` en las 3 apps, condicional en next.config.mjs).
- **Logs con @repo/logger (completo)**: 0 instancias de `console.*` en `apps/` (barrido completo). Excepción intencional: `packages/db/seed.ts` (script CLI) y `packages/validation/src/env.ts` (validación de boot). Convención vigente para código nuevo.
