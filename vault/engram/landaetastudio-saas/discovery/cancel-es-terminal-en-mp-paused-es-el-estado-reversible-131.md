---
id: 131
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:01:13"
updated_at: "2026-10-03 22:01:13"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "cancel es terminal en MP; paused es el estado reversible"
---

# cancel es terminal en MP; paused es el estado reversible

**What**: En MercadoPago, cancelled es TERMINAL. PUT con status cancelled desde authorized funciona (200 + GET), pero volver de cancelled a authorized devuelve 400 Invalid transition from cancelled to authorized. El unico estado reversible es paused: authorized a paused funciona (200 + GET) y paused a authorized tambien (200 + GET).

**Why**: El plan de Fase 2 asumia que POST /subscriptions/reactivate hacia PUT /preapproval/{id} {status: authorized}. Eso no existe en MP. Descubierto el2026-10-03 al probar la matriz de transiciones completa con configuracion consistente.

**Where**: docs/superpowers/plans/2026-10-01-fase2.md (secciones 7.4 pause y 7.5 resume, que reemplazan a la 7.4 reactivate original), docs/superpowers/specs/2026-10-01-fase2-design.md (mapa de transiciones 6.3)

**Learned**: (1) El scope de T4 cambia de 5 a 6 endpoints: sale reactivate, entran pause y resume. (2) La UI de cancelar tiene que avisar que es irreversible y no puede ofrecer reactivar despues; el camino de vuelta es pausar. (3) La doc oficial de MP (developers.mercadopago.com.ar/developers/es/docs/subscription-plans/manage-subscription-plan) confirma que paused DEFINITIVAMENTE detiene el cobro: Mercado Pago deja de debitar los pagos hasta que decidas reactivar. Por eso pause y resume se pueden exponer SIN feature flag, porque no generan perdida de acceso: el tenant conserva panel y storefront. (4) Cuidado con next_payment_date: NO cambia ni al pausar ni al cancelar, asi que no sirve para saber si la suscripcion va a cobrar. (5) Queda un test empirico abierto: el preapproval 24b2a868 quedo pausado el 2026-10-03 con next_payment_date 2026-11-03. Hay que ver ese dia si MP cobra. La doc dice que no, pero la validacion empirica decide si se expone la feature sin flag.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
