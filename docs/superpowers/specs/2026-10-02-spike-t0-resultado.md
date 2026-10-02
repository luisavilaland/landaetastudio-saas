# Spike T0 - Resultado: Webhooks de Suscripciones en MercadoPago

**Fecha:** 2026-10-02
**Issue:** #164 (T0)
**Estado:** REFRAMED - P1 sigue PENDIENTE. P2/P3/P5/P6 confirmadas.
**Entorno:** credenciales de prueba (Tests). Sin produccion.

---

## Preguntas resueltas

| P   | Pregunta                                            | Resultado                                            |
| --- | --------------------------------------------------- | ---------------------------------------------------- |
| P1  | ¿MP entrega webhooks de suscripciones?              | **PENDIENTE** - no en preview domain. Ver hipoteesis |
| P2  | ¿`notification_url` en POST `/preapproval`?         | **NO** - 201 sin error, GET vacio                    |
| P3  | ¿`/authorized_payments` expone el vinculo tenant?   | **SI** - `preapproval_id` + `external_reference`     |
| P4  | ¿Webhook de alta en BD distinta?                    | n/a - no alcanzado                                   |
| P5  | ¿`PUT /preapproval/{id}` guarda `notification_url`? | **NO** - 200 sin error, GET vacio                    |
| P6  | ¿Se puede mutar el preapproval tras el cobro?       | **NO** - todos los PUT son no-op post-cobro          |

---

## Hipotesis principal (NO verificada)

> **MP no entrega webhooks a dominios preview de Vercel. Requiere un endpoint en el dominio
> de produccion (`admin.landaetastudio.com`).**

### Indicios a favor

- El wizard "Configura tu integracion" figura completado, pero el panel sigue en
  **"ETAPA 1 DE 5"**. MP espera una validacion end-to-end que no ocurre.
- La URL configurada apuntaba a un preview domain (`saas-admin-git-chore-spike-...vercel.app`).
- El Flujo B funciona en `tienda1.landaetastudio.com` (dominio real).

### Evidencia de que los webhooks de MP si llegan a produccion

`apps/storefront/app/api/webhooks/mercadopago/route.ts:234` es el **unico** punto donde una orden
del storefront pasa a `confirmed`. No existe ruta sincronica de confirmacion: `back_urls` solo
redirigen al navegador. Por lo tanto, que el Flujo B funcione en `tienda1.landaetastudio.com`
**implica** que MP entrega webhooks a ese dominio.

O sea: la infraestructura de webhooks de MP funciona. Lo no probado es el scope de
**suscripciones** en un dominio de **produccion del admin**.

---

## Hipotesis alternativa (NO descartada)

> **No hay ningun topic de suscripcion suscrito en el panel de MP.**

El propio "ETAPA 1 DE 5" es evidencia a favor de esta. Si ningun topic esta activo, MP no tiene
que enviar nada, **independientemente del dominio**. Este spike nunca verifico que la suscripcion
a topics estuviera activa.

**Esta hipotesis es mas barata de descartar que la principal** y debe comprobarse ANTES de
implementar T5: es una mirada al panel, no 2.5 dias de codigo.

### Tabla de hipotesis

| #   | Hipotesis                                           | Como se descarta                                | Costo         |
| --- | --------------------------------------------------- | ----------------------------------------------- | ------------- |
| H1  | MP no entrega a preview domains                     | Apuntar el webhook a `admin.landaetastudio.com` | Deploy + pago |
| H2  | No hay topic de suscripcion suscrito                | Verificar la seleccion de topics en el panel    | 5 minutos     |
| H3  | MP no entrega webhooks de suscripciones en absoluto | H1 descartada + H2 descartada                   | -             |

**El spike anterior concluyo H3 sin haber descartado H1 ni H2.** Esa fue la weakness del
analisis: se asumio que el topic estaba suscrito, y esa asuncion nunca se verifico.

---

## Decision

Avanzar con T1-T8. T5 se implementa y se deploya a produccion para validar P1.

- Si funciona -> **T9 (polling) queda como fallback documentado**, no se implementa.
- Si no funciona -> **T9 pasa a ser obligatorio**.

### Correccion al modelo de costo

La hypothesis original era "T5 debe existir antes de validar P1". **Es mas caro de lo necesario.**
El stub de captura (`apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`) ya existe y
ya esta escrito. Para descartar H1 **no hace falta el handler completo**: alcanza con deployar
el stub a `admin.landaetastudio.com`, apuntar el panel de MP ahi y pagar.

