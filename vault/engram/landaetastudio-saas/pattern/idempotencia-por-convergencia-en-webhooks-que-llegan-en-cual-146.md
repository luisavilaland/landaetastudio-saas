---
id: 146
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/idempotencia-por-convergencia-en-webhooks
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 20:39:11"
updated_at: "2026-10-04 20:39:11"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Idempotencia por convergencia en webhooks que llegan en cualquier orden"
---

# Idempotencia por convergencia en webhooks que llegan en cualquier orden

**What**: Los webhooks de MercadoPago llegan en cualquier orden y se reintentan. La idempotencia se implementa por CONVERGENCIA de estado, no por recordar que evento se proceso.

**Why**: En T5, MercadoPago reintenta los webhooks y el orden real verificado es `payment` -> `subscription_authorized_payment` -> `subscription_preapproval`, no el que asumia el design. Un guard tipo "si ya vi este evento, no hago nada" necesita memoria de eventos, que es exactamente lo que no hay.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (guardas de idempotencia), `__tests__/handler.test.ts`

**Learned**:
- **Convergencia:** si el estado local ya es el objetivo, no se escribe. Es stateless, no requiere recordar nada y funciona con cualquier cantidad de reintentos.
- **Guard complementaria:** `lastProcessedPaymentId === paymentId` -> ya se proceso ese pago. Solo aplica a eventos `payment`, porque en un preapproval el `data.id` NO es un id de pago (guardar el id del preapproval en una columna llamada `lastProcessedPaymentId` seria mentir sobre el dato).
- **UNKNOWN responde 200, no 5xx.** MP reintenta los 5xx. Un evento que no entendemos no se arregla reintentando: se loguea y se acepta. Devolver 5xx genera reintentos infinitos sobre algo que jamas va a funcionar.
- **Un GET a MP que falla NO debe convertirse en un 5xx nuestro.** Se acepta el evento sin escribir y se loguea. Convertirlo en 5xx hace que MP reintente nuestro webhook sin que nada cambie.
- **Testear idempotencia exige un tx mock que MUTA al escribir.** Con un mock de filas fijas, "mismo payment dos veces" no es testeable: las dos llamadas leen la misma fila pristina y las dos escriben. Salen 2 escrituras y el test "falla" por un defecto del mock, no del handler.
- **La transicion se decide con el estado real (GET), no con el `action`.** El `action` del topic `payment` llega como `payment.created` y no distingue aprobado de rechazado; el de `subscription_preapproval` llega como `updated` tanto para `authorized` como para `cancelled`. Se cruzaran ambas senales porque cada una cubre el punto ciego de la otra.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-pattern]]
