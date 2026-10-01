# Spec Fase 2 — Webhook de suscripciones + checkout dinámico

**Fecha:** 2026-10-01
**Versión:** 1.0
**Estado:** Draft para revisión humana
**Fuente de verdad de estados:** [2026-09-subscription-lifecycle.md](./2026-09-subscription-lifecycle.md)
**ADRs vinculantes:** [ADR-023](../../vault/01_ADRs/ADR-023-dos-flujos-mp.md), [ADR-024](../../vault/01_ADRs/ADR-024-pgcrypto-tokens.md)

> Este spec **no redefine** los 6 estados ni las 12 transiciones. Eso vive en el spec transversal y se referencia, no se duplica.

---

## 0. Correcciones al alcance propuesto

La verificación contra la documentación de MercadoPago (2026-10-01) y contra el código del repositorio encontró **tres supuestos incorrectos** del `sdd-propose`. Se corrigen acá porque cambian el contrato del handler.

### 0.1 La URL es fija — CONFIRMADO

MercadoPago registra **una URL literal** por aplicación y por modo (test / producción). No existe path templating: MP no conoce tenants y no sustituye `:tenantId`. Lo único variable que MP admite es el query param `?cliente=<seller>` para identificar cuentas.

**Spec:** `POST /api/webhooks/mercadopago/subscriptions` — sin parámetros de ruta.

### 0.2 `external_reference` NO viene en el payload — CORRECCIÓN

Este es el error más importante. El payload real de MP es:

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2015-03-25T10:04:58.396-04:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.created",
  "data": { "id": "999999999" }
}
```

No hay `external_reference`. Ese campo pertenece al **objeto preapproval**, y solo se obtiene consultando la API:

```
GET https://api.mercadopago.com/preapproval/{id}      → external_reference
GET https://api.mercadopago.com/v1/payments/{id}      → external_reference
```

**Consecuencia de diseño:** el handler necesita `MP_PLATFORM_ACCESS_TOKEN` y hace una llamada saliente a MP en cada webhook para resolver el `tenantId`. Eso agrega latencia y un modo de falla nuevo (MP caído → no se puede resolver el tenant). Se mitiga en §2.6.

### 0.3 Los nombres de evento son otros — CORRECCIÓN

El spec transversal y el propose usan nombres tipo `preapproval.created`, `payment.failed`, `preapproval.canceled`. Esos **no son los topics de MP**. Los topics reales para Suscripciones son:

| Topic de MP                       | Significado                               | `data.id` apunta a |
| --------------------------------- | ----------------------------------------- | ------------------ |
| `subscription_preapproval`        | Alta/baja/actualización de la suscripción | **preapproval**    |
| `subscription_authorized_payment` | Cobro recurrente (creación/actualización) | **payment**        |
| `payment`                         | Pagos ( también aplica a Suscripciones)   | **payment**        |
| `subscription_preapproval_plan`   | Planes de suscripción                     | preapproval_plan   |

El handler **no** debe hardcodear strings de evento sin verificar: despacha por `(type, action)`, resuelve la entidad según el topic, y ante una combinación desconocida responde `200` con log `warn` (no `500`), para no generar reintentos infinitos de MP.

Los literales exactos de `type`/`action` por topic están marcados en §2.4 como **PENDIENTE DE VERIFICAR** contra tráfico real. No se adivinan.

### 0.4 Restricción de MP: para Suscripciones la URL se define al crear el preapproval

MP desactiva la configuración por panel para integraciones de Suscripciones y obliga a pasar `notification_url` en el `POST /preapproval`. Esto **refuerza** el diseño de URL fija (0.1) y además nos da control explícito: si el dominio del panel cambia, hay que actualizar el código, no el panel de MP.

### 0.5 `back_url` es singular, no `back_urls`

`POST /preapproval` acepta **un** `back_url` (string). `back_urls: {success, failure, pending}` es de la API de Preferences (Checkout Pro), que es el otro flujo. El propose estaba mixing ambos contratos.

### 0.6 Los endpoints van en `apps/admin/`, no en `apps/storefront/`

| Evidencia                                                            | Implicación                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/storefront/proxy.ts` resuelve tenant por subdominio            | Un webhook de plataforma (por cuenta, no por tenant) no puede vivir ahí: se resolvería contra un tenant inexistente |
| `apps/admin` **no** tiene `proxy.ts`                                 | Es la app de plataforma                                                                                             |
| `apps/admin/app/api/shipping/route.ts:17` → `session.user?.tenantId` | La identidad del tenant sale del JWT, no del host                                                                   |
| `MP_PLATFORM_*` pertenece a la cuenta de la plataforma               | Las vars van en admin, no en storefront                                                                             |

**Spec:** los 5 endpoints de API y el webhook viven en `apps/admin/`. El storefront no se toca.

### 0.7 Reducción de alcance: el endpoint de checkout se funde con el de preapproval

El propose listaba `POST /api/subscriptions/preapproval` y `POST /api/checkout/subscription/preference` como endpoints separados. **Son la misma operación**: `POST /preapproval` ya devuelve `init_point`, que es la URL de checkout de la suscripción.

Se fusionan en **un** endpoint. Son 5 endpoints de API, no 6.

---

## 1. Contexto y objetivo

### 1.1 Situación actual

El data model está listo (`subscriptions`, `tenant_mp_config`, RLS, cifrado pgcrypto operativo). El checkout de **órdenes** del tenant está completo y testeado (Flujo B). No existe **ninguna** capa de API ni webhook para el Flujo A (suscripciones de la plataforma). Cero tests.

### 1.2 Objetivo de Fase 2

Habilitar el ciclo de vida de suscripción controlable por API y por webhook:

1. El tenant puede iniciar el pago de su suscripción y recibir una URL de checkout.
2. El tenant puede consultar el estado de su suscripción.
3. MP notifica cambios de estado y la plataforma los refleja en `subscriptions`.
4. El tenant puede cancelar, reactivar y cambiar de plan.

### 1.3 Fuera de alcance

**Fase 3 — Autoservicio**

- Landing de registro público, onboarding guiado
- UI del panel de suscripción (cambiar plan, historial, facturas)
- Templates de emails #1 (bienvenida) y #2 (pago confirmado)

**Fase 9 — Operación**

- Crons: `past_due → expired` (día 7), `pending_first_payment → abandoned` (día 7), borrado a 90 días
- Emails de dunning #3–#6 (día 0, 3, 5, 7)
- Reintento automático 5 min × 2 h, botón "Ya pagué, verificar"
- Facturación / recibos

**No se toca**

- Checkout de órdenes (Flujo B) — completo y testeado
- Webhook de órdenes — completo y testeado
- `tenant_mp_config` / cifrado (ADR-024) — implementado
- `proxy.ts` del storefront, RLS, `withTenantContext`, `DATABASE_APP_URL`

---

## 2. Contrato del webhook de suscripciones

### 2.1 Endpoint

```
POST /api/webhooks/mercadopago/subscriptions
```

En `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`.

Sin parámetros de ruta. Sin autenticación de sesión (es un endpoint público de servidor a servidor, igual que el webhook de órdenes existente).

### 2.2 Headers

| Header         | Obligatorio | Uso                                                    |
| -------------- | ----------- | ------------------------------------------------------ |
| `x-signature`  | Sí          | HMAC SHA-256. `ts=<epoch>,v1=<hex>`                    |
| `x-request-id` | No          | Entra al canonical string de la firma si está presente |
| `content-type` | —           | `application/json`                                     |

MP además manda `data.id` y `type` como **query params** (`?data.id=...&type=...`). El `data.id` del query param es el que cubre la firma.

> **Reutilización:** `verifyMercadoPagoSignature` de `@repo/commerce/webhook-signature` ya existe y ya tiene test. Se reutiliza sin cambios.
>
> **Diferencia con el webhook de órdenes:** el código actual de órdenes saca `dataId` del **body** (`extractDataId`). Acá se usa el **query param** `data.id` como fuente primaria, con fallback al body. Es el patrón que documenta MP.

### 2.3 Secret

`MP_PLATFORM_WEBHOOK_SECRET`. **Nunca** `MERCADOPAGO_WEBHOOK_SECRET` (ese es el del Flujo B, por tenant).

Si no está configurado → `503`, igual que el webhook de órdenes.

### 2.4 Resolución del tenant y de la entidad

Flujo del handler:

```
1. ¿MP_PLATFORM_WEBHOOK_SECRET configurado?        → no: 503
2. Leer rawBody (request.text())
3. ¿x-signature presente?                          → no: 401
4. Verificar HMAC con data.id del QUERY PARAM      → inválido: 401
5. Parsear body con Zod                            → inválido: 400
6. Determinar entidad según topic/type             → desconocido: 200 + warn
7. Consultar MP por la entidad (con platform token) → falla: 200 + warn (ver §2.6)
8. Leer external_reference de la respuesta de MP   → ausente/inválido: 200 + warn
9. Resolver tenantId → withTenantContext           → tenant inexistente: 200 + warn
10. Aplicar transición (§2.5)                      → siempre 200
```

**Punto clave del paso 8:** `external_reference` se valida como UUID v4. El valor se setea al crear el preapproval (§4.1). Si un preapproval fue creado fuera de esta app, su `external_reference` no será un UUID de tenant → se ignora con log, no se adivina.

**Literales de evento — PENDIENTE DE VERIFICAR en spike:**

| Topic de MP                       | `type` esperado | `action` esperados | Resolver con            |
| --------------------------------- | --------------- | ------------------ | ----------------------- |
| `subscription_preapproval`        | _a confirmar_   | _a confirmar_      | `GET /preapproval/{id}` |
| `subscription_authorized_payment` | _a confirmar_   | _a confirmar_      | `GET /v1/payments/{id}` |
| `payment` (suscripciones)         | _a confirmar_   | _a confirmar_      | `GET /v1/payments/{id}` |

Antes de `sdd-apply` hay que crear un preapproval de prueba en la cuenta de plataforma y capturar un webhook real para fijar estos literales. Sin ese spike, el handler se implementa con el mapeo por topic de la tabla de arriba (que sí está verificado) y no por `action`.

### 2.5 Transiciones aplicadas

Las transiciones son las del spec transversal §1 y §6. Este spec solo define **qué evento las dispara** y **qué columnas se tocan**.

| Evento                  | Estado previo           | Estado nuevo   | Columnas                                                                   | Ref. transversal |
| ----------------------- | ----------------------- | -------------- | -------------------------------------------------------------------------- | ---------------- |
| preapproval creado      | `pending_first_payment` | _(sin cambio)_ | `mpPreapprovalId`                                                          | §6 fila 1        |
| pago aprobado           | `pending_first_payment` | `active`       | `status`, `currentPeriodEnd = now()+1 month`, `lastProcessedPaymentId`     | §1, §4           |
| pago aprobado           | `past_due`              | `active`       | `status`, `currentPeriodEnd`, `lastProcessedPaymentId`                     | §1               |
| pago aprobado           | `expired`               | `active`       | `status`, `currentPeriodEnd`, `lastProcessedPaymentId`, `expiredAt → NULL` | §1, §4           |
| pago rechazado/fallido  | `active`                | `past_due`     | `status`                                                                   | §1               |
| pago rechazado/fallido  | `past_due`              | _(sin cambio)_ | — no reinicia el día 0                                                     | §6 fila 6        |
| preapproval cancelado   | `active` \| `past_due`  | `cancelled`    | `status`; `currentPeriodEnd` se mantiene                                   | §1, §2           |
| preapproval actualizado | cualquiera              | evaluar        | `planId`, `autoRecurring` si cambió el monto                               | §6 fila 8        |

Reglas transversales que se respetan:

- **Nunca** transicionar a un estado no listado en §1.
- `currentPeriodEnd` solo se setea al entrar a `active`; en `cancelled` se mantiene el valor; en `pending_first_payment` y `abandoned` es `NULL` (§4).
- Un pago aprobado sobre un tenant en `cancelled` **no** reactiva: la reactivación es explícita vía `POST /api/subscriptions/reactivate` (§3.4). MP no emite `payment.created` para eso.

### 2.6 Idempotencia

**Dos mecanismos, porque los eventos son de dos naturalezas:**

**a) Eventos de pago** → `lastProcessedPaymentId`

```
1. paymentId = data.id
2. si lastProcessedPaymentId === paymentId → 200, no hacer nada
3. si status ya es el estado destino → 200, no hacer nada
4. aplicar transición, setear lastProcessedPaymentId = paymentId → 200
```

Es la regla del spec transversal §6, textual.

**b) Eventos de preapproval** → convergencia de estado

`subscription_preapproval` no tiene `paymentId`, así que `lastProcessedPaymentId` no aplica. Estos eventos son idempotentes **por convergencia**: se compara el estado autoritativo de MP contra el estado en DB y solo se escribe si difieren. Reprocesar el mismo evento N veces produce el mismo resultado.

**c) Reentrega de MP sin efecto** — MP reintenta si no recibe 2xx. Todo camino que no pueda procesarse devuelve `200` con log `warn`, **nunca** `4xx`/`5xx`, para evitar un ciclo de reintentos. La única excepción es la firma inválida (`401`), que no debe reintentarse.

### 2.7 Modo test

- `live_mode: false` + `NODE_ENV=production` → `200` + log `info`, no procesar. MP manda pruebas a la URL de producción si están mal configuradas; no deben mover dinero real ni estados reales.
- **Magic IDs: NO se aplican a este webhook.** Los magic IDs del Flujo B (`123456789`, `000000`, `999999`) simulan _pagos de órdenes_. Para suscripciones hacen falta identificadores de _preapproval_ de prueba, que dependen de la cuenta de plataforma. El spike de §2.4 debe definir el mecanismo; si no es viable sin tocar la cuenta real, los tests de transición se cubren con mocks de `fetch` (que es el patrón que ya usa el webhook de órdenes).

---

## 3. Contrato de los endpoints de API

Todos en `apps/admin/app/api/subscriptions/`. Todos en `apps/admin/`.

**Autenticación (común a todos):** `auth()` de `@/lib/auth`. Sin sesión → `401`. Sin `session.user.tenantId` → `401`. El `tenantId` sale **siempre** del JWT, nunca del body ni de un query param.

