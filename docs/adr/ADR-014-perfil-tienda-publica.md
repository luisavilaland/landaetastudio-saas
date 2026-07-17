# ADR-014: Página de perfil de tienda pública

**Fecha:** 2026-05-15
**Contexto:** Proveer una presencia web pública única para cada comercio con información de la tienda.

## Decisión

La página `/perfil` es un Server Component que expone la información del tenant (nombre, logo, descripción, contacto, categorías) con metadatos SEO (JSON-LD con schema de Store). El proxy multi-tenant resuelve el tenant automáticamente por subdominio o dominio personalizado.

## Estado

**Aceptada**

- ✅ Server Component en `apps/storefront/app/perfil/page.tsx` (sin `'use client'`)
- ✅ `generateMetadata()` para SEO
- ✅ JSON-LD embedded con schema de Store
- ✅ Test en `apps/storefront/app/perfil/__tests__/page.test.ts`

## Consecuencias

- Cada tenant tiene presencia pública sin configuración adicional
- SEO mejorado con datos estructurados
- Sin dependencia de CMS externo