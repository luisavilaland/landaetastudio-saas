---
id: 165
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 14:10:41"
updated_at: "2026-10-06 14:10:41"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "H2 cerrado: decideTarget soporta paused (item 38 superseded, opcion B)"
---

# H2 cerrado: decideTarget soporta paused (item 38 superseded, opcion B)

**What**: H2 cerrado. `decideTarget` soporta `paused`. Item 38 marcado SUPERSEDED, item 38-bis creado con la decision vigente (opcion B de Luis).

**Why**: La auditoria mid-phase (PR #197) reporto que `POST /pause` devuelve 202 que nunca confirma y `resume` es inalcanzable. Luis aprobo la **opcion B** al aprobar la auditoria.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`TransitionInput`, `handlePreapproval`, `decideTarget`, `applyTransition`), `__tests__/handler.test.ts`, `vault/03_Deuda/deuda-tecnica.md`

## El bug real: no era un `if` faltante, era informacion perdida

En `handlePreapproval` el status crudo de MP se colapsaba a booleano:

```ts
const activating = mpStatus === 'authorized'
// mpStatus === 'paused' terminaba en approved: false
```

`decideTarget` recibia `approved: false` y **no podia distinguir `paused` de cualquier otro estado no autorizante**. La distincion se perdia ANTES de la matriz de transiciones. Por eso agregar targets a `decideTarget` sin pasar `mpStatus` no habria funcionado.

El fix: `TransitionInput` suma `mpStatus` y `decideTarget` lo recibe.

## El guard mas importante del PR

**`paused -> active` NO renueva `currentPeriodEnd`.** Sin ese guard, cada ciclo pause/resume regalaba un mes: el tenant nunca perdio el periodo, solo dejo de facturarse. Solo la activacion desde un estado que lo habia perdido (`pending_first_payment`, `past_due`, `expired`) lo renueva.

`PAUSABLE = ['active', 'past_due']`. `expired`, `abandoned` y `cancelled` no pausan: una suscripcion vencida no se pausa, caduca.

## Tests

**7 nuevos**, no 3: `active -> paused`, `past_due -> paused`, `expired` no pausa, replay de `paused` converge, `paused -> active` sin renovar periodo, `paused` con MP no autorizado no transiciona, y regresion del 409 eterno de `POST /resume`.

**Total: 685 en 68 archivos** (base develop 678/68).

## Learned

- **Preservar el dato crudo en el borde.** Aplastar un enum a booleano en el borde tira informacion que la logica de abajo necesita. El `status` ya estaba parseado por el schema Zod (`data.status`) y **no se usaba**: era la variable que faltaba.
- **Un test de regresion de un 409 necesita verificar el efecto, no el codigo.** Escribi primero `expect(REVIVABLE_ACCEPTS('paused')).toBe(false)` contra helpers que ni existen (son privados del modulo). Un test debe probar comportamiento observable. Reemplazado por: la fila queda en `paused`, que es el `from` que `resume` acepta.
- `str()` devuelve `string | null`, no `string`. El campo opcional del interface tiene que reflejarlo o typecheck falla.
- **El item 40 paso de 5 a 6 reglas** en este PR: nunca here-strings de PowerShell para markdown con backticks (el backtick es el caracter de escape y U+000B es un escape valido). Tercera aparicion del patron: item 40, item 52, body del PR #197. **La causa es heramental, no de disciplina**: la regla tiene que ser "no uses esa herramienta".
- Al medir el encoding de `bitacora.md` para verificar mi append, discover que **mi auditoria (PR #197) tenia un quinto error sin corregir**: decia 36 `U+FFFD` y 8 CJK; el conteo real es **34 y 10**, que es lo que el subagente de la segunda pasada habia reportado. Corregido en este PR.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