**Tenant isolation:** toda query va dentro de `return await withTenantContext(tenantId, async (tx) => {...})` y usa `tx.`, nunca `db.` (AGENTS.md, ADR-022).

### 3.1 `POST /api/subscriptions/preapproval`

Crea la suscripción en MP y devuelve la URL de checkout. Fusiona el "checkout dinámico" del propose (§0.7).

**Request:** `{ planId: string }`

| Validación Zod | Detalle             |
| -------------- | ------------------- |
| `planId`       | `z.string().uuid()` |

**Flujo:**

1. `auth()` → `tenantId`
2. `MP_PLATFORM_ACCESS_TOKEN` presente y no vacío → si no: `500 { error: "MercadoPago no configurado" }`
3. Buscar suscripción del tenant dentro de `withTenantContext` → si no existe: `404`
4. `status` debe ser `pending_first_payment` o `abandoned` → si no: `409 { error, field: "status" }`
5. Buscar plan por `planId` en `plans` (tabla global, sin RLS) → si no existe o `isActive: false`: `404`
6. `POST /preapproval` a MP con `MP_PLATFORM_ACCESS_TOKEN`
7. Persistir `mpPreapprovalId` (y `planId`, `abandonedAt → NULL`) en `withTenantContext`
8. Devolver `init_point`

**Body MP enviado** (verificar nombres exactos contra la API en el spike):

```
reason, payer_email, external_reference (= tenantId),
back_url (singular), notification_url,
auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount }
```

`transaction_amount` = `plans.priceUyu` (ya en centavos, `integer`). No se divide por 100.

> **Decisión de diseño abierta (para `sdd-design`):** crear el preapproval **con** plan de MP (`preapproval_plan_id`, requiere un `POST /preapproval_plan` por tier) o **sin** plan (el monto viaja en `auto_recurring` desde nuestra tabla `plans`). Recomendación: **sin plan** en Fase 2 — menos entidades de MP que sincronizar, y la tabla `plans` ya es la fuente de verdad del precio. Tradeoff a documentar.

**Respuesta 200:** `{ initPoint, preapprovalId }`

| Código | Causa                                                                   |
| ------ | ----------------------------------------------------------------------- |
| `400`  | Body inválido (Zod)                                                     |
| `401`  | Sin sesión / sin `tenantId`                                             |
| `404`  | Suscripción no existe, o plan no existe / inactivo                      |
| `409`  | Estado actual no permite crear preapproval                              |
| `500`  | Token de plataforma ausente, o MP devuelve error (se propaga su status) |
| `503`  | Timeout de MP (patrón ya existente en `/checkout/preference`)           |

### 3.2 `GET /api/subscriptions`

**Request:** sin body.

**Respuesta 200:**

```json
{
  "status": "active",
  "planId": "...",
  "planName": "Pro",
  "currentPeriodEnd": "2026-11-01T00:00:00.000Z",
  "mpPreapprovalId": "...",
  "lastProcessedPaymentId": "...",
  "canWrite": true,
  "canChangePlan": true,
  "canCancel": true,
  "canReactivate": false
}
```

Los cuatro booleanos se derivan de la tabla de permisos del spec transversal §2. **No se duplica esa tabla acá**: se implementa como un helper único (`derivePermissions(status)`) que cite el transversal, para que exista un solo lugar donde cambie la política.

| Código | Causa                                      |
| ------ | ------------------------------------------ |
| `401`  | Sin sesión / sin `tenantId`                |
| `404`  | El tenant no tiene fila en `subscriptions` |

### 3.3 `POST /api/subscriptions/cancel`

**Request:** sin body.

**Flujo (textual del spec transversal §6):**

1. `auth()` → `tenantId`; suscripción dentro de `withTenantContext`
2. `status` debe ser `active` o `past_due` → si no: `409 { error, field: "status" }`
3. `mpPreapprovalId` presente → si no: `409`
4. `PUT /preapproval/{id}` con `status: "cancelled"` a MP
5. Si MP devuelve 4xx/5xx: log `event: "cancel_failed"`, responder `502`, **y NO transicionar**
6. Si MP acepta (2xx): responder `202 { status: "cancellationPending": true }`

**El estado NO cambia a `cancelled` en este endpoint.** Solo lo cambia el webhook `subscription_preapproval`. Esto es deliberado: evita que la UI diga "cancelada" cuando MP rechazó.

| Código | Causa                                         |
| ------ | --------------------------------------------- |
| `401`  | Sin sesión / sin `tenantId`                   |
| `404`  | Suscripción no existe                         |
| `409`  | Estado no cancelable, o sin `mpPreapprovalId` |
| `502`  | MP rechazó la cancelación                     |

### 3.4 `POST /api/subscriptions/reactivate`

