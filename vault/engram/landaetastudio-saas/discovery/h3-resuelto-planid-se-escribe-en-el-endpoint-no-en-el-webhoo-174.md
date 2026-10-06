---
id: 174
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 17:16:53"
updated_at: "2026-10-06 17:16:53"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "H3 resuelto: planId se escribe en el endpoint, no en el webhook"
---

# H3 resuelto: planId se escribe en el endpoint, no en el webhook

**What**: `subscriptions.planId` lo escribe `PUT /api/subscriptions/plan` **despues** de confirmar con MP, no el webhook. El webhook solo verifica que el monto que reporta MP coincida con el precio del plan local y avisa si difiere. Migracion de journal corregida de paso.

**Why**: H3 de la auditoria mid-phase (#197). `PUT /plan` devolvia 202 con el comentario "El plan no se escribe en la DB. Lo hace el webhook", pero `applyTransition` escribia `status`, `currentPeriodEnd` y `lastProcessedPaymentId`, y cero campos de plan. `planId` quedaba congelado en el plan de creacion y el `409 "Ya tenes ese plan"` respondia contra un estado falso.

**Where**: `apps/admin/app/api/subscriptions/plan/route.ts` (escritura tras la verificacion post-escritura), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`verifyPlanAmountConvergence`), `vault/01_ADRs/ADR-027-planid-endpoint-write.md`, deuda item 57, `packages/db/migrations/meta/_journal.json`.

**Learned**:
- **El diseno original de la auditoria era incorrecto y por una razon interesante.** Proponia que el webhook escribiera `planId` mapeando `transaction_amount` a un plan local. No funciona: (a) el mapeo no es inyectivo en el tiempo, con un A -> B -> A un evento tardio del ciclo de B vuelve a matchear B y revierte `planId`; (b) `transaction_amount` viene tambien en cobros recurrentes, no solo en eventos de cambio, asi que se reescribiria en cada pago; (c) MP reintenta webhooks, el orden no esta garantizado. El dato que lo cierra: el tenant no puede cambiar el monto desde el panel de MP, todo cambio pasa por `PUT /plan`, asi que el webhook no tiene nada que descubrir.
- **Un `202` honesto y una escritura ausente son compatibles.** Si el `GET` de verificacion falla o `transaction_amount` viene ausente, el endpoint sigue devolviendo 202 (el PUT a MP si salio, decision ya testeada) pero NO escribe `planId`. Preferir no afirmar nada antes que afirmar un estado no verificado.
- **Gatear la verificacion por `target === 'active'` la hace inalcanzable.** `active` no esta en `REVIVABLE`, asi que un evento atrasado sobre una suscripcion ya activa cae en `no_transition` y el aviso nunca sale justo cuando hay algo que avisar. Es un invariante del **evento**, no de la transicion: corre en todo `subscription_preapproval` con monto, antes de `decideTarget`.
- **No comparar el monto en el topic `payment`.** Alli `transaction_amount` es lo cobrado ese ciclo, que legitimamente difiere del precio del plan (prorrateo, cupones, primer ciclo con descuento).
- **Bug de tests encontrado de paso:** `handler.test.ts` mockeaba `@/lib/logger` pero el handler importa el logger desde `@repo/logger`. El mock no tenia efecto y todos esos tests corrian contra el logger real de pino, sin poder afirmar sobre ningun `warn`. Para poder testear H3 hubo que pasar los spies por `vi.hoisted` y apuntar al modulo correcto.
- **`when` del journal corregido:** `idx 2` tenia `1799110400000` = 2027-01-05, 90 dias adelantado (puesto a ojo en el PR de H1). drizzle ordena por `idx` asi que no rompia nada, pero `db:generate` usa el `when` de la ultima entrada para timestampar la nueva, con lo que toda migracion futura naceria en 2027. Valor correcto: `1791301469000`.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
