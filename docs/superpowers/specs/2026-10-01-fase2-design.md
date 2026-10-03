# Design Fase 2 — Webhook de suscripciones + checkout dinámico

**Fecha:** 2026-10-01
**Versión:** 1.0
**Estado:** Draft para revisión humana
**Spec (fuente de verdad del QUÉ):** [2026-10-01-fase2-webhook-checkout.md](./2026-10-01-fase2-webhook-checkout.md)
**Estados:** [spec transversal](./2026-09-subscription-lifecycle.md) §1-2 (no se redefinen)

> Este documento define el **CÓMO**. No cambia el QUÉ del spec.
> **No se reescribe el spec transversal.** Los 2 errores detectados se reportan para un PR aparte.

---

## 0. Corrección al spec: el endpoint de resolución de pagos

Al verificar la tabla oficial _topic → API_ de MercadoPago para Suscripciones, encontré que el spec (§2.4) asignó el endpoint equivocado para eventos de cobro recurrente.

**Tabla oficial verificada (2026-10-01):**

| Topic de MP                       | Endpoint oficial para resolver                                                 | Devuelve `external_reference`                                     |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `payment`                         | `GET /v1/payments/{id}`                                                        | **Sí** (confirmado: el webhook de órdenes de este repo ya lo lee) |
| `subscription_preapproval`        | `GET /preapproval/search` _(docs)_ · `GET /preapproval/{id}` _(API reference)_ | **Sí** (confirmado en el response de ejemplo)                     |
| `subscription_authorized_payment` | `GET /authorized_payments/{id}`                                                | **⚠️ NO VERIFICADO**                                              |

**Corrección:** el spec decía que `subscription_authorized_payment` se resolvía con `GET /v1/payments/{id}`. **Es falso.** MP usa un tercer recurso, `/authorized_payments/{id}` ("Get invoice data"), que es un objeto distinto al de Payments.

**Por qué importa más allá del nombre:** no está verificado que `/authorized_payments/{id}` devuelva `external_reference` **ni** `preapproval_id`. Si no devuelve ninguno de los dos, no hay forma de saber a qué tenant pertenece un cobro recurrente, y el webhook no se puede enrutar. Ese es el **riesgo #1 de Fase 2** y el motivo de que el spike sea bloqueante (§2.1).

---

## 1. Arquitectura general

### 1.1 Dos flujos, dos apps

```
┌─────────────────────────────────────────────────────────────────┐
│  PLATAFORMA (LandaetaStudio)          apps/admin/               │
│                                                                 │
│  Tenant (admin autenticado)                                     │
│       │                                                         │
│       ├─► POST /api/subscriptions/preapproval                   │
│       │      └─► POST api.mercadopago.com/preapproval  ──────┐  │
│       │          · external_reference = tenantId               │  │
│       │          · back_url = <admin base>/suscripcion        │  │
│       │          · (notification_url ELIMINADO - ver §2.4)    │  │
│       │      ◄── init_point                                    │  │
│       │                                                         │  │
│       ├─► GET    /api/subscriptions          → estado+permisos  │  │
│       ├─► POST   /api/subscriptions/cancel   ─► PUT /preapproval│  │
│       ├─► POST   /api/subscriptions/reactivate ─► PUT /preappro│  │
│       └─► PUT    /api/subscriptions/plan     ─► PUT /preapproval│
│                                                                 │
│  MP ──► POST /api/webhooks/mercadopago/subscriptions ──────────┼─┐
│         (URL FIJA — ver §3.3)                                  │ │
│           1. firma HMAC (MP_PLATFORM_WEBHOOK_SECRET)            │ │
│           2. parse Zod → type, action, data.id, live_mode       │ │
│           3. clasificar topic → entidad + strategia            │ │
│           4. resolver tenantId  ─────────────┐                 │ │
│           5. withTenantContext(tenantId)     │                 │ │
│           6. transición idempotente          │                 │ │
│           7. SIEMPRE 200 (salvo firma)      │                 │ │
└─────────────────────────────────────────────┼─────────────────┼─┘
                                              │                 │
                    ┌─────────────────────────┘                 │
                    │                                           │
      Estrategia L: mpPreapprovalId (local, sin llamar a MP)   │
      Estrategia R: GET a MP → external_reference | preapproval_id
                    │                                           │
                    └──────────► resolveTenant() ◄──────────────┘
```

### 1.2 Flujo feliz: alta de suscripción

```
tenant                admin API           MP                    webhook
  │                      │                 │                        │
  │ POST preapproval     │                 │                        │
  ├─────────────────────►│ POST /preapproval                        │
  │                      ├────────────────►│                        │
  │                      │  id, init_point │                        │
  │◄── initPoint ────────┤                 │                        │
  │                      │ UPDATE mpPreapprovalId                   │
  │                      │ (dentro de withTenantContext)             │
  │ redirige a MP ───────┼────────────────►│                        │
  │ paga                 │                 │                        │
  │                      │                 │ preapproval.created    │
  │                      │                 ├───────────────────────►│
  │                      │                 │   + payment.authorized │
  │                      │                 ├───────────────────────►│
  │                      │                 │                        │ resolver tenant
  │                      │                 │ ◄── GET (si hace falta)┤ status=active
  │                      │                 ├──────────────────────►│ currentPeriodEnd
  │                      │                 │                        │ = now()+1mes
  │                      │  200            │                        │ 200
```

### 1.3 Frontera de confianza

| Zona             | Confianza                            | Contiene                                             |
| ---------------- | ------------------------------------ | ---------------------------------------------------- |
| Body del webhook | **No confiable** hasta validar firma | `type`, `action`, `data.id`, `live_mode`             |
| Respuesta de MP  | **Autoritativa**                     | `external_reference`, `status`, `auto_recurring`     |
| DB local         | **Fuente de verdad del dominio**     | `subscriptions.status`, `planId`, `currentPeriodEnd` |