**Request:** sin body.

| Estado previo                             | Permitido                                                        |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `cancelled` y `now() < currentPeriodEnd`  | Sí                                                               |
| `cancelled` y `now() >= currentPeriodEnd` | No (`409`)                                                       |
| `active`                                  | No (`409`)                                                       |
| `past_due`                                | No — la recuperación de `past_due` es por pago (§2.5), no manual |
| `pending_first_payment` / `abandoned`     | No — usar `POST /preapproval`                                    |

**Flujo:** `PUT /preapproval/{id}` con `status: "authorized"` → si 2xx: `202 { reactivationPending: true }`. El estado lo confirma el webhook.

| Código | Causa                                       |
| ------ | ------------------------------------------- |
| `401`  | Sin sesión / sin `tenantId`                 |
| `404`  | Suscripción no existe                       |
| `409`  | Estado no reactivable, o período ya vencido |
| `502`  | MP rechazó                                  |

### 3.5 `PUT /api/subscriptions/plan`

**Request:** `{ planId: string }` — Zod `.uuid()`.

**Precondición:** `status === "active"` (spec transversal §2: cambiar de plan solo desde `active`). Otro estado → `409 { field: "status" }`.

**Prorrateo (spec transversal §5, textual):**

```
crédito = (precio_actual × días_restantes / días_período) - (precio_nuevo × días_restantes / días_período)
```

- `días_restantes` = `currentPeriodEnd - now()` en días
- `días_período` = días del período actual (30 por defecto)
- `crédito > 0` → saldo a favor, se descuenta del próximo cobro
- `crédito < 0` → diferencia a cobrar
- **Downgrade NO acredita tiempo no usado** (política estándar SaaS, §5)

**Flujo:**

1. Validar precondiciones
2. Calcular prorrateo (función pura, testeable por separado)
3. `PUT /preapproval/{id}` con `auto_recurring.transaction_amount` = nuevo precio
4. Actualizar `planId` en `withTenantContext`
5. Responder `200 { previousPlanId, newPlanId, proratedAmountCents, direction: "upgrade" | "downgrade" }`

| Código | Causa                                                   |
| ------ | ------------------------------------------------------- |
| `400`  | Body inválido                                           |
| `401`  | Sin sesión                                              |
| `404`  | Suscripción o plan destino no existe                    |
| `409`  | Estado no permite cambio, o plan destino == plan actual |
| `502`  | MP rechazó                                              |

> **Discrepancia detectada, no resuelta en este spec:** el transversal §5 afirma que "MP Preapproval no soporta prorrateo nativo". La documentación de MP expone `billing_day_proportional` y `auto_recurring.billing_day_proportional` como soporte de prorrateo. **Se mantiene la política del transversal** (nuestra app calcula, MP solo ve el monto nuevo) porque es la decisión registrada, pero la contradicción queda señalada para resolverla en `sdd-design` con evidencia.

---

## 4. Contrato del checkout dinámico

No hay endpoint separado. El checkout de la suscripción **es** `POST /api/subscriptions/preapproval` (§0.7).

### 4.1 Params de MP relevantes

| Param                               | Valor                                                                  | Nota                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `external_reference`                | `tenantId` (UUID)                                                      | Es el **único** mecanismo para recuperar el tenant desde un webhook |
| `back_url`                          | `getAdminBaseUrl(request)` + `/suscripcion`                            | **Singular**, no `back_urls`                                        |
| `notification_url`                  | `getAdminBaseUrl(request)` + `/api/webhooks/mercadopago/subscriptions` | Obligatorio para Suscripciones (§0.4)                               |
| `auto_recurring.transaction_amount` | `plans.priceUyu`                                                       | Centavos, `integer`                                                 |
| `auto_recurring.frequency`          | `1`                                                                    |                                                                     |
| `auto_recurring.frequency_type`     | `"months"`                                                             |                                                                     |
| `payer_email`                       | Email del admin del tenant                                             | Requerido por MP                                                    |

**URLs públicas:** se derivan del request (`x-forwarded-proto` + `host`), nunca de una env fija (AGENTS.md). Para el panel admin ya debe existir un equivalente de `getStorefrontBaseUrl`; si no, se crea `getAdminBaseUrl` con el mismo patrón. **No usar `STOREFRONT_URL`.**

### 4.2 Rate limit

Aplica al crear preapproval: **10 requests / 60 s por IP**, fail-open si Redis no responde (mismo patrón y misma degradación que `POST /api/checkout/preference`, AGENTS.md). Clave: `rate_limit:subscription_preapproval:{ip}`.

No aplica a los otros 4 endpoints: son de baja frecuencia y requieren sesión.

### 4.3 Idempotencia de la creación

`POST /preapproval` **no** es idempotente: cada llamada crea una suscripción nueva en MP. Un doble click genera dos preapprovals y dos cobros recurrentes.

