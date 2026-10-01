---
id: 80
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 14:06:44"
updated_at: "2026-10-01 14:06:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Verificado contrato real webhook suscripciones MP (Fase 2)"
---

# Verificado contrato real webhook suscripciones MP (Fase 2)

**What**: Verificado contra docs de MercadoPago (2026-10-01) que 3 supuestos del sdd-propose de Fase 2 eran incorrectos. Especificado el contrato real del webhook de suscripciones.

**Why**: El propose asumía que `external_reference` venía en el payload del webhook y que los eventos se llamaban `preapproval.created` / `payment.failed`. Ambas cosas son falsas y habrían producido un handler que nunca resuelve el tenant ni transiciona estados.

**Where**: docs/superpowers/specs/2026-10-01-fase2-webhook-checkout.md (sección 0)

**Learned**:
1. **URL de webhook es LITERAL, sin path templating.** MP registra una URL fija por app y por modo. No conoce tenants. Unico param variable: `?cliente=<seller>`. El path `/api/webhooks/mercadopago/subscriptions/:tenantId` del spec transversal §8 es IMPOSIBLE de implementar.
2. **`external_reference` NO viene en el payload.** El body real es `{id, live_mode, type, date_created, user_id, api_version, action, data:{id}}`. `external_reference` pertenece al objeto preapproval y solo se obtiene con `GET /preapproval/{id}` o `GET /v1/payments/{id}`. Implicacion: el webhook necesita `MP_PLATFORM_ACCESS_TOKEN` y hace llamada saliente a MP en cada hit.
3. **Los topics reales no son `preapproval.*`.** Son `subscription_preapproval`, `subscription_authorized_payment`, `payment`, `subscription_preapproval_plan`. El payload trae `type` + `action`, no un nombre de evento compuesto. Hay que despachar por topic y resolver la entidad correcta (preapproval vs payment).
4. **MP DESACTIVA la config por panel para Suscripciones** y obliga a mandar `notification_url` en `POST /preapproval`. Refuerza URL fija y da control explicito del dominio.
5. **`back_url` es singular en preapproval**, no `back_urls: {success,failure,pending}` (eso es de la API de Preferences / Checkout Pro, el otro flujo). El propose mezclaba ambos contratos.
6. **`data.id` llega como query param** y es lo que cubre el HMAC. El webhook de ordenes existente lo saca del body; para suscripciones conviene query param primero.
7. **Los endpoints van en `apps/admin/`, NO en storefront.** `apps/storefront/proxy.ts` resuelve tenant por subdominio, lo que rompe un webhook de plataforma (por cuenta, no por tenant). `apps/admin` no tiene proxy.ts y saca `tenantId` de `session.user.tenantId` (JWT).
8. **Reduccion de alcance**: `POST /subscriptions/preapproval` y `POST /checkout/subscription/preference` del propose son la MISMA operacion (`POST /preapproval` ya devuelve `init_point`). Se fusionan: 5 endpoints, no 6. Estimacion 10-12 dias -> 10 dias.
9. **Discrepancia sin resolver**: el spec transversal §5 afirma que "MP no soporta prorrateo nativo", pero MP expone `billing_day_proportional` y `auto_recurring.billing_day_proportional`. Se mantiene la politica del transversal (calculo propio) pero queda senalada para sdd-design.
10. **`POST /preapproval` no es idempotente**: doble click crea dos suscripciones en MP. Mitigacion: 409 con `initPoint` existente si ya hay `mpPreapprovalId` en `pending_first_payment`.

**Spike bloqueante antes de sdd-apply**: crear un preapproval real en la cuenta de plataforma y capturar un webhook para fijar los literales exactos de `type`/`action` por topic. No se adivinan.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
