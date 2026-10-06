---
id: 175
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 17:17:23"
updated_at: "2026-10-06 17:17:23"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Patron: antes de mapear valor -> entidad, inyectividad sobre la historia"
---

# Patron: antes de mapear valor -> entidad, inyectividad sobre la historia

**What**: Antes de derivar una entidad a partir de un valor de negocio (`monto -> planId`, `slug -> tenant`), hay que comprobar que el mapeo sea **inyectivo sobre la historia**, no solo sobre el estado actual.

**Why**: En H3, `findPlanByAmountCents` mapeaba `transaction_amount` a un plan local. Sobre el estado actual parecia univoco. Sobre la historia no lo era: con un A -> B -> A, el monto de B identifica a B en cualquier epoca, asi que un evento tardio del ciclo de B revierte `planId` a B. El mapeo no distingue "el plan actual" de "un plan que estuvo activo". Como MP reintenta webhooks, el orden no esta garantizado y esa dependencia convierte la escritura en no-idempotente.

**Where**: Aplicado en `apps/admin/app/api/subscriptions/plan/route.ts` y `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`. Decision en `vault/01_ADRs/ADR-027-planid-endpoint-write.md`.

**Learned**:
- **Tres preguntas para un mapeo valor -> entidad:**
  1. ¿El valor identifica la misma entidad a lo largo del tiempo? Si un mismo valor seasocio a entidades distintas en periodos distintos, no sirve.
  2. ¿El valor aparece en mas eventos que los que disparan la transicion? `transaction_amount` viene en cobros recurrentes, no solo en cambios de plan, asi que el mapeo se disparaba de mas.
  3. ¿El sistema que produce los eventos garantiza orden y entrega unica? Si reintenta, no.
- **La pregunta que cierra el caso:** ¿quien produce el valor, y puede hacerlo sin pasar por nosotros? Si el tenant no puede cambiar el monto desde el panel de MP y todo cambio pasa por `PUT /plan`, entonces el webhook **no tiene nada que descubrir**: el dato ya lo tenemos y lo tenemos autoritativamente. Inferir en el consumidor lo que el productor ya sabe es innecesario y fragil.
- **Corolario practico:** escribir en el punto donde se produce la intencion (el endpoint, que ya verifico con MP) y dejar al consumidor en modo verificacion (warn), no escritura. Verificar es idempotente; escribir inferido no lo es.
- **Corolario de testing:** una verificacion que solo emite `warn` necesita poder afirmarse sobre el logger. Si el mock del logger apunta al modulo equivocado, la cobertura parece existir pero es ciega. Verificar que el mock coincida con el import real del modulo bajo prueba.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
