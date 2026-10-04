---
id: 144
type: architecture
project: landaetastudio-saas
scope: project
topic_key: feature/t5-webhook-handler-suscripciones
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 20:37:59"
updated_at: "2026-10-04 20:37:59"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "T5: handler completo de webhooks de suscripciones, event order B"
---

# T5: handler completo de webhooks de suscripciones, event order B

**What**: T5 (issue #169). Reemplazo el stub de captura del spike T0 por el handler completo: 8 transiciones de§6.3, event order B, estrategia L + fallback R, idempotencia por convergencia, tolerancia a UNKNOWN.

**Why**: El spike T0 re-ejecutado (PR #188) confirmo H1 — MP SI entrega webhooks a produccion, 3 eventos en 1 s. La memoria del 2026-10-02 que decia "T5 INVALIDADA" quedo superada y esta marcada como `conflicts_with` a favor de esta.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` + `__tests__/handler.test.ts` (37 tests), `packages/commerce/src/mp-subscriptions.ts` (nuevo `getPayment`), `packages/commerce/src/mp-webhook-events.ts`

**Learned**:
- **Event order B (Luis):** el alta se activa desde `subscription_preapproval`, NO desde `subscription_authorized_payment`. El spike recomienda lo contrario; se sigue la decision de producto y la discrepancia quedo documentada. Costo: ~2.5 s de latencia. Beneficio: la fuente de verdad es el estado del preapproval.
- **`GET /preapproval/{id}` es necesario IGUAL con estrategia L.** La estrategia L evita el GET para RESOLVER EL TENANT, pero para DECIDIR LA TRANSICION hace falta el status real: el `action` del topic preapproval llega como `updated` tanto para `authorized` como para `cancelled`, asi que no sirve. Son dos cosas distintas y no conviene confundirlas.
- **La estrategia L resuelve el tenant via `db.select` directo, NO via `withTenantContext`.** `withTenantContext` exige el tenantId, que es justamente lo que se esta resolviendo. Es seguro porque solo lee y el filtro es el indice unico parcial. Toda escritura posterior si va dentro de `withTenantContext`.
- **DIVERGENCIA ABIERTA con §6.3:** pide `lastProcessedPaymentId = invoiceId` en la transicion 1, pero el `data.id` de `subscription_preapproval` es el id del PREAPPROVAL. El invoiceId viaja en otro topic. Guardar el id del preapproval en una columna llamada `lastProcessedPaymentId` seria mentir sobre el dato. La idempotencia de esa transicion la da la convergencia. Si Luis lo quiere guardado, hace falta `GET /authorized_payments/search?preapproval_id={id}`.
- **Un 2xx de MP no alcanza para decidir transicion:** se lee el status real con GET. Aplica el mismo principio que los endpoints de T4.
- 670 tests / 68 archivos (base develop 633/67).

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-feature]]