**Regla:** ningún campo del body del webhook decide una transición por sí solo. El body ** enruta**; la respuesta de MP ** decide**; la DB ** concuerda**. Si las tres no pueden ponerse de acuerdo, no se transiciona y se loguea.

---

## 2. Decisiones técnicas

### 2.1 D1 — Resolución del tenant: dos estrategias ★

**Decisión:** el handler resuelve el `tenantId` con un `resolveTenant(entityId, topic)` que aplica estrategias en orden.

| Topic                             | Estrategia     | Costo                           | Requiere MP caído |
| --------------------------------- | -------------- | ------------------------------- | ----------------- |
| `subscription_preapproval`        | **L** (local)  | ~5 ms, 1 query indexada         | **No**            |
| `subscription_authorized_payment` | **R** (remota) | ~200-400 ms, 1 GET              | **Sí**            |
| `payment` (suscripciones)         | **R** (remota) | ~200-400 ms, 1 GET              | **Sí**            |
| `subscription_preapproval_plan`   | —              | Fase 2 lo ignora (`200`+`info`) | —                 |

**Estrategia L — resolución local (preapprovals):**

```
SELECT tenantId FROM subscriptions WHERE "mpPreapprovalId" = $1
```

`subscriptions` ya tiene `mpPreapprovalId` + `tenantId`, con **una fila por tenant** (`subscriptions_tenant_idx` es UNIQUE). El mapeo `preapproval_id → tenant_id` **ya existe en la base**. No hace falta tabla nueva ni columna nueva.

**Estrategia R — resolución remota (cobros):**

```
GET /authorized_payments/{id}   (o /v1/payments/{id})
  → si trae external_reference  → usar
  → si trae preapproval_id      → Estrategia L con ese id
  → si no trae ninguno          → 200 + warn, no procesar (§3.5)
```

**Por qué no una tabla `mpInvoiceId → tenantId`:**

La alternativa que planteaste (tabla nueva) tiene un consumidor real solo si el spike muestra que `/authorized_payments` **no** expone ni `external_reference` ni `preapproval_id`. Construirla preventivamente es pagar complejidad sin consumidor. MP **necesita** vincular la factura a la suscripción para cobrarla, así que el vínculo existe en algún campo.

**Regla de decisión post-spike:**

| Resultado del spike                             | Acción                                                                                                | Costo                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------ |
| `authorized_payments` trae `external_reference` | Estrategia R directa                                                                                  | 0                        |
| trae `preapproval_id` (o `preapproval.id`)      | Estrategia R → L encadenada                                                                           | 0                        |
| **no trae ninguno**                             | **Agregar tabla `subscription_payments`** (`tenantId`, `mpInvoiceId` UNIQUE, `status`, `processedAt`) | **+1 día, +1 migración** |

Este es el **único** escenario que suma migración. Está definido, estimado y es el motivo del spike.

**Degradación:** si ninguna estrategia resuelve → `200` + `warn` con el `entityId` y el topic. Se responde `200` (no 5xx) para no generar reintentos de MP, y el evento queda registrado en logs para la reconciliación de Fase 9.

---

### 2.2 D2 — Preapproval SIN plan de MP

**Decisión:** crear el preapproval **sin** `preapproval_plan_id`. El monto viaja en `auto_recurring.transaction_amount`.

**Justificación:**

| Criterio                                                | Con plan de MP                                   | Sin plan de MP                       |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Fuentes de verdad del precio                            | **2** (tabla `plans` + `preapproval_plan` en MP) | **1** (tabla `plans`)                |
| Entidades MP a sincronizar                              | 1 por tier + N suscripciones                     | N suscripciones                      |
| Qué pasa si el admin cambia el precio en el panel de MP | Desincronización silenciosa                      | Imposible: MP no tiene precio propio |
| Cambio de plan                                          | `PUT` al preapproval **y** al plan               | `PUT` al preapproval                 |
| Operación de Fase 3                                     | Panel de planes en MP                            | Ninguna                              |

`plans` es la fuente de verdad del precio porque es lo que el tenant _ve_ en el panel y lo que efectivamente se le cobra. Un `preapproval_plan` en MP sería un espejo que nadie lee.

**Trade-off aceptado:** se pierde la posibilidad de que MP gestione prorrateo nativo a nivel de plan (ver D3). Como D3 resuelve el prorrateo en nuestra app, no se pierde nada.

**Requisito de MP:** sin plan, `reason` pasa a ser obligatorio (la doc dice: _"It is only required for subscriptions without a plan"_). Se manda `reason: "Suscripción <planName>"`.

---

### 2.3 D3 — Prorrateo: cálculo propio (se mantiene la decisión registrada)

**Decisión:** se mantiene el cálculo propio del spec transversal §5.

**Evidencia en contra (debe ir al PR de actualización del transversal):**

> El transversal §5 afirma: _"MP Preapproval no soporta prorrateo nativo. La lógica la maneja nuestra app."_
> La doc de MP expone `auto_recurring.billing_day_proportional` y una página dedicada _"Proportional amount (proration)"_. **La afirmación del transversal es incorrecta.**

**Por qué se mantiene igual, de todas formas:**

1. Es la decisión **registrada** y auditada. Cambiarla en un design sin revisar es exactamente el tipo de deriva que el ADR evita.
2. `billing_day_proportional` proratea el **primer cobro** según el día de alta; no implementa la fórmula de crédito/diferencia entre dos planes del transversal §5.
3. Nuestra fórmula produce un número que le mostramos al tenant en el `PUT /plan` (`proratedAmountCents`). MP no nos da ese número.
4. La fórmula es una función pura: testeable sin MP, sin red, sin reloj externo. `billing_day_proportional` solo se puede verificar con un preapproval real.

**Acción:** se reporta a Luis. El transversal se actualiza en un PR aparte con la evidencia. Si más adelante se quiere `billing_day_proportional`, es un enhancement, no un fix.

**Fórmula (textual del transversal §5, sin cambios):**

```
crédito = (precioActual × díasRestantes / díasPeríodo)
        - (precioNuevo   × díasRestantes / díasPeríodo)
```

