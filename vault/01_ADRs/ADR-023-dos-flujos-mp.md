# ADR-023: Dos flujos de MercadoPago independientes (plataforma vs tenant)

**Fecha:** 2026-09-17
**Autor:** Equipo LandaetaStudio
**Estado:** Aceptado

## Contexto

El blueprint v2.6 define que la plataforma SaaS cobra la suscripción mensual a los tenants, mientras que cada tenant cobra a sus propios clientes finales. Esto requiere dos flujos de pago completamente separados:

1. **Suscripciones (plataforma → tenant):** La plataforma cobra UYU 2.000/4.000/8.000 mensuales usando nuestra propia cuenta de MercadoPago.
2. **Órdenes de tienda (tenant → cliente final):** Cada tenant usa su propia cuenta de MercadoPago para cobrar a sus clientes.

Ambos flujos tienen su propia cuenta MP, su propio webhook, su propio `ACCESS_TOKEN` y su propio `WEBHOOK_SECRET`. El token que el tenant ingresa durante el onboarding es **exclusivamente para cobrar a sus clientes**, nunca para pagar la suscripción a la plataforma.

## Decisión

Implementar dos flujos de MercadoPago completamente independientes:

| Flujo | Quién cobra | Cuenta MP | Access Token | Webhook | Webhook Secret |
|-------|-------------|-----------|--------------|---------|----------------|
| Suscripciones | Plataforma (LandaetaStudio) | Nuestra cuenta | `MP_PLATFORM_ACCESS_TOKEN` | `/api/webhooks/mercadopago/subscriptions/:tenantId` | `MP_PLATFORM_WEBHOOK_SECRET` |
| Órdenes de tienda | Tenant (cliente final) | Cuenta del tenant | `tenant_mp_config.access_token` (cifrado) | `/api/webhooks/mercadopago/:tenantId` | `MERCADOPAGO_WEBHOOK_SECRET` |

El `external_reference` de la preapproval de suscripción lleva el `tenantId` para identificar qué tenant activar al recibir el pago.

## Alternativas consideradas

1. **Cuenta única con sub-cuentas / credenciales OAuth:** Descartada. Agrega complejidad operativa, responsabilidad legal de custodio de fondos, y requiere gestión de `refresh_tokens` por tenant.
2. **Trial con token global de plataforma para órdenes:** Descartada en decisiones previas. Rompe el modelo de negocio (el tenant debe traer su propio MP).
3. **Una sola cuenta MP para todo:** Descartada. No permite que el tenant reciba los fondos directamente; la plataforma sería intermediario financiero.

## Consecuencias

### Positivas
- **Aislamiento financiero real:** La plataforma nunca toca el dinero de las órdenes de los clientes del tenant.
- **Sin custodia de fondos:** Compliance simple (no somos PSP, no custodiase dinero ajeno).
- **Responsabilidad clara:** Cada parte maneja su propia cuenta MP, sus propios chargebacks, sus propias comisiones.
- **Escalabilidad:** El onboarding del tenant es autónomo (configura su MP, valida con `/users/me`).

### Negativas
- **Dos webhooks que mantener:** Código duplicado conceptual (validación HMAC, idempotencia, manejo de estados) aunque se reutilice `verifyMercadoPagoSignature`.
- **Dos ciclos de vida de pago:** Suscripciones (preapproval) vs órdenes (checkout pro). Distinta semántica de eventos MP.
- **Onboarding más largo:** El tenant debe crear cuenta MP, obtener credenciales, configurarlas en la plataforma antes de poder operar.
- **Variables de entorno adicionales:** `MP_PLATFORM_ACCESS_TOKEN`, `MP_PLATFORM_WEBHOOK_SECRET` en Vercel (todas las apps).

## Variables de entorno nuevas

| Variable | Uso | Ámbito |
|----------|-----|--------|
| `MP_PLATFORM_ACCESS_TOKEN` | Token de nuestra cuenta MP para cobrar suscripciones | Vercel (todas las apps) |
| `MP_PLATFORM_WEBHOOK_SECRET` | Secret del webhook de suscripciones (nuestra cuenta) | Vercel (storefront) |

## Referencias

- Blueprint v2.6: `docs/superpowers/specs/2026-09-blueprint-v2.6.md` (sección "Arquitectura de pagos — Dos flujos independientes")
- Blueprint v2.6: sección "Flujo de suscripciones — Ciclo de vida completo"
- ADR-024: Cifrado de tokens con pgcrypto (para `tenant_mp_config`)
- ADR-004: R2 y MercadoPago (contexto histórico de integración MP)