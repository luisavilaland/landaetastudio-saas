# ADR-004: R2 (Cloudflare) y MercadoPago

**Fecha:** 2026-04-22
**Contexto:** Elegir servicios externos para storage de imágenes y procesamiento de pagos.

## Decisión

Usamos Cloudflare R2 para almacenamiento de imágenes (S3-compatible, sin cargos de egress). En desarrollo se usa MinIO local como alternativa mediante fallback condicional. MercadoPago es el gateway de pago, por ser el más extendido en Uruguay y Argentina.

## Estado

**Aceptada**

- ✅ `packages/storage/src/index.ts` con soporte R2 + fallback MinIO
- ✅ `apps/storefront/app/api/checkout/preference/route.ts` usa `MERCADOPAGO_ACCESS_TOKEN`
- ✅ Webhook en `apps/storefront/app/api/webhooks/mercadopago/route.ts` con verificación de firma HMAC
- ✅ Variables validadas por Zod en `packages/validation/src/env.ts`

## Consecuencias

- Ambos servicios tienen fallback null si faltan credenciales (principio de progresividad)
- R2 es compatible con S3, misma interfaz que MinIO
- MercadoPago en modo sandbox para desarrollo, binary_mode para simplificar flujo