El stub **debe endurecerse antes de tocar produccion** (ver seccion siguiente). Ese endurecimiento
es una rebanada chica de T5 - firma y limites -, no las 8 transiciones completas.

---

## Requisito para exponer el stub en produccion

El stub actual **no es apto para produccion tal como esta**:

- No verifica firma HMAC. Cualquiera puede POSTear.
- No limita el tamano del body. Un POST gigante se escribe en disco.
- Loguea metadata sin restraint y escribe el body crudo a disco.

**Antes de deployarlo a `admin.landaetastudio.com` hay que agregar, como minimo:**

1. Verificacion de firma (reutilizar `verifyMercadoPagoSignature` de `@repo/commerce`).
2. Limite de tamano del body (rechazar por encima de un tope).
3. Logueo de metadata **sin PII** y sin persistir el body crudo.

Esa rebanada es reutilizable por T5. El resto del handler (transiciones de estado, idempotencia)
solo hace falta si el webhook resulta funcionar.

---

## P1 - Webhooks de suscripciones: NEGATIVO

### Lo que se probó

| Pago | Preapproval                        | Hora UTC | Vercel Auth | Webhook recibido |
| ---- | ---------------------------------- | -------- | ----------- | ---------------- |
| #1   | `32f3e2a8575d4797a7841d98390e52bc` | 16:05:13 | ON          | NO               |
| #2   | `f7b02efc00cb4638a0fe25da2013018d` | 18:11:45 | OFF         | NO               |

Ambos pagos quedaron `authorized`, con `summarized.semaphore: green` y `charged_quantity: 1`.

### Que quedo descartado y que NO

**Descartado (con control):** Vercel Auth bloqueando el trafico.

1. Auth OFF verificado: un POST anonimo al endpoint devuelve **HTTP 200**.
2. Ingesta de logs verificada **viva**: un POST de control a las 18:16:48 UTC aparecio en los
   logs de Vercel de forma inmediata (la ventana avanza de 17:56:15 a 18:16:48 en la misma consulta).
   No hay lag de ingesta.
3. La ventana de logs cubre la hora del pago #2 (18:11:45 UTC) y **no contiene ninguna entrada**.

Por lo tanto **la ausencia de entrega en el preview domain es un hecho verificado**, no un
artefacto de observabilidad.

**NO descartado:** la causa de esa ausencia. Ver seccion "Hipotesis alternativa". El spike
verifico que no hubo entrega, pero **no verifico que la suscripcion a topics estuviera activa**,
ni que el dominio estuviera permitido. Esa es la weakness del analisis original.

### Nota sobre Auth

Vercel Auth bloqueando el trafico fue un factor real para el pago #1, pero **no explica el pago #2**,
que ocurrio con Auth desactivado y tampoco produjo entrega.

**Finding operativo:** con Auth desactivado, cualquier preview deploy de Vercel es publicamente
accesible. Para webhooks es lo correcto, pero es un vector de exposicion a documentarse.

---

## P2 - `notification_url` en POST /preapproval: NEGATIVO

```
POST /preapproval
{ ..., "notification_url": "https://.../api/webhooks/mercadopago/subscriptions" }
```

**Respuesta:** HTTP **201** (exito aparente).

**Verificacion:** `GET /preapproval/{id}` posterior **no incluye** `notification_url`.

El campo se acepta y se descarta en silencio.

---

## P3 - `/authorized_payments`: POSITIVO

Confirmado con los dos pagos del spike.

**Pago #1** - invoice `7032493379`
**Pago #2** - invoice `7032499635`, payment `182040838792`

```
GET /authorized_payments/search?preapproval_id=f7b02efc00cb4638a0fe25da2013018d
GET /authorized_payments/7032499635
```

Ambos devuelven:

```json
{
  "id": 7032499635,
  "preapproval_id": "f7b02efc00cb4638a0fe25da2013018d",
  "external_reference": "22222222-3333-4444-8555-666666666666",
  "status": "processed",
  "transaction_amount": 100.0,
  "currency_id": "UYU",
  "payment": {
    "id": 182040838792,
    "status": "approved",
    "status_detail": "accredited"
  }
}
```

### Decision de diseno que esto desbloquea

**No se requiere la tabla `subscription_payments`.** El cruce tenant se resuelve con la tabla
`subscriptions` usando `mpPreapprovalId` como indice unico parcial (previsto en T1):

```sql
CREATE UNIQUE INDEX subscriptions_mp_preapproval_uidx
  ON subscriptions (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;
```

El endpoint de suscripciones recibe `preapprovalId`, busca por `mpPreapprovalId`, y con eso obtiene
el `tenantId`. Un indice, cero joins.

