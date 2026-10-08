---
id: 219
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/verificacion-post-write-pertenece-al-endpoint
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:38:20"
updated_at: "2026-10-08 19:38:20"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "La verificacion de un write pertenece al endpoint que escribe, no al que observa"
---

# La verificacion de un write pertenece al endpoint que escribe, no al que observa

**What**: Patron: la verificacion post-escritura pertenece al endpoint que escribe, no al que observa. El webhook detecta pero no puede remediar (ADR-027, H3). El endpoint si puede y debe.

**Why**: El item 68 mostro que la regla "el webhook no escribe" es correcta para `planId` (un dato stale) pero insuficiente para el monto (plata). Aplicada sin matiz, la misma regla que protege de H3 deja el cobro sin verificar y sin alerta.

**Where**: `apps/admin/app/api/subscriptions/preapproval/route.ts`, `apps/admin/app/api/subscriptions/plan/route.ts`, `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`handlePreapproval`, `handleAuthorizedPayment`, `verifyPlanAmountConvergence`).

**Learned**:
- **El criterio no es "quien observa" sino "que se pierde si nadie actua".** Un dato stale se corrige en la proxima escritura. Plata no. Si la consecuencia de no actuar es irreversible, la verificacion va en el endpoint.
- **Deteccion sin remediacion es peor que no detectar:** da la ilusion de una red de seguridad. El webhook hacia `logger.warn` y el codigo lo describia como "la red de seguridad del otro lado". Una linea de log no es una red.
- **Una decision arquitectonica correcta puede quedar insuficiente al extenderse a otro campo.** ADR-027 forbid que el webhook escriba `planId` porque un evento atrasado discrepa por diseno. El monto tiene la misma asimetria, pero alli la consecuencia es un cobro. Misma regla, distinto peso.
- **Al copiar un patron, copiar la justificacion tambien.** `/plan` devuelve 202 cuando no puede verificar porque la escritura ya salio y 502 mentiria. La version correcta de "copiar el patron" es "copiar la estructura y re-derivar la decision desde las precondiciones del endpoint destino".
- **Regla operativa derivada:** un `warn` en un camino que no puede actuar es un bug de observabilidad. Si el log no dispara ninguna accion (alerta, rollback, reintento), o no es una alerta, o sobra.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