`díasRestantes = currentPeriodEnd - now()` · `díasPeríodo = 30` (constante, ver §10)

---

### 2.4 D4 — `back_url` y `notification_url` ★ RESUELTO POR T0

**`back_url` — CONFIRMADO.** Aparece en el body de `POST /preapproval` y en `PUT /preapproval/{id}` ("Successful return URL"). Es **singular**. El design lo usa así.

**`notification_url` — CONFIRMADO QUE NO EXISTE. Eliminar del design.**

El spike T0 lo probó empíricamente en lugar de dejarlo bloqueado:

| Operación                                      | Respuesta | Verificación por `GET` |
| ---------------------------------------------- | --------- | ---------------------- |
| `POST /preapproval` con `notification_url`     | HTTP 201  | campo **ausente**      |
| `PUT /preapproval/{id}` con `notification_url` | HTTP 200  | campo **ausente**      |

MP acepta el campo, devuelve éxito y **lo descarta en silencio**. Confirmado en dos preapprovals.

**Consecuencia:** el body de `POST /preapproval` **no debe llevar `notification_url`**. La URL del
webhook se configura **únicamente en el panel de MP** (_Your integrations → Webhooks_), contra un
endpoint en el **dominio de producción** (`admin.landaetastudio.com`).

**Regla derivada (aplicar a toda escritura contra MP):** un `2xx` no es evidencia de que la
operación se aplicó. Toda escritura con efecto de estado debe verificarse con un `GET` posterior.

**Diseño final:**

```
POST /preapproval
  body: {
    ...,
    back_url: <adminBase>/suscripcion
    // notification_url: ELIMINADO - T0 demostro que MP lo descarta en silencio
  }
```

El webhook se registra **una sola vez**, en el panel de MP, apuntando a
`https://admin.landaetastudio.com/api/webhooks/mercadopago/subscriptions` con los topics
`subscription_preapproval` + `subscription_authorized_payment`.

**Pendiente de validar en T5 (producción):** que MP entregue esos topics contra un dominio de
producción. El spike T0 solo pudo probar contra un preview domain de Vercel y **no** recibió
entrega. Hipótesis abiertas: dominio preview no permitido (H1) o ningún topic suscrito (H2).
Ver `2026-10-02-spike-t0-resultado.md`.

**Restricción operativa (actualizada por T0):** la URL del webhook **no se construye del request**
ni se manda en el body del preapproval. Es un valor fijo del panel de MP apuntando a
`admin.landaetastudio.com`. Esto **elimina** la restricción de "si el dominio cambia hay que
redeployar" y también el procedimiento de migración vía `PUT` (P2/P5 demostraron que
`notification_url` no se persiste por ningún método).

---

### 2.5 D5 — `derivePermissions` en `@repo/commerce`

**Decisión:** va en `packages/commerce/src/subscription-permissions.ts`, exportado como `derivePermissions(status)`.

**Justificación:**

| Criterio                                 | `@repo/commerce`                                            | En el handler de admin                                    |
| ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Fase 3 (panel de suscripción) lo consume | **Sí** — la UI admin lo necesita                            | Tendría que duplicarlo o importar de un route handler     |
| Implementa política del transversal §2   | Correcto: `commerce` es donde vive la lógica de negocio     | Inconsistente: una política de negocio en un handler HTTP |
| ¿Quién más?                              | `middleware` de admin puede necesitarlo para bloquear rutas | —                                                         |

`commerce` ya es el hogar de la lógica de negocio del proyecto (carrito, emails, tenant, redis, cifrado, firma). Una tabla de permisos de suscripción es exactamente eso.

**Interfaz:**

```
derivePermissions(status: SubscriptionStatus): {
  canWrite: boolean
  canChangePlan: boolean
  canCancel: boolean
  canReactivate: boolean
  canAccessStorefront: boolean
  canAccessPanel: 'full' | 'limited' | 'readonly' | 'none'
}
```

**Fuente única:** el mapeo se transcribe del transversal §2 y se referencia en un comentario. Si el transversal cambia, esta función cambia en el mismo PR. El comentario apunta al §, no copia la tabla entera.

**Tests:** tabla de 6 casos (un por estado) contra los valores del transversal §2. Si alguien cambia la política sin actualizar el transversal, el test no falla — por eso el comentario referencia la sección.

---

### 2.6 D6 — Magic IDs: NO. `fetch` mockeado

**Decisión:** no hay magic IDs para suscripciones. Los tests mockean `fetch`.

**Justificación:**

| Criterio                                          | Magic IDs          | `fetch` mockeado                                      |
| ------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| Requiere cuenta MP real con preapproval de prueba | **Sí**             | No                                                    |
| Reproducible en CI                                | No (MP es externo) | **Sí**                                                |
| Cubre la resolución (Estrategia L / R)            | No                 | **Sí**                                                |
| Cubre los 3 resultados del spike (§2.1)           | No                 | **Sí**                                                |
| Patrón ya establecido en el repo                  | —                  | **Sí** (`fetchPaymentDetails` del webhook de órdenes) |

Los magic IDs del Flujo B (`123456789`/`000000`/`999999`) simulan **pagos de órdenes**. Para suscripciones habría que registrar preapprovals reales en la cuenta de plataforma y usar sus ids — acopla los tests a un recurso externo mutable.

**Cobertura real:** el spike verifica el contrato contra MP. Los tests verifican la lógica. La línea queda cubierta por el spike + Fase 9 (E2E con cuenta real).

**Excepción:** `live_mode: false` + `NODE_ENV=production` se testea con un body crafted (no necesita MP).

---

### 2.7 D7 — Mapeo local: índice único parcial

**Decisión:** agregar **un índice único parcial** sobre `subscriptions."mpPreapprovalId"`.

```sql
CREATE UNIQUE INDEX subscriptions_mp_preapproval_idx
  ON subscriptions ("mpPreapprovalId")
  WHERE "mpPreapprovalId" IS NOT NULL;
```

