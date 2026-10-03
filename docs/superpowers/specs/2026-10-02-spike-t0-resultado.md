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

## Hipotesis alternativa - DESCARTADA (2026-10-02)

> **No hay ningun topic de suscripcion suscrito en el panel de MP.**

**Estado: descartada el 2026-10-02.** Luis marco TODOS los topics en el panel de MercadoPago
(`subscription_preapproval`, `subscription_authorized_payment` y `payment` legacy) y completo el
wizard "Configura tu integracion". Los webhooks de suscripciones **siguen sin llegar** con los
topics ya suscritos, lo que descarta esta hipotesis como causa de P1.

La app sigue mostrando "ETAPA 1 DE 5". Se interpreta como cosmetico o bug del panel de MP, no
como senal de topics sin suscribir: **"ETAPA 1 DE 5" no es un indicador fiable del estado de los
topics** y no debe usarse como signal en spikeos futuros.

> Nota de evidencia: el panel de MP es externo al repo. Este descarte no es reproducible desde el
> codigo; proviene de la verificacion manual reportada por el humano.

### Tabla de hipotesis

| #   | Hipotesis                                           | Estado                          | Como se descarta                                | Costo         |
| --- | --------------------------------------------------- | ------------------------------- | ----------------------------------------------- | ------------- |
| H1  | MP no entrega a preview domains                     | **VIVA** - no probada           | Apuntar el webhook a `admin.landaetastudio.com` | Deploy + pago |
| H2  | No hay topic de suscripcion suscrito                | **DESCARTADA** (2026-10-02)     | Topics marcados en el panel + wizard completo   | 5 minutos     |
| H3  | MP no entrega webhooks de suscripciones en absoluto | **CONDICIONAL** - depende de H1 | H1 descartada + H2 descartada                   | -             |

**El spike anterior concluyo H3 sin haber descartado H1 ni H2.** Esa fue la weakness del
analisis: se asumio que el topic estaba suscrito, y esa asuncion nunca se verifico. H2 ya fue
descartada; **H1 y H3 solo se distinguen con T5 desplegado en produccion**. Si H1 es la causa,
T9 (polling) queda como fallback documentado. Si se confirma H3, T9 pasa a ser obligatorio y la
fase crece de 10 a 12.5 dias.

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

> **Actualizado 2026-10-02.** La suscripcion a topics quedo resuelta: todos los topics estan
> marcados en el panel y el wizard esta completo. Verificar topics **no era** la causa. La causa
> sigue abierta entre H1 (preview domain) y H3 (MP no entrega), y solo T5 en produccion las
> separa.

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

---

# Resultados finales (2026-10-03)

> Esta seccion **reemplaza** las conclusiones de las secciones anteriores. El spike original
> corrio con una mezcla de cuentas que produjo tres conclusiones invertidas. Todo lo de arriba
> queda como registro de lo que se creia; lo de aca es lo que se verifico.

## Causa raiz de los falsos

El spike uso el token de la cuenta de prueba **Test-002** (`3360257364`) para crear los
preapprovals, mientras que la URL del webhook estaba registrada en la cuenta **plataforma real**
(`42922495`) y el secret en Vercel era el de esa misma cuenta plataforma.

Esa asimetria — **token de una cuenta, secret de otra** — produce dos sintomas distintos segun
donde se mire:

- Los eventos los firma la cuenta dueña del preapproval (Test-002) y se validan contra el secret
  de otra cuenta: **401 silencioso**.
- Las mutaciones se ejecutan con el token de una cuenta sobre un recurso que pertenece a otra:
  **2xx que no aplican nada**.

Con la cadena consistente (token y secret de Test-002, URL registrada en Test-002) **todo
funciona**. La regla que sale de esto:

> **`MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` tienen que ser de la MISMA cuenta,
> y la URL del webhook tiene que estar registrada en esa misma cuenta.**

## H1 — CONFIRMADA

MercadoPago **si entrega** webhooks de suscripciones a un dominio de produccion propio. Tres
eventos reales por pago, con **1 segundo de latencia**:

```
21:18:41.052  type=payment                         action=payment.created  dataId=181244133433  liveMode=true
21:18:41.510  type=subscription_authorized_payment  action=updated           dataId=7032544182     liveMode=null
21:18:42.524  type=subscription_preapproval        action=updated           dataId=25f8cf82...    liveMode=null
```

Verificacion cruzada contra la API: los tres `data.id` coinciden exactamente con
`payment.id`, `invoice` y `preapproval_id` respectivamente.

