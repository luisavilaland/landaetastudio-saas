---
id: 95
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 18:21:44"
updated_at: "2026-10-02 18:21:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0 cerrado: MP no entrega webhooks de suscripciones, T5 invalidada"
---

# Spike T0 cerrado: MP no entrega webhooks de suscripciones, T5 invalidada

**What**: Spike T0 cerrado. Resultado: **MP NO entrega webhooks de suscripciones por ninguna via**. Confirmado con 2 pagos reales de test. T5 (webhook handler) queda INVALIDADA y se reemplaza por T9 (job de polling). Ademas P6: `PUT /preapproval/{id}` es de SOLO LECTURA tras el primer cobro, lo que deja la cancelacion de suscripciones sin backend posible.

**Why**: T0 debia confirmar que la entrega de webhooks funcionaba antes de invertir 2.5 dias en T5. Evito 2.5 dias de trabajo sobre una API que no entrega.

**Where**:
- `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md` (nuevo, resultado completo)
- `docs/superpowers/plans/2026-10-01-fase2.md` (T5 invalidada, T9 agregada, grafo y estimaciones actualizados)
- Preapproval test #2: `f7b02efc00cb4638a0fe25da2013018d`

**Learned**:

1. **P1 NEGATIVO, con control de observabilidad.** Dos pagos, cero entregas. Para descartar que fuera un artefacto de logs, se probo la ingesta con un POST de control a las 18:16:48 UTC que aparecio en los logs de Vercel de forma INMEDIATA (la ventana avanzo de 17:56:15 a 18:16:48). No hay lag. La ausencia de webhook es real.

2. **Vercel Auth NO era la causa de fondo.** Si bloqueo el pago #1 (16:05 UTC), pero el pago #2 (18:11:45 UTC) ocurrio con Auth OFF y tampoco produjo entrega. Auth era un factor contribuyente, no la causa.

3. **P3 POSITIVO, confirmado 2 veces.** `GET /authorized_payments/search?preapproval_id={id}` y `GET /authorized_payments/{id}` ambos devuelven `preapproval_id` + `external_reference` + `payment.status`. **No se necesita la tabla `subscription_payments`.** El cruce tenant es con el indice unico parcial de `subscriptions.mpPreapprovalId`. Ademas `/authorized_payments/search` acepta el preapprovalId como parametro directo, lo que hace el polling trivial.

4. **P6 NUEVO - el mas grave. `PUT /preapproval/{id}` es de solo lectura tras el primer cobro.** Probado: `status:"cancelled"` → 200 sin efecto; `status:"canceled"` → 400; `auto_recurring.transaction_amount` → 200 sin efecto. Verificado por GET: `last_modified` congelado. **El design §3.3 y el transversal §6 especifican `status: "cancelled"` y ESO NO FUNCIONA.** Si T5 se implementaba a ciegas, el boton de cancelar devolvia 200 al usuario sin cancelar nada.

5. **PATRON DE FONDO: MP devuelve 2xx y descarta campos en silencio.** 4 casos: `notification_url` POST (201), `notification_url` PUT (200 + sube version), `status:"cancelled"` PUT (200), `transaction_amount` PUT (200). En ninguno el campo se aplico. **REGLA: un 2xx de MP no es evidencia de que la operacion se aplico. Toda escritura con efecto de estado debe verificarse con GET.**

6. **Consecuencia de producto:** Fase 2 no puede ofrecer cancelar/pausar suscripciones. El panel de suscripciones del admin quedaria sin ese boton. Requiere decision de producto: (a) limitar Fase 2 a alta+cobro y gestionar cancelacion en el panel de MP, (b) investigar el endpoint correcto, (c) escalar a MP.

7. **T9 propuesta:** polling cada 5 min. `GET /preapproval/{id}` para estado real + `GET /authorized_payments/search?preapproval_id={id}` para pagos. Ventana 2 h, luego revision manual. Latencia hasta 5 min en vez de segundos.

8. **DEUDA PENDIENTE - accion manual urgente:** dos preapprovals de test quedaron autorizados con tarjeta Visa y cobro agendado el **2026-11-02** (`32f3e2a8575d4797a7841d98390e52bc` visa/9801292088 12:05 UTC, `f7b02efc00cb4638a0fe25da2013018d` visa/9863037497 14:11 UTC). La cancelacion por API no funciona (P6), deben cancelarse **desde el panel de MP**.

9. **Vercel Auth desactivado en preview** significa que el deploy es publico. Es correcto para recibir webhooks pero es un vector de exposicion a documentar.

10. **Token de Vercel expuesto en el chat de la sesion** - revocar en `vercel.com/account/tokens`. Nunca se escribio en un archivo del repo.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