**Justificación:**

- **Es la ÚNICA migración de Fase 2.** Sin columna nueva, sin tabla nueva.
- **Integridad:** hace imposible que dos tenants compartan un `preapproval_id`. Hoy nada lo impide: `mpPreapprovalId` es `text` sin índice. Si se duplicara, la Estrategia L devolvería 2 filas → ambigüedad → no se enruta. El índice convierte un bug silencioso en un error de insert.
- **Lookup:** convierte un seq scan en un index scan.

**Honestidad sobre el rendimiento:** a escala MVP (decenas de tenants, 1 fila por tenant) un seq scan sobre una tabla de 100 filas es sub-milisegundo. **El índice NO se justifica por performance.** Se justifica por integridad. Si mañana hay 100k tenants, el índice ya está.

**¿Por qué parcial?** `mpPreapprovalId` es NULL hasta que el tenant contrata. Un UNIQUE normal en PostgreSQL ya trata NULLs como distintos, pero el `WHERE` lo hace explícito y más barato de mantener.

**Reconciliación Fase 9:** el job de reintento (transversal §6) va en la dirección **suscripción → MP** (`subscriptions` en `pending_first_payment`/`past_due` → `GET /preapproval/{id}`). Esa dirección ya está cubierta por `mpPreapprovalId` en la fila. La tabla nueva que contemplates (invoice → tenant) solo sirve en la dirección inversa, y §2.1 explica por qué se difiere.

---

## 3. Contratos de MP

### 3.1 `POST /preapproval` — crear suscripción

```
POST https://api.mercadopago.com/preapproval
Authorization: Bearer {MP_PLATFORM_ACCESS_TOKEN}
Content-Type: application/json
```

| Campo                               | Valor                      | Estado                                             |
| ----------------------------------- | -------------------------- | -------------------------------------------------- |
| `reason`                            | `"Suscripción {planName}"` | **Confirmado** — requerido sin plan                |
| `payer_email`                       | `session.user.email`       | **Confirmado** — requerido                         |
| `external_reference`                | `tenantId`                 | **Confirmado** — campo free-text de sync           |
| `back_url`                          | `{adminBase}/suscripcion`  | **Confirmado** — singular                          |
| `auto_recurring.frequency`          | `1`                        | **Confirmado**                                     |
| `auto_recurring.frequency_type`     | `"months"`                 | **Confirmado**                                     |
| `auto_recurring.transaction_amount` | `plans.priceUyu`           | **Confirmado** — centavos, integer                 |
| `auto_recurring.currency_id`        | `"UYU"`                    | **Confirmado**                                     |
| ~~`notification_url`~~              | —                          | **NO EXISTE** — T0 lo probó, MP lo descarta (§2.4) |
| `status`                            | `"pending"`                | **Confirmado** — sin plan, el tenant paga después  |
| `preapproval_plan_id`               | —                          | **No** (D2)                                        |
| `card_token_id`                     | —                          | **No** — el tenant paga en el checkout de MP       |

**Response (verificada):**

```json
{
  "id": "2c938084726fca480172750000000000",
  "external_reference": "...",
  "back_url": "...",
  "init_point": "https://www.mercadopago.com.uy/subscriptions/checkout?preapproval_id=2c93...",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "transaction_amount": 10
  },
  "status": "pending"
}
```

`init_point` es lo que devuelve el endpoint al tenant.

### 3.2 `PUT /preapproval/{id}` — cambiar estado o monto

**Cancelar:** `PUT /preapproval/{id}` con `{ "status": "cancelled" }`
**Reactivar:** `PUT /preapproval/{id}` con `{ "status": "authorized" }`
**Cambiar plan:** `PUT /preapproval/{id}` con `{ "auto_recurring": { "transaction_amount": <nuevo>, "currency_id": "UYU" } }`

Body params confirmados: `reason`, `external_reference`, `back_url`, `auto_recurring`, `card_token_id`, `card_token_id_secondary`, `payment_method_id_secondary`, `status`.

**El `id` es el MISMO antes y después de un cambio de plan** (MP actualiza el preapproval, no crea uno nuevo). Por eso `mpPreapprovalId` no se reescribe en `PUT /plan`, y por eso el Índice único de D7 aguanta un cambio de plan.

### 3.3 Configuración del webhook

| Aspecto          | Valor                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| URL              | `{adminBase}/api/webhooks/mercadopago/subscriptions`                                    |
| Método           | `POST`                                                                                  |
| Topics a activar | `subscription_preapproval`, `subscription_authorized_payment`                           |
| Modo             | test y producción, **URLs distintas** (recomendación de MP)                             |
| Secret           | `MP_PLATFORM_WEBHOOK_SECRET` — la firma que genera MP en _Your integrations → Webhooks_ |
| HTTPS            | Obligatorio. MP rechaza `localhost` / `127.0.0.1`                                       |

**MP no hace path templating** (§0 del spec). La URL es un literal.

### 3.4 `GET /preapproval/{id}` — resolver preapproval

```
GET https://api.mercadopago.com/preapproval/{id}
Authorization: Bearer {MP_PLATFORM_ACCESS_TOKEN}
```

Response verificada incluye: `id`, `version`, `external_reference`, `status`, `back_url`, `init_point`, `auto_recurring`, `preapproval_plan_id`.

Usada por: Estrategia R (§2.1) y por el spike.

### 3.5 `GET /authorized_payments/{id}` — resolver cobro recurrente ⚠️

```
GET https://api.mercadopago.com/authorized_payments/{id}
Authorization: Bearer {MP_PLATFORM_ACCESS_TOKEN}
```

**Shape de la response: NO VERIFICADO.** El spike determina si trae `external_reference`, `preapproval_id` o ninguno (§2.1).

**Timeout:** 15 s (mismo que `fetchPaymentDetails` del webhook de órdenes). **429:** backoff acotado respetando `Retry-After`; si agota, `200` + `warn`.