### Dos formas de payload

| Topic                             | `topLevelKeys`                                                          | `live_mode`           |
| --------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| `payment`                         | `action, api_version, data, date_created, id, live_mode, type, user_id` | **presente** (`true`) |
| `subscription_authorized_payment` | `action, application_id, data, date, entity, id, type, version`         | **ausente**           |
| `subscription_preapproval`        | `action, application_id, data, date, entity, id, type, version`         | **ausente**           |

**`live_mode` no existe en los topics de suscripcion.** El guard `live_mode === false` del design
solo aplica al topic `payment`.

### `data.id` significa tres cosas distintas (verificado)

| Topic                             | `data.id` es      | Se resuelve con                 |
| --------------------------------- | ----------------- | ------------------------------- |
| `payment`                         | id de pago        | `GET /v1/payments/{id}`         |
| `subscription_authorized_payment` | **id de invoice** | `GET /authorized_payments/{id}` |
| `subscription_preapproval`        | id de preapproval | `GET /preapproval/{id}`         |

### Orden de llegada

`payment` → `subscription_authorized_payment` → `subscription_preapproval`, en 1,5 s. **El evento
que activa la suscripcion es `subscription_authorized_payment`** (es el que trae la invoice) y
llega segundo. El design mapea el alta desde `subscription_preapproval`, que llega ultimo.

## P6 — REFUTADO

Las tres afirmaciones del spike original eranWrong o estaban incompletas:

| Afirmacion original                                          | Veredicto                                                |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `PUT {status:"cancelled"}` → 200 sin efecto                  | **FALSO. Aplica.** GET posterior devuelve `cancelled`    |
| `PUT {auto_recurring:{transaction_amount}}` → 200 sin efecto | **FALSO. Aplica.** GET posterior devuelve el monto nuevo |
| `PUT {status:"cancelled"}` → "read-only post-cobro"          | **FALSO.** No es read-only                               |

## Matriz de transiciones (verificada empiricamente)

| Transicion               | Resultado         | Evidencia                                           |
| ------------------------ | ----------------- | --------------------------------------------------- |
| `authorized → cancelled` | **200, aplica**   | GET: `cancelled`, `last_modified` avanza            |
| `cancelled → authorized` | **400**           | `"Invalid transition from cancelled to authorized"` |
| `authorized → paused`    | **200, aplica**   | GET: `paused`                                       |
| `paused → authorized`    | **200, aplica**   | GET: `authorized`                                   |
| `* → transaction_amount` | **200, aplica**   | GET: monto nuevo                                    |
| `* → notification_url`   | **200, descarta** | campo ausente en la respuesta y en el GET           |

**`cancelled` es terminal en MP.** No existe volver a `authorized`. **`paused` es el unico estado
reversible** y es lo que reemplaza al endpoint de reactivacion del plan.

### `next_payment_date` no es indicador

Al pausar y al cancelar, `next_payment_date` **no cambia**: sigue mostrando la proxima fecha.
Sirve para mostrar el proximo cobro, **no** para saber si la suscripcion va a cobrar.

## Como distinguir un 2xx que aplico de uno que no

El patron de "2xx silencioso" es real, pero `version` y `last_modified` dan la señal:

| Caso                                               | `version`     | `last_modified` |
| -------------------------------------------------- | ------------- | --------------- |
| `status: cancelled` (aplica)                       | avanza        | avanza          |
| `transaction_amount` (aplica)                      | avanza        | avanza          |
| `status: authorized` sobre un `authorized` (no-op) | **avanza**    | **avanza**      |
| `notification_url` (descartado)                    | **no avanza** | **no avanza**   |

Regla: **`version` y `last_modified` que no se mueven = MP descarto el campo.** Si se mueven,
MP proceso el payload — pero un no-op tambien los mueve, asi que no prueban que el _valor_
haya cambiado. Para eso, `GET`.

## P2 / P5 — CONFIRMADOS

`notification_url` **no persiste**, ni en `POST /preapproval` ni en `PUT /preapproval/{id}`. El
PUT devuelve 200 y el campo ni siquiera aparece en la respuesta. **La URL del webhook se
registra unicamente en el panel de MP.**

## Impacto en el plan

- **T9 (polling) queda cancelado.** El mecanismo funciona y entrega en 1 segundo.
- **T5 vuelve a ser el handler completo** (8 transiciones), no la sonda de 1 dia.
- **T4 cambia de scope:** sale `reactivate`, entran `pause` y `resume`. `cancel` queda como
  irreversible y la UI debe avisarlo.
