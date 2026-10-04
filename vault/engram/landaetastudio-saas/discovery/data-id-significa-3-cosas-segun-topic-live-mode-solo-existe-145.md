---
id: 145
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/mp-webhook-data-id-y-live-mode
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 20:38:37"
updated_at: "2026-10-04 20:38:37"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "data.id significa 3 cosas segun topic; live_mode solo existe en payment"
---

# data.id significa 3 cosas segun topic; live_mode solo existe en payment

**What**: En los webhooks de MercadoPago, `data.id` significa tres cosas distintas segun el topic, y `live_mode` solo existe en uno de ellos.

**Why**: Implementar el handler de suscripciones (T5) sin esto produce bugs silenciosos: un `GET /v1/payments/{id}` sobre un id de invoice devuelve algo que no es un pago, y un guard `live_mode === false` descarta TODOS los eventos de suscripcion, que son precisamente los que hay que procesar.

**Where**: `packages/commerce/src/mp-webhook-events.ts` (documentado), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`

**Learned**:
- | Topic | `data.id` es | Se resuelve con |
  | --- | --- | --- |
  | `payment` | id de pago | `GET /v1/payments/{id}` |
  | `subscription_authorized_payment` | id de **invoice** | `GET /authorized_payments/{id}` |
  | `subscription_preapproval` | id de preapproval | `GET /preapproval/{id}` |
- `/v1/payments/{id}` y `/authorized_payments/{id}` son **recursos distintos**. Confundirlos devuelve 200 con datos que no son los buscados — el mismo patron de "2xx silencioso" del spike.
- **`live_mode` SOLO viene en `payment`.** Los topics `subscription_authorized_payment` y `subscription_preapproval` no lo incluyen: el `topLevelKeys` del payload no tiene la clave. Tratar "ausente" como `false` es correcto; tratar "ausente" como `true` (o como error) rompe el flujo.
- Los `topLevelKeys` verificados:
  - `payment`: `action, api_version, data, date_created, id, live_mode, type, user_id`
  - topics de suscripcion: `action, application_id, data, date, entity, id, type, version`
- `type` y `action` vienen **separados**, no como un evento compuesto. Por eso el clasificador despacha por `type` y usa `action` como fallback.
- **Patron general: verificar el shape real del payload antes de escribir el guard.** La documentacion de MP no garantiza que un campo exista; el unico que lo garantiza es un payload capturado.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-discovery]]