### Senal de webhook disponible sin webhook

`/authorized_payments/search` acepta el **preapprovalId como parametro de busqueda directo**. No es
necesario parsear el `external_reference`. Esto hace que el polling sea simple:

```
GET /authorized_payments/search?preapproval_id={mpPreapprovalId}
  -> results[] con external_reference, status, payment
```

---

## P5 - `PUT /preapproval/{id}` con `notification_url`: NEGATIVO

```
PUT /preapproval/32f3e2a8575d4797a7841d98390e52bc
{ "notification_url": "https://.../api/webhooks/mercadopago/subscriptions" }
```

**Respuesta:** HTTP **200**, y `version` subio de 0 a 1.

**Verificacion:** `GET /preapproval/{id}` posterior **no incluye** `notification_url`.

El incremento de `version` **no** indica que el campo se haya guardado. Es una senal enganosa.

---

## P6 - `/preapproval/{id}` es de solo lectura tras el primer cobro

**Finding nuevo, no anticipated en el plan.**

| Operacion                                                 | Respuesta | Efecto real                        |
| --------------------------------------------------------- | --------- | ---------------------------------- |
| `PUT { "status": "cancelled" }`                           | HTTP 200  | Ninguno                            |
| `PUT { "status": "canceled" }`                            | HTTP 400  | `Invalid preapproval status param` |
| `PUT { "auto_recurring": { "transaction_amount": 150 } }` | HTTP 200  | Ninguno                            |

Verificacion por `GET` posterior: `status` sigue `authorized`, `transaction_amount` sigue `100.00`,
`last_modified` sin cambio (`12:05:13`).

**Ninguna de las dos grafias de "cancelled" funciona.** Con una L la API responde 400 invalido; con dos L
responde 200 y no hace nada.

### Impacto directo en el diseño vigente

El transversal (§6) y el design (§3.3) especifican:

```
PUT /preapproval/{id} { "status": "cancelled" }
```

**Eso no funciona.** Si T5 se implementa contra ese contrato, el boton de cancelar suscripcion no
cancela nada y devuelve 200 al usuario. Falso exito.

### Causa raiz probable

El preapproval ya fue facturado (`charged_quantity: 1`, `payment_method_id: visa`, `card_id` asignado).
MP bloquea la mutacion de preapprovals despues del primer cobro.

---

## El patron de fondo: 2xx silencioso

Cuatro operaciones independientes con el mismo comportamiento:

| Operacion                     | Codigo | Verificado por GET |
| ----------------------------- | ------ | ------------------ |
| `POST` + `notification_url`   | 201    | Campo ausente      |
| `PUT` + `notification_url`    | 200    | Campo ausente      |
| `PUT` + `status: "cancelled"` | 200    | Sin cambio         |
| `PUT` + `transaction_amount`  | 200    | Sin cambio         |

MP acepta el payload, devuelve exito y descarta el campo. Sin error, sin warning.

**Regla de ingenieria derivada:**

> Un `2xx` de MercadoPago no es evidencia de que la operacion se haya aplicado.
> Toda escritura contra MP debe verificarse con un `GET` posterior cuando la operacion tenga
> efecto de estado.

Esto aplica a la transicion de pago del webhook del storefront que ya esta en produccion:
`payment_id` como idempotency key es correcto, pero el `2xx` del webhook tampoco debe tomarse
como confirmacion del efecto.

---

## T9 - Job de polling: FALLBACK, no mecanismo unico

T9 ya estaba especificado en el transversal (§6): reintento automatico cada 5 minutos durante
2 horas, consultando `subscriptions` en `pending_first_payment` o `past_due`.

Con los hallazgos de P3, el polling es **mas simple de lo que se preveia**:

```
GET /authorized_payments/search?preapproval_id={mpPreapprovalId}
  -> results[]
  -> por cada payment: external_reference + status
```

Sin firma, sin idempotencia por `payment_id` recibido, sin replay.

**Latencia:** hasta 5 minutos en activacion inicial, en lugar de segundos.

**Estado de T9:** queda en el plan como **fallback documentado**. Se implementa **solo si** el
webhook en produccion tambien falla (H3). Si el webhook funciona, T9 no se construye.

### Riesgo abierto de T9 que no aplica si hay webhook

El objeto `authorized_payments` expone `payment.status` y `payment.status_detail`, pero **ningun
campo de chargeback, reversal ni disputa**. Se observaron unicamente `approved` / `accredited`.

| Situacion                           | Webhook | Polling           |
| ----------------------------------- | ------- | ----------------- |
| Alta, cobro, pausa, reactivacion    | Si      | Si                |
| Chargeback / disputa                | Si      | **No verificado** |
| Distinguir `approved` de `rejected` | Si      | **No verificado** |