Mitigación: si la suscripción ya tiene `mpPreapprovalId` y el estado es `pending_first_payment`, el endpoint devuelve `409` con el `initPoint` existente en el body del error, en vez de crear otro. La UI navega al `initPoint` devuelto.

---

## 5. Cambios al data model

### 5.1 `subscriptions` — SIN CAMBIOS

Las 6 columnas que la fase necesita ya existen en `packages/db/src/schema.ts`:

| Columna                     | Para qué la usa Fase 2                    |
| --------------------------- | ----------------------------------------- |
| `mpPreapprovalId`           | Identificador de la suscripción en MP     |
| `currentPeriodEnd`          | Fin de período, base del prorrateo        |
| `lastProcessedPaymentId`    | Idempotencia de eventos de pago           |
| `expiredAt` / `abandonedAt` | Los setea Fase 9 (crons); se leen en §3.4 |
| `planId`                    | Plan actual                               |

**No hay migración en Fase 2.** Esto es intencionado: el baseline ya se diseñó para esto.

### 5.2 `tenant_mp_config` — NO SE TOCA

Es exclusivamente Flujo B (cobro del tenant a sus clientes). El Flujo A usa `MP_PLATFORM_*` de env. Confirma ADR-023: dos flujos, cero cruce de fondos.

### 5.3 Migración

**Ninguna.** Si el spike de §2.4 revela que hace falta una columna, se crea una migración nueva (append-only, `pnpm db:generate`). No se edita `0000_baseline.sql`.

---

## 6. Variables de entorno

| Variable                     | Ámbito     | Estado                   | Acción en Fase 2     |
| ---------------------------- | ---------- | ------------------------ | -------------------- |
| `MP_PLATFORM_ACCESS_TOKEN`   | admin      | En `.env.example`, vacía | Requerida en runtime |
| `MP_PLATFORM_WEBHOOK_SECRET` | admin      | En `.env.example`, vacía | Requerida en runtime |
| `MP_TOKEN_ENCRYPTION_KEY`    | todas      | Ya validada              | Sin cambios          |
| `MERCADOPAGO_*`              | storefront | Flujo B                  | Sin cambios          |

**Acciones:**

1. Agregar ambas a `packages/validation/src/env.ts` como **opcionales en dev, requeridas en producción** (mismo patrón que `MERCADOPAGO_WEBHOOK_SECRET`): si faltan en prod, la app falla al arrancar con error claro.
2. Agregar ambas a `turbo.json` → `tasks.build.env` (ya están ahí; confirmar).
3. Documentar en `SETUP.md`: cómo obtenerlas, y que la URL del webhook debe estar registrada con `notification_url` en cada preapproval.
4. `MP_PLATFORM_WEBHOOK_SECRET` es la **firma secreta** que MP genera en _Your integrations → Webhooks_, no una clave arbitraria.

---

## 7. Tests requeridos

Ubicación: `__tests__/` junto al archivo, según AGENTS.md.

### 7.1 Endpoints (`apps/admin/app/api/subscriptions/__tests__/`)