**Regla de no-procesar:** si ninguna estrategia resuelve el tenant → `200` + `warn { entityId, topic }`. Nunca `5xx`: MP reintentaría y no cambiaría el resultado.

---

## 4. Modelo de datos

### 4.1 Migración

**Una migración. Solo un índice.**

```sql
CREATE UNIQUE INDEX subscriptions_mp_preapproval_idx
  ON subscriptions ("mpPreapprovalId")
  WHERE "mpPreapprovalId" IS NOT NULL;
```

Append-only. **No se edita `0000_baseline.sql`** (guard de migraciones, AGENTS.md). Se genera con `pnpm db:generate`.

**Idempotencia:** `CREATE UNIQUE INDEX IF NOT EXISTS`. Re-ejecutable en cualquier entorno.

### 4.2 Migración condicional (solo si el spike lo pide)

Si `/authorized_payments` no expone ningún vínculo con la suscripción:

```sql
CREATE TABLE subscription_payments (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "mpInvoiceId"   TEXT NOT NULL,
  "status"        TEXT NOT NULL,
  "processedAt"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_payments_mp_invoice_idx
  ON subscription_payments ("mpInvoiceId");
```

RLS `tenant_isolation` + `FORCE RLS`, grants a `app_user`. **No se escribe hasta que el spike lo justifique.**

### 4.3 `subscriptions` — sin columnas nuevas

`mpPreapprovalId`, `currentPeriodEnd`, `lastProcessedPaymentId`, `planId`, `expiredAt`, `abandonedAt` cubren Fase 2. `expiredAt`/`abandonedAt` los escriben los crons de Fase 9; Fase 2 solo los lee (§3.4 del spec).

### 4.4 `tenant_mp_config` — intacta

Es Flujo B. Fase 2 no la lee ni escribe. Confirma ADR-023.

---

## 5. Estructura de archivos

### 5.1 Nuevos — `apps/admin/`

```
app/api/subscriptions/
  route.ts                          GET  — estado + permisos
  preapproval/route.ts              POST — crear (devuelve initPoint)
  cancel/route.ts                   POST — cancelar (202, no transiciona)
  reactivate/route.ts               POST — reactivar (202, no transiciona)
  plan/route.ts                     PUT  — cambio de plan + prorrateo
  # ADVERTENCIA T0-P6: cancel/reactivate/plan no tienen backend en MP.
  # PUT /preapproval/{id} es de solo lectura tras el primer cobro.
  # Devuelven 202 como hoy, pero la operacion NO ocurre.
  __tests__/
    route.test.ts
    preapproval.test.ts
    cancel.test.ts
    reactivate.test.ts
    plan.test.ts
    proration.test.ts               ← función pura, sin mocks

app/api/webhooks/mercadopago/subscriptions/
  route.ts                          POST — handler
  __tests__/route.test.ts
```

### 5.2 Nuevos — `packages/commerce/src/`

```
subscription-permissions.ts        derivePermissions(status)
subscription-proration.ts          calculateProration(...)  ← función pura
mp-subscriptions.ts                cliente MP: createPreapproval, updatePreapproval,
                                     getPreapproval, getAuthorizedPayment
mp-webhook-events.ts               clasificación de (type, action) → topic
__tests__/
  subscription-permissions.test.ts
  subscription-proration.test.ts
  mp-webhook-events.test.ts
```

### 5.3 Modificados

| Archivo                              | Cambio                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `packages/validation/src/schemas.ts` | `createPreapprovalSchema`, `updatePlanSchema`, `subscriptionWebhookSchema` |
| `packages/validation/src/env.ts`     | `MP_PLATFORM_ACCESS_TOKEN`, `MP_PLATFORM_WEBHOOK_SECRET`                   |
| `packages/db/src/schema.ts`          | índice en `dbSubscriptions`                                                |
| `packages/db/migrations/`            | 1 migración nueva                                                          |
| `apps/admin/lib/`                    | `getAdminBaseUrl` (espejo de `getStorefrontBaseUrl`)                       |
| `turbo.json`                         | confirmar `MP_PLATFORM_*` en `build.env`                                   |
| `SETUP.md`                           | config de vars + URL del webhook                                           |

### 5.4 Reutilizado sin cambios

| Archivo                                                 | Uso                                             |
| ------------------------------------------------------- | ----------------------------------------------- |
| `packages/commerce/src/webhook-signature.ts`            | `verifyMercadoPagoSignature`                    |
| `packages/commerce/src/encryption.ts`                   | **No se usa en Fase 2** (Flujo A no cifra nada) |
| `apps/storefront/app/api/webhooks/mercadopago/route.ts` | Se espeja el patrón, no se importa              |
| `packages/test-utils`                                   | `makeTxMock`, `mockReq`, `session`              |

### 5.5 Por qué el cliente MP va en `commerce`

Los 5 endpoints + el webhook llaman a la API de MP con el mismo token y los mismos timeouts. Un módulo `mp-subscriptions.ts` concentra la URL, el `Authorization`, el timeout y el parseo. Los handlers no arman URLs.

---

## 6. Flujos de datos

### 6.1 Crear preapproval

```
1. auth() → tenantId                            [401 si no]
2. MP_PLATFORM_ACCESS_TOKEN presente             [500 si no]
3. rate limit por IP (10/min, fail-open)        [429]
4. withTenantContext:
     a. SELECT subscription por tenantId         [404 si no existe]
     b. status ∈ {pending_first_payment, abandoned}  [409 si no]
     c. si mpPreapprovalId != null → 409 + initPoint existente  (D7/D2 §4.3 spec)
     d. SELECT plan por planId                   [404 si no / inactivo]  ← plans sin RLS
5. POST /preapproval a MP (timeout 30s)         [503 si timeout, 500 si MP error]
6. withTenantContext:
     UPDATE subscriptions SET mpPreapprovalId, planId, abandonedAt=NULL
7. 200 { initPoint, preapprovalId }
```

