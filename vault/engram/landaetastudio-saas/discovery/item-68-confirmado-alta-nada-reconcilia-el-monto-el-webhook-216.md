---
id: 216
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/item-68-no-reconcilia-monto
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:06:05"
updated_at: "2026-10-08 19:06:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Item 68 confirmado ALTA: nada reconcilia el monto, el webhook solo warns"
---

# Item 68 confirmado ALTA: nada reconcilia el monto, el webhook solo warns

**What**: Verificado que NADA reconcilia un monto mal aplicado en el preapproval. Item 68 queda ALTA, no MEDIA. El webhook DETECTA la divergencia pero solo escribe un log.

**Why**: La pregunta abierta era si el webhook corregia el monto, lo que bajaria item 68 de ALTA a MEDIA.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` — `verifyPlanAmountConvergence` (L669-706), `handlePreapproval` (L324-368), `handleAuthorizedPayment` (L290-315).

**Learned**:
- `verifyPlanAmountConvergence` es **warn-only por decision explicita**, documentada en el propio codigo: "No escribe nada" y "aca no puede haber una escritura: seria exactamente el bug de H3" (L656-667). Su unico efecto es `logger.warn` (L696-704): sin Sentry, sin email, sin alerta.
- **Ningun webhook llama a `updatePreapproval`.** Solo hay 2 call sites en produccion: `plan/route.ts:235` (cambio de plan, que si es el fix) y `mutate.ts:97` (que solo escribe `{ status: target }`, NO toca el monto).
- `handleAuthorizedPayment` (el topic del COBRO real) devuelve `{ ignored: true, reason: 'no_transition_for_this_topic' }` en L314 sin leer `transaction_amount` ni tocar MP. Resuelve el tenant, loguea y se va.
- El check de convergencia solo corre con `eventKind === 'preapproval'` (L543). `handlePayment` (L277-279) llama a `applyTransition` SIN `amountCents`, asi que en eventos de pago el monto nunca se compara.
- No hay cron ni scheduled ni reconcile en ninguna de las 3 apps.
- **Lo mas grave: deteccion sin remediacion.** El webhook lee el monto real de MP (L356), lo compara con el plan local, y cuando no coincide solo deja una linea de log. El codigo la llama "la red de seguridad del otro lado", pero una linea de log no es una red de seguridad para dinero. Por event order B ese evento es el que ACTIVA el alta, asi que la deteccion es timely pero no actuante. La unica via de correccion es que el tenant cambie de plan a mano, que no es remediacion.
- MP no puede autocorregirse porque nuestro codigo nunca se lo pide.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-discovery]]