| Suite         | Casos mínimos                                                                                                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preapproval` | 200 crea y devuelve `initPoint`; 400 Zod; 401 sin sesión; 404 sin suscripción; 404 plan inactivo; 409 estado no permite; 409 `mpPreapprovalId` ya existe (no duplica); 500 sin token; 503 timeout; **`external_reference` enviado = `tenantId`**; `notification_url` enviado |
| `GET`         | 200 con los 4 permisos correctos por estado; 401; 404 sin suscripción                                                                                                                                                                                                        |
| `cancel`      | 202 cuando MP acepta (y **no** cambia el estado); 409 estado inválido; 409 sin `mpPreapprovalId`; 502 cuando MP rechaza (y **no** cambia el estado)                                                                                                                          |
| `reactivate`  | 202 desde `cancelled` dentro de período; 409 fuera de período; 409 desde `active`; 409 desde `past_due`; 502                                                                                                                                                                 |
| `plan`        | 200 upgrade con `proratedAmountCents > 0`; 200 downgrade; 409 no `active`; 409 mismo plan; 404 plan inexistente; 502                                                                                                                                                         |

**Helper de prorrateo:** función pura, suite propia con tabla de casos (upgrade día 1 / día 15, downgrade, período completo, `días_restantes` negativo). Casos textuales del transversal §5.

### 7.2 Webhook (`apps/admin/app/api/webhooks/mercadopago/subscriptions/__tests__/`)

| Grupo        | Casos                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firma        | 503 sin secret; 401 sin `x-signature`; 401 firma inválida; 401 timestamp expirado; **200 con `data.id` del query param**; 200 sin `x-request-id`; no bypasea en producción               |
| Resolución   | Consulta `GET /preapproval/{id}`; extrae `external_reference`; 200 + warn si `external_reference` no es UUID; 200 + warn si el tenant no existe; `live_mode: false` en prod → no procesa |
| Idempotencia | 2º `payment.created` con el mismo `paymentId` → no reprocesa; estado ya destino → no reprocesa; `subscription_preapproval` repetido → converge (1 sola escritura)                        |
| Transiciones | Las 8 filas de §2.5, cada una verificando estado **y** columnas tocadas                                                                                                                  |
| Desconocidos | `type`/`action` no reconocido → 200 + warn, sin escrituras                                                                                                                               |
| Aislamiento  | Transición escribe solo dentro del `tenantId` del `external_reference`                                                                                                                   |

**Cross-tenant es un test obligatorio, no opcional:** un preapproval del tenant A no puede mover la suscripción del tenant B.

### 7.3 Regresión

`pnpm test` completo debe quedar verde. Los 61 tests existentes de checkout de órdenes y webhook de órdenes **no se tocan**.

### 7.4 Cobertura

≥ 80% en código nuevo (`apps/admin/app/api/subscriptions/**` y el webhook). `pnpm test --coverage`.

### 7.5 E2E

Fuera de alcance de Fase 2 (requiere cuenta MP real configurada). Se propone para Fase 9. El spike de §2.4 es el sustituto: verificación manual con un preapproval real.

---

## 8. Edge cases

| #   | Caso                                                  | Comportamiento requerido                                                                                                                                                  | Cláusula        |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | Firma inválida                                        | `401`, sin tocar DB, sin llamar a MP                                                                                                                                      | §2.2            |
| 2   | Timestamp fuera de tolerancia (300 s)                 | `401`                                                                                                                                                                     | §2.2            |
| 3   | Replay: mismo `paymentId` dos veces                   | 2ª vez `200` sin escribir                                                                                                                                                 | §2.6a           |
| 4   | Replay: mismo `subscription_preapproval`              | Converge, 1 sola escritura                                                                                                                                                | §2.6b           |
| 5   | `external_reference` ausente o no-UUID                | `200` + `warn`, sin procesar                                                                                                                                              | §2.4            |
| 6   | `external_reference` de un tenant inexistente         | `200` + `warn`, sin procesar                                                                                                                                              | §2.4            |
| 7   | Tenant **sin** `tenant_mp_config`                     | **No aplica a Flujo A.** El Flujo A usa `MP_PLATFORM_*` de env; `tenant_mp_config` es del Flujo B. Un tenant sin MP configurado puede perfectamente pagar su suscripción. | ADR-023         |
| 8   | Webhook de un preapproval ajeno (otro tenant)         | El `external_reference` manda: se resuelve ese tenant, no otro. Cross-tenant isolation en DB igual.                                                                       | §7.2            |
| 9   | Cancelación: MP rechaza                               | `502`, **estado no cambia**, log `cancel_failed`, tenant puede reintentar                                                                                                 | §3.3            |
| 10  | Cancelación: MP acepta pero el webhook nunca llega    | Estado queda como estaba. Reconciliación manual. La UI muestra "procesando" por el `202`.                                                                                 | §3.3            |
| 11  | Cambio de plan: cálculo de prorrateo incorrecto       | Test de tabla con los casos del transversal §5 + función pura testeable                                                                                                   | §3.5            |
| 12  | Cambio de plan: MP acepta pero el webhook no confirma | `planId` ya actualizado; el webhook no re-escribe `planId` salvo que el monto difiera.                                                                                    | §2.5 fila 8     |
| 13  | Doble click en "contratar"                            | `409` con `initPoint` existente, no crea un segundo preapproval                                                                                                           | §4.3            |
| 14  | Redis caído durante rate limit                        | Fail-open: permite el request, `logger.warn`. Nunca 500.                                                                                                                  | §4.2, AGENTS.md |
| 15  | MP caído durante el webhook                           | `200` + `warn` (no 5xx, para no generar reintentos). Queda pendiente de reconciliación.                                                                                   | §2.6c           |
| 16  | MP devuelve 429 (rate limit propio)                   | Respetar `Retry-After` con backoff acotado; si agota, `200` + `warn`.                                                                                                     | §2.6c           |
| 17  | `live_mode: false` en producción                      | `200` + `info`, no procesar                                                                                                                                               | §2.7            |

---

## 9. Estados y transiciones

**No se redefinen.** Fuente única: [spec transversal §1 y §2](./2026-09-subscription-lifecycle.md).

Resumen referencial (no normativo — la norma es el transversal):

| Estado                  | Origen                               | En Fase 2                                    |
| ----------------------- | ------------------------------------ | -------------------------------------------- |
| `pending_first_payment` | Registro del tenant                  | Se crea el preapproval, se espera el pago    |
| `active`                | Pago aprobado                        | Se puede cambiar plan, cancelar              |
| `past_due`              | Pago fallido                         | Se recupera sola con `payment.created`       |
| `cancelled`             | `subscription_preapproval` cancelado | Se reactiva hasta `currentPeriodEnd`         |
| `expired`               | Cron Fase 9                          | Transición de regreso por pago sí se soporta |
| `abandoned`             | Cron Fase 9                          | Se puede rehacer con `POST /preapproval`     |

Las columnas `expiredAt` y `abandonedAt` las setean los crons de Fase 9. Fase 2 solo las lee (§3.4) y limpia `abandonedAt` al rehacer el pago inicial.

---

## 10. Dependencias previas a `sdd-apply`

| #   | Dependencia                                                                                                  | Bloqueante                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 1   | `MP_PLATFORM_ACCESS_TOKEN` en Vercel (admin)                                                                 | **Sí**                                              |
| 2   | `MP_PLATFORM_WEBHOOK_SECRET` en Vercel (admin) — la firma que genera MP en _Your integrations → Webhooks_    | **Sí**                                              |
| 3   | **Spike**: preapproval real en la cuenta de plataforma, capturar un webhook, fijar literales `type`/`action` | **Sí**                                              |
| 4   | `notification_url` alcanzable (HTTPS pública) desde MP                                                       | **Sí**                                              |
| 5   | `pgcrypto` en Neon                                                                                           | No — ya en el baseline                              |
| 6   | `DATABASE_APP_URL`                                                                                           | No — ya validada                                    |
| 7   | Existencia de filas en `plans` con `priceUyu` real                                                           | **Sí** — sin precio cargado no hay monto que cobrar |

---

## 11. Estimación

| Bloque                                             | Días        |
| -------------------------------------------------- | ----------- |
| Setup: env vars, validación Zod, `getAdminBaseUrl` | 0.5         |
| Spike de §2.4 (fijar literales de evento)          | 0.5         |
| `POST /preapproval` + helper de prorrateo          | 1.5         |
| `GET` + helper de permisos                         | 0.5         |
| `cancel` / `reactivate` / `plan`                   | 1.5         |
| Webhook: resolución, idempotencia, 8 transiciones  | 2.5         |
| Tests (5 endpoints + webhook + prorrateo)          | 2.5         |
| Docs (SETUP, AGENTS si aplica)                     | 0.5         |
| **Total**                                          | **10 días** |

**vs. 10-12 del propose:** se reduce ~1-2 días por la fusión de §0.7 (un endpoint menos) y por no necesitar migración. Sin recorte de funcionalidad core.

---

## 12. Preguntas abiertas para `sdd-design`

1. **Literales `type`/`action`** — bloqueado hasta el spike (§2.4). El handler se diseña tolerante mientras tanto.
2. **Preapproval con plan de MP o sin plan** — recomendación §3.1: sin plan.
3. **Prorrateo nativo de MP vs. cálculo propio** — el transversal §5 dice propio; MP expone `billing_day_proportional`. Decidir con evidencia (§3.5).
4. **Líneas de `back_url` / `notification_url`** — confirmar contra la API real si `notification_url` y `back_url` coexisten en `POST /preapproval` o si MP espera otro nombre para suscripciones.
5. **`derivePermissions(status)`** — ubicación: `@repo/commerce` (reutilizable por Fase 3) o en el handler de admin. Depende de si Fase 3 lo consume.
6. **Magic IDs para suscripciones** — decidir si vale la pena contra la cuenta real, o si los tests con `fetch` mockeado son suficientes (§2.7).

---

## 13. Referencias

| Documento                                                                         | Uso                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Spec transversal 2026-09](./2026-09-subscription-lifecycle.md)                   | Estados, transiciones, prorrateo, idempotencia, emails, retención |
| [Blueprint v2.6](./2026-09-blueprint-v2.6.md)                                     | Contexto de Fase 2                                                |
| [ADR-023](../../vault/01_ADRs/ADR-023-dos-flujos-mp.md)                           | Dos flujos MP independientes                                      |
| [ADR-024](../../vault/01_ADRs/ADR-024-pgcrypto-tokens.md)                         | Cifrado de tokens (Flujo B, no aplicado aquí)                     |
| [ADR-022](../../vault/01_ADRs/)                                                   | RLS en `subscriptions`                                            |
| `packages/commerce/src/webhook-signature.ts`                                      | Verificación HMAC a reutilizar                                    |
| `apps/storefront/app/api/webhooks/mercadopago/route.ts`                           | Patrón de webhook a espejar (Flujo B)                             |
| `apps/storefront/app/api/checkout/preference/route.ts`                            | Patrón de rate limit y llamada a MP                               |
| Docs MP: `POST /preapproval`, `PUT /preapproval/{id}`, _Subscriptions → Webhooks_ | Contrato de la API                                                |