**Paso 6 es una segunda transacción a propósito.** Si el `POST` a MP fue exitoso pero el UPDATE falla, el preapproval existe en MP sin registro local. Log `error` con ambos ids para reconciliación. La alternativa (transacción única) no cubre el caso de red caída entre los dos.

### 6.2 Webhook — clasificación

```
1. MP_PLATFORM_WEBHOOK_SECRET presente            [503]
2. rawBody = request.text()
3. x-signature presente                            [401]
4. verifyMercadoPagoSignature(dataId = QUERY data.id, fallback body)
                                                 [401 si inválido]
5. subscriptionWebhookSchema.safeParse             [400]
6. live_mode === false && NODE_ENV=production  → 200 + info, no procesar
   ⚠️ VERIFICADO 2026-10-03: `live_mode` **solo viene en el topic `payment`**.
   Los topics de suscripción (`subscription_preapproval`,
   `subscription_authorized_payment`) **no incluyen el campo**. Tratar
   "ausente" como distinto de `false`: si no viene, NO asumir producción.
7. classify(type, action) → topic | UNKNOWN
     UNKNOWN → 200 + warn { type, action }
8. topic = subscription_preapproval_plan → 200 + info (fuera de alcance)
9. resolveTenant(data.id, topic):
     topic preapproval → Estrategia L
     topic invoice/payment → Estrategia R
     sin resolución → 200 + warn { entityId, topic }
10. withTenantContext(tenantId) → aplicar transición idempotente
11. 200 { received: true }
```

**El paso 4 usa el query param primero.** El webhook de órdenes usa el body (`extractDataId`); la doc de MP para el caso de suscripciones muestra `req.query['data.id']` en el validador oficial. Se usa query param con fallback al body para tolerar ambos.

### 6.3 Webhook — transición (convergencia)

El handler no hace `if (evento === X) transicionar`. Compara **estado de MP** contra **estado local** y escribe solo si difieren:

```
estadoObjetivo = deriveFromMp(mpEntity, estadoLocal)

  preapproval.status === 'authorized'  && local ∈ {pending_first_payment, past_due, expired}
      → active, currentPeriodEnd = now()+1mes, lastProcessedPaymentId = invoiceId
  preapproval.status === 'authorized'  && local === 'cancelled'
      → 400 en MP: no hay transición cancelled → authorized. **No implementable.**
        (verificado 2026-10-03: "Invalid transition from cancelled to authorized")
  preapproval.status === 'authorized'  && local === 'active'
      → SIN CAMBIO (idempotente)
  preapproval.status === 'cancelled'  && local ∈ {active, past_due, paused}
      → cancelled, currentPeriodEnd se mantiene
  preapproval.status === 'cancelled'  && local === 'cancelled'
      → SIN CAMBIO
  preapproval.status === 'paused'      && local ∈ {active, past_due}
      → paused (modelado desde 2026-10-03: la transición MP funciona, 200 + GET)
  preapproval.status === 'authorized'  && local === 'paused'
      → active (reanudar; verificado 200 + GET)
  preapproval.status === 'paused'      && local === 'paused'
      → SIN CAMBIO (idempotente)
  payment.status === 'approved'        && local ∈ {pending_first_payment, past_due, expired}
      → active, currentPeriodEnd = now()+1mes, lastProcessedPaymentId = paymentId
  payment.status === 'approved'        && local ∈ {active, cancelled}
      → SIN CAMBIO
  payment.status ∈ {rejected, cancelled, refunded} && local === 'active'
      → past_due
  payment.status ∈ {rejected, ...}    && local === 'past_due'
      → SIN CAMBIO (no reinicia el día 0, transversal §6)
  cualquier otro
      → SIN CAMBIO + info
```

**Guardas de idempotencia**, antes de lo anterior:

```
lastProcessedPaymentId === paymentId  → 200, sin escrituras
status local ya es el objetivo        → 200, sin escrituras
```