Si T9 queda como mecanismo unico, estos dos casos quedan abiertos y deben investigarse antes
(estado de `/preapproval/{id}`, y endpoint de chargebacks de MP).

---

## Tareas afectadas

### T5 - Webhook handler: VUELVE A PLAN, con scope reducido

No invalidada, pero **reduced**. Para validar P1 no hace falta el handler completo: alcanza con
endurecer el stub actual (firma + limite de body + log sin PII), deployarlo a
`admin.landaetastudio.com` y pagar.

Las 8 transiciones de estado y la idempotencia solo hacen falta si el webhook resulta funcionar.

### T9 (nueva) - Job de polling de suscripciones

```
Cada 5 minutos:
  1. subscriptions en (pending_first_payment, past_due) con mpPreapprovalId no nulo
  2. GET /preapproval/{id} -> estado real (authorized / paused / cancelled)
  3. GET /authorized_payments/search?preapproval_id={id} -> pagos pendientes de aplicar
  4. Transaccion: actualizar status, activatedAt, lastPaymentAt
  5. Registrar mpPaymentId para idempotencia
  Ventana maxima: 2 horas desde la creacion, luego revision manual
```

**Dependencias:** T1 (indice unico parcial), T3 (esquema de `subscriptions`).

### Cancelacion y pausa de suscripcion: FUERA DE ALCANCE (Fase 2)

P6 demostro que `/preapproval/{id}` no acepta mutaciones tras el primer cobro. Sin una API de
MP que funcione, **no podemos prometer cancelacion ni pausa desde el panel**.

Opciones para el producto, a decidir antes de T4:

- (a) Fase 2 se limita a alta y cobro; cancelar/pausar es gestion manual en el panel de MP.
- (b) Investigar el endpoint correcto de MP para mutar estado (fuera del alcance de este spike).
- (c) Solicitar a MP documentacion del endpoint de gestion de suscripciones.

**Sin esto, el panel de suscripciones del admin no puede ofrecer un boton de cancelar.**

---

## Deuda tecnica a registrar

1. **D-40 (ALTA)** - `PUT /preapproval/{id}` no aplica mutaciones tras el primer cobro.
   Todo el spec de gestion de suscripciones queda sin backend. Bloquea T4/T5.
2. **D-41 (MEDIA)** - MP devuelve 2xx al descartar campos. Documentar la regla de
   verificacion por GET en el transversal y aplicarla al webhook de storefront existente.
3. **D-42 (MEDIA)** - Preview deploys con Auth desactivado son publicos. Si se mantiene esta
   configuracion para recibir webhooks, documentar el vector de exposicion.

---

## Payloads capturados

**Ninguno.** El endpoint stub nunca recibio un POST de MercadoPago.

Los unicos POSTs registrados en el preview fueron los controles del spike:

| Hora UTC | type            | action         | Origen                  |
| -------- | --------------- | -------------- | ----------------------- |
| 14:44:30 | `probe`         | `t0.selfcheck` | Spike (self-check)      |
| 14:44:57 | `probe`         | `t0.selfcheck` | Spike (self-check)      |
| 17:51:12 | (body invalido) | -              | Spike (probe anonimo)   |
| 18:16:48 | `ingest.probe`  | `t0.liveness`  | Spike (control ingesta) |

Los eventos esperados (`subscription_preapproval`, `subscription_authorized_payment`,
`payment.created`) **nunca llegaron**.

---

## Deuda / limpieza pendiente

Dos preapprovals de prueba quedaron activos en la cuenta de plataforma:

| Preapproval                        | Status     | Card            | Proximo cobro        |
| ---------------------------------- | ---------- | --------------- | -------------------- |
| `32f3e2a8575d4797a7841d98390e52bc` | authorized | visa/9801292088 | 2026-11-02 12:05 UTC |
| `f7b02efc00cb4638a0fe25da2013018d` | authorized | visa/9863037497 | 2026-11-02 14:11 UTC |

**La cancelacion por API no funciona (P6).** Deben cancelarse **desde el panel de MercadoPago**
o intentaran un segundo cobro el 2026-11-02.

---

## Artefactos del spike

- Stub: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (temporal, no es T5)
- Capturas locales: `.t0-captures/` (gitignored)
- Capturas en Vercel: `/tmp/webhook-captures` (efimero, inaccesible desde local)

El stub debe **eliminarse** si T5 se reemplaza por polling, o mantenerse como receptor de una
futura re-verificacion de MP.
