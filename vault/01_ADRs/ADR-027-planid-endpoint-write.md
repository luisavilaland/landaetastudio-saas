# ADR-027: `planId` se escribe en el endpoint, no en el webhook

- **Estado**: Aceptado
- **Fecha**: 2026-10-06
- **Decide**: H3 de la auditoria mid-phase (#197), rama `chore/fix-h3-plan-id-endpoint-write`

## Contexto

`PUT /api/subscriptions/plan` devuelve `202` y delega la aplicacion a
MercadoPago. Su comentario de encabezado decia _"El plan no se escribe en la DB.
Lo hace el webhook, como toda transicion de estado"_.

El webhook nunca tuvo esa logica. `applyTransition` escribia `status`,
`currentPeriodEnd` y `lastProcessedPaymentId`, y **cero** campos de plan. La
consecuencia era que `subscriptions.planId` quedaba congelado en el plan de
creacion para siempre.

Eso producia tres sintomas:

1. Si el tenant cambiaba de plan, la DB seguia reportando el original.
2. Al intentar volver al plan original, el `409 "Ya tenes ese plan"` respondia
   contra un estado que no reflejaba la realidad.
3. El aviso de monto divergente que pide el design (fase2-design.md:643) no
   existia: nadie comparaba nunca el monto de MP con el precio del plan local.

## Decision

**El endpoint escribe `planId`, el webhook no.**

`PUT /plan` actualiza el monto del preapproval, hace su `GET` de verificacion
posterior (que ya existia) y, **solo si el monto quedo confirmado**, escribe
`planId` dentro de `withTenantContext`.

El webhook no escribe `planId`. Solo **verifica**: compara el monto que reporta
MP contra el precio del plan local y avisa si difieren.

## Por que no escribir desde el webhook (mapeo monto -> plan)

La auditoria propuso que el webhook descubriera el `planId` mapeando
`transaction_amount` a un plan local. La idea se descarta por tres razones
concretas:

1. **El mapeo no es inyectivo en el tiempo.** Si el tenant sube A -> B y despues
   baja B -> A, un evento del ciclo de B que llega tarde vuelve a matchear B y
   **revierte `planId`**. El mapeo no distingue "el plan actual" de "un plan que
   estuvo activo".
2. **Se dispara en todo evento con monto.** `transaction_amount` viene tambien en
   los cobros recurrentes, no solo en los eventos de cambio. `planId` se
   reescribiria en cada pago, que no es lo que la columna significa.
3. **El orden no esta garantizado.** MP reintenta webhooks. Cualquier
   dependencia del orden hace que la escritura no sea idempotente.

A eso se suma que el tenant **no puede cambiar el monto desde el panel de MP**
(solo el collector, que somos nosotros). Todo cambio de monto pasa por
`PUT /plan`. El webhook no tiene nada que descubrir.

## Cuando se escribe, y cuando no

`PUT /plan` escribe `planId` unicamente si la verificacion post-escritura
**confirmo** el monto:

| Situacion                      | Status | Escribe `planId` |
| ------------------------------ | ------ | ---------------- |
| Monto verificado y coincide    | `202`  | **si**           |
| Monto verificado y NO coincide | `502`  | no               |
| `GET` de verificacion fallo    | `202`  | no               |
| `transaction_amount` ausente   | `202`  | no               |

Los dos ultimos casos conservan el comportamiento ya decidido y testeado de
este endpoint: un `GET` que fallo o un campo ausente **no permiten afirmar que
la operacion fallo**, asi que el `202` sigue siendo honesto (el `PUT` a MP si
salio). Lo que cambia con H3 es que, sin confirmacion, **no se escribe
`planId`**: registrarlo seria afirmar un estado que nadie verifico.

## La verificacion del webhook es un invariante del evento

La comparacion se corre en todo evento `subscription_preapproval` que trae
monto, **antes** de `decideTarget`, y no solo cuando la transicion va a
`active`.

Gatearla por `target === 'active'` la haria inalcanzable en el caso que mas
importa: un evento atrasado o un reintento sobre una suscripcion ya activa cae
en `no_transition` (transiciones 2 y 3 de la matriz; `active` no esta en
`REVIVABLE`), y ese es precisamente el evento que quiero vigilar.

En el topic `payment` **no** se compara: alli `transaction_amount` es lo que se
cobro ese ciclo, que legitimamente difiere del precio del plan (prorrateo,
cupones, primer ciclo con descuento). Comparar ahi daria falsos positivos.

## Alternativas consideradas

- **Webhook escribe `planId` via monto -> plan.** Descartada por lo anterior.
- **Guardar el `planId` en `preapproval.external_reference`.** Descartada:
  obliga a un `GET` extra por evento para leerlo.
- **Endpoint devuelve `200` informativo y la DB sigue desactualizada.**
  Descartada: no resuelve el `409 "Ya tenes ese plan"`, que seguiria respondiendo
  contra un estado falso. Solo documenta el síntoma.
- **Escribir `planId` antes de llamar a MP.** Descartada: si MP rechaza el
  cambio, la DB quedaria apuntando a un plan que nunca se aplico.

## Consecuencias

- `PUT /plan` funciona end-to-end: la DB refleja el plan que MP confirmo.
- El `409 "Ya tenes ese plan"` responde contra la realidad.
- El monto divergente queda registrado con tenant y los dos montos, en vez de
  ser invisible.
- **No hay dependencia del orden de eventos.** Un evento atrasado avisa, no
  revierte.
- La escritura de `planId` queda atada a un unico lugar (el endpoint), y por lo
  tanto a una unica verificacion.
- Si el `GET` de verificacion falla, la DB y MP pueden quedar desalineadas. Es
  un trade consciente: se prefiere no afirmar nada antes que afirmar algo no
  verificado. El siguiente `PUT /plan` del tenant converge.
- La verificacion del webhook agrega una consulta por `plans.id` (PK) en cada
  evento `subscription_preapproval` con monto.

## Referencias

- Auditoria mid-phase de Fase 2 (T1-T5), PR #197, hallazgo H3.
- ADR-026 (H1: contexto de tenant y la funcion `SECURITY DEFINER`).
- PR #199 (H1), ya mergeado.
- Spike T0, PR #188: el patron de `2xx` silencioso de MP y la regla de
  verificar con un `GET` posterior.