**`paused` está MODELADO desde 2026-10-03.** La transición `authorized → paused` funciona en MP
(verificada 200 + `GET`), y la doc oficial confirma que **detiene el cobro**: _"Pausar suscriptor:
…Mercado Pago deje de debitar los pagos de ese cliente hasta que decidas reactivarlo"_
([manage-subscription-plan](https://www.mercadopago.com.ar/developers/es/docs/subscription-plans/manage-subscription-plan)).
El mapa de §6.3 lo transiciona a un estado local `paused`. Si el tenant pausa desde el panel de
MP, el webhook lo refleja igual.

**`auto_recurring.transaction_amount` ≠ `plans.priceUyu` en un `subscription_preapproval`:** alguien cambió el monto fuera de la app. Se loguea `warn` con ambos valores y **no** se ajusta el `planId`. El tenant debe usar `PUT /plan`. Queda pendiente de reconciliación para el job de Fase 9.

### 6.4 Cancelar / reactivar / cambiar plan

Los tres son **intents**: llaman a MP, devuelven `202`, y **no escriben estado**. El webhook confirma.

```
cancel:      PUT /preapproval/{id} {status:"cancelled"}   → 202
reactivate:  PUT /preapproval/{id} {status:"authorized"}  → 202
plan:        PUT /preapproval/{id} {auto_recurring:{...}} → 200 + UPDATE planId
```

**Excepción:** `PUT /plan` sí escribe `planId` localmente, porque es un cambio de **intención** de negocio, no un estado de MP. El `202` de cancel/reactivar no escribe porque el estado de MP es la autoridad.

Esto evita el modo de fallo del spec §8 caso 9: la UI nunca dice "cancelada" si MP rechazó.

### 6.5 Idempotencia de `POST /preapproval`

`POST /preapproval` no es idempotente en MP. Doble click → dos suscripciones → dos cobros.

```
Si status ∈ {pending_first_payment, abandoned} Y mpPreapprovalId != null
  → 409 { error, field: "status", initPoint: <el existente> }
```

La UI navega al `initPoint` del error. No se crea un segundo preapproval.

---

## 7. Estrategia de testing

### 7.1 Mocks de MP

Se mockea `globalThis.fetch` (patrón de `apps/storefront/app/api/checkout/preference/__tests__/route.test.ts`). Un helper `mockMpFetch(routes)` donde `routes` mapea URL → response.

**Las 4 llamadas a MP se mockean:**

| Llamada                         | Dónde se testea                  |
| ------------------------------- | -------------------------------- |
| `POST /preapproval`             | `preapproval.test.ts`            |
| `PUT /preapproval/{id}`         | `cancel` / `reactivate` / `plan` |
| `GET /preapproval/{id}`         | webhook, Estrategia R            |
| `GET /authorized_payments/{id}` | webhook, eventos de cobro        |

**Y los 3 resultados del spike de §2.1** tienen su caso: con `external_reference`, con `preapproval_id`, y con ninguno.

### 7.2 Cobertura por capa

| Capa        | Suite                              | Casos                                                                                                                                                                 |
| ----------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pura        | `subscription-proration.test.ts`   | Tabla del transversal §5: upgrade día 1, upgrade día 15, downgrade, período completo, `díasRestantes` ≤ 0, mismo plan. Sin mocks, sin reloj externo (fecha inyectada) |
| Pura        | `subscription-permissions.test.ts` | 6 estados × 6 permisos contra transversal §2                                                                                                                          |
| Pura        | `mp-webhook-events.test.ts`        | Clasificación: cada topic conocido, combinación desconocida, `type` vacío, `action` vacío                                                                             |
| Integración | 5 endpoints                        | Ver tabla del spec §7.1 + **verificar que el body a MP lleva `external_reference = tenantId`**                                                                        |
| Integración | Webhook                            | Ver spec §7.2                                                                                                                                                         |

### 7.3 Cross-tenant — obligatorio

Tres tests, no uno:

1. **Ruta de escritura:** un `subscription_preapproval` con `external_reference` del tenant A no escribe nada del tenant B. `withTenantContext` se llama con A.
2. **Aislamiento de DB:** dentro de la transacción, la query que resuelve el tenant incluye `eq(dbSubscriptions.tenantId, tenantId)`. Con el índice de D7, un `mpPreapprovalId` duplicado entre tenants es imposible por construcción.
3. **No-confianza en el body:** un body con `external_reference` del tenant A pero cuyo `data.id` resuelve a un preapproval del tenant B → se procesa **B** (el `data.id` manda, el body no). Este test documenta que el body no decide.

### 7.4 Regresión

`pnpm test` completo verde. Los **61 tests** de checkout de órdenes y webhook de órdenes no se tocan.

DoD completo (AGENTS.md): `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm test`. Este spec toca `.md` → `format:check` obligatorio.

**Cobertura:** ≥ 80% en código nuevo.

---

## 8. Plan de implementación (insumo de sdd-tasks)

| #   | Bloque                                         | Depende de            |
| --- | ---------------------------------------------- | --------------------- |
| 0   | **Spike**: preapproval real + capturar webhook | vars `MP_PLATFORM_*`  |
| 1   | `derivePermissions` + tests                    | —                     |
| 2   | `calculateProration` + tests                   | —                     |
| 3   | `classifyMpEvent` + tests                      | —                     |
| 4   | `mp-subscriptions.ts` (cliente)                | 0 (shape de response) |
| 5   | Migración índice + `schema.ts`                 | —                     |
| 6   | `getAdminBaseUrl` + vars en `env.ts`           | —                     |
| 7   | `POST /api/subscriptions/preapproval` + tests  | 4, 5, 6               |
| 8   | `GET /api/subscriptions` + tests               | 1                     |
| 9   | `POST /cancel` + tests                         | 4, 5                  |
| 10  | `POST /reactivate` + tests                     | 4, 5                  |
| 11  | `PUT /plan` + tests                            | 2, 4, 5               |
| 12  | Webhook: firma + parse + clasificación         | 3, 4                  |
| 13  | Webhook: `resolveTenant` (Estrategia L + R)    | 4, 5                  |
| 14  | Webhook: transiciones + idempotencia           | 13                    |
| 15  | Tests de integración cross-tenant              | 14                    |
| 16  | Docs (`SETUP.md`, `AGENTS.md` si aplica)       | 0                     |

**El bloque 0 bloquea 4, 12, 13.** Los bloques 1, 2, 5, 6 se pueden hacer en paralelo y no dependen del spike.

---

## 9. Riesgos del design

| #   | Riesgo                                                                                                                | Sev.        | Mitigación                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `/authorized_payments/{id}` no expone ningún vínculo con la suscripción → los cobros recurrentes no se pueden enrutar | ~~CRÍTICO~~ | **DESCARTADO por T0.** Expone `preapproval_id` + `external_reference`. Índice parcial alcanza                                                                                    |
| R2  | `notification_url` no existe en `POST /preapproval` → no llegan webhooks → ninguna suscripción se activa              | **PARCIAL** | **Mitigado por T0:** `notification_url` no existe (P2/P5), la URL va en el panel de MP contra `admin.landaetastudio.com`. **Queda abierto** si MP entrega desde ese dominio (P4) |
| R3  | Los literales `type`/`action` difieren de lo esperado → el handler cae en `UNKNOWN` y no procesa nada                 | **ALTO**    | Despacha por **topic** (verificado), no por `action`. `UNKNOWN` loguea. Spike captura un payload real                                                                            |
| R4  | `paused` de MP no existe en el transversal → divergencia silenciosa si el tenant pausa desde el panel de MP           | ~~MEDIO~~   | **RESUELTO 2026-10-03.** `paused` modelado (§6.3) y la transición funciona. La doc de MP confirma que detiene el cobro                                                           |
| R5  | Doble click en contratar → dos suscripciones en MP                                                                    | **MEDIO**   | `409` con `initPoint` existente (§6.5)                                                                                                                                           |
| R6  | `mpPreapprovalId` se desincroniza (MP ok, UPDATE local falla)                                                         | **MEDIO**   | Dos transacciones deliberadas + log con ambos ids (§6.1)                                                                                                                         |
| R7  | El índice de D7 falla si el seed inserta dos `mpPreapprovalId` iguales                                                | **BAJO**    | El seed actual no crea suscripciones. Si aparece, la migración lo señala — que es el objetivo                                                                                    |
| R8  | `format:check` falla por los `.md` de Fase 2                                                                          | **BAJO**    | DoD lo incluye explícitamente (§7.4)                                                                                                                                             |

---

## 10. Preguntas abiertas

| #   | Pregunta                                                                                  | Estado                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | ¿Qué literales exactos de `type`/`action` emite MP por topic?                             | **RESPONDIDO 2026-10-03.** `payment`/`payment.created`, `subscription_authorized_payment`/`updated`, `subscription_preapproval`/`updated`. El dispatcher por `type` cubre los tres |
| P2  | ¿`POST /preapproval` acepta `notification_url`?                                           | **NO.** T0: HTTP 201, campo descartado. Ver §2.4                                                                                                                                   |
| P3  | ¿`/authorized_payments/{id}` trae `external_reference` o `preapproval_id`?                | **SÍ, ambos.** T0 confirmado en 2 pagos. Un índice parcial alcanza (§2.1)                                                                                                          |
| P4  | ¿MP entrega webhooks de suscripciones contra un dominio de producción?                    | **SÍ.** H1 refutada: 3 payloads reales, 1 s de latencia, con token y secret de la misma cuenta                                                                                     |
| P5  | ¿`PUT /preapproval/{id}` acepta `notification_url` (para migrar URLs existentes)?         | **NO.** Re-test 2026-10-03: HTTP 200, campo ausente en la respuesta y en el `GET`. No hay migración de URL                                                                         |
| P6  | `paused`: ¿se agrega al transversal o se documenta como no soportado?                     | **RESUELTO 2026-10-03.** Se modela. `authorized → paused` funciona; `cancelled → authorized` da 400, así que `pause`/`resume` reemplazan a `reactivate`                            |
| P7  | Prorrateo nativo de MP (`billing_day_proportional`): ¿se evalúa como enhancement?         | **Para Luis.** Requiere actualizar el transversal §5 (error factual)                                                                                                               |
| P8  | ¿`díasPeríodo` es 30 fijo o se configura por plan?                                        | Menos. El transversal §5 asume 30. Se usa 30 como constante hasta que se diga otra cosa                                                                                            |
| P9  | ¿Quién paga los primeros errores de MP en el spike (tarjeta de prueba, saldo)?            | **Resuelto** — test users de MP, tarjeta Visa test. Sin costo real                                                                                                                 |
| P10 | ¿`PUT /preapproval/{id}` permite mutar estado tras el cobro (`status`, `auto_recurring`)? | **NO.** T0 P6: todos los PUT son no-op post-cobro. Cancelación/pausa fuera de alcance de Fase 2                                                                                    |

**P1, P2, P3 y P5 bloquean `sdd-apply`.** El design de los handlers es ejecutable sin ellos (despacha por topic, tolera `UNKNOWN`, tiene 3 ramas de resolución), pero **el comportamiento en producción no se puede declarar correcto hasta que el spike los responda.**

---

## 11. Los 2 errores del transversal — para PR aparte

**No se corrigen en este PR.** Se reportan a Luis.

### Error 1 — Nombres de eventos (transversal §1, §6, §8)

El transversal usa `preapproval.created`, `preapproval.canceled`, `preapproval.updated`, `payment.created`, `payment.failed`, `payment.rejected`. **Ninguno de esos es un topic de MercadoPago.**

Topics reales: `subscription_preapproval`, `subscription_authorized_payment`, `payment`, `subscription_preapproval_plan`. El payload trae `type` + `action` separados.

**Impacto:** cualquiera que implemente contra el transversal construye un dispatcher que nunca matchea.

### Error 2 — Prorrateo nativo (transversal §5)

> _"MP Preapproval no soporta prorrateo nativo. La lógica la maneja nuestra app; MP solo ve el nuevo monto mensual."_

**Incorrecto.** MP expone `auto_recurring.billing_day_proportional` y una página de doc dedicada a prorrateo.

**Matiz:** `billing_day_proportional` proratea el primer cobro según el día de alta; no implementa la fórmula de crédito/diferencia entre planes del §5. Así que **la conclusión del transversal ("la lógica la maneja nuestra app") sigue siendo correcta**, pero la premisa que la justifica es falsa.

### Error 3 (bonus) — URL del webhook (transversal §8)

`Webhook URL: /api/webhooks/mercadopago/subscriptions/:tenantId`. **Imposible:** MP registra una URL literal, sin path templating. Ya corregido en el spec de Fase 2.

---

## 12. Referencias

| Documento                                                 | Uso                                                      |
| --------------------------------------------------------- | -------------------------------------------------------- |
| [Spec Fase 2](./2026-10-01-fase2-webhook-checkout.md)     | QUÉ — contrato, endpoints, edge cases                    |
| [Spec transversal](./2026-09-subscription-lifecycle.md)   | Estados, transiciones, prorrateo, permisos, idempotencia |
| [ADR-023](../../vault/01_ADRs/ADR-023-dos-flujos-mp.md)   | Dos flujos MP                                            |
| [ADR-024](../../vault/01_ADRs/ADR-024-pgcrypto-tokens.md) | Cifrado (Flujo B — **no aplica en Fase 2**)              |
| `apps/storefront/app/api/webhooks/mercadopago/route.ts`   | Patrón a espejar                                         |
| `apps/storefront/app/api/checkout/preference/route.ts`    | Patrón de rate limit + llamada a MP                      |
| `packages/commerce/src/webhook-signature.ts`              | Verificación HMAC (se reutiliza)                         |
| MP: `POST /preapproval`                                   | Body params y response                                   |
| MP: `PUT /preapproval/{id}`                               | Body params                                              |
| MP: _Subscriptions → Webhooks_                            | Tabla topic → API, restricción de config                 |
