---
id: 81
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 14:40:43"
updated_at: "2026-10-01 14:40:43"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Design Fase 2: 7 decisiones tecnicas + mapeo local reusando subscriptions"
---

# Design Fase 2: 7 decisiones tecnicas + mapeo local reusando subscriptions

**What**: Diseno tecnico de Fase 2 (webhook suscripciones + checkout). 7 decisiones (D1-D7), migracion unica (indice unico parcial), y evaluacion del mapeo local preapproval_id -> tenant_id pedida por el usuario.

**Why**: El sdd-propose/spec asumian un contrato de MP que resulto incorrecto. El design fija el COMO y resuelve 6 preguntas abiertas del spec §12.

**Where**: docs/superpowers/specs/2026-10-01-fase2-design.md

**Learned**:
1. **CORRECCION AL SPEC: endpoint equivocado para cobros recurrentes.** La tabla oficial topic -> API de MP para Suscripciones dice que `subscription_authorized_payment` se resuelve con `GET /authorized_payments/{id}` ("Get invoice data"), NO con `GET /v1/payments/{id}`. El spec §2.4 lo asigno mal. Son objetos distintos.
2. **Riesgo #1 de Fase 2 (CRITICO)**: no esta verificado que `/authorized_payments/{id}` devuelva `external_reference` NI `preapproval_id`. Si no trae ninguno, un cobro recurrente no se puede atribuir a ningun tenant y el webhook no se enruta. Es el motivo del spike bloqueante.
3. **MP se contradice sobre `notification_url`**: la doc de Subscriptions->Webhooks dice que para Suscripciones NO se puede configurar la URL por panel y hay que hacerlo al crear el pago; pero los body params de `POST /preapproval` NO documentan `notification_url` (si aparece en Preferences API e IPN). No se resuelve por inferencia: si el campo existe y no se manda, ninguna suscripcion se activa. Plan B documentado.
4. **D1 - Resolucion de tenant en dos estrategias**: L (local, `SELECT tenantId FROM subscriptions WHERE mpPreapprovalId = $1`) para `subscription_preapproval`; R (remota) para cobros. Unico escenario que suma tabla nueva: si `/authorized_payments` no expone vinculo alguno (+1 dia, +1 migracion, ya estimada).
5. **D7 - El mapeo local que pidio el usuario YA EXISTE en la base.** `subscriptions` tiene `mpPreapprovalId` + `tenantId` con 1 fila por tenant (`subscriptions_tenant_idx` UNIQUE). No hace falta tabla ni columna nueva: solo un indice unico parcial. Se JUSTIFICA POR INTEGRIDAD (impide que dos tenants compartan preapproval_id), NO por performance — a escala MVP un seq scan de 100 filas ya es sub-milisegundo. Honestidad sobre esto.
6. **D2 - Preapproval SIN plan de MP**: `plans` es la fuente de verdad del precio; un `preapproval_plan` en MP seria un espejo con 2 fuentes de verdad y desincronizacion silenciosa. Sin plan, `reason` pasa a ser obligatorio.
7. **D3 - Prorrateo: se mantiene el calculo propio** aunque la premisa del transversal sea falsa. Razon: es decision registrada; `billing_day_proportional` proratea el primer cobro por dia de alta, no implementa la formula credito/diferencia entre planes; nuestra formula produce el numero que se le muestra al tenant; y es una funcion pura testeable sin MP. Se reporta a Luis como error factual del transversal.
8. **D5 - `derivePermissions` en `@repo/commerce`**, no en el handler de admin: implementa politica de negocio del transversal §2, y Fase 3 (UI del panel) lo consumira. Importarlo de un route handler seria inconsistente.
9. **D6 - Sin magic IDs**: los magic IDs del Flujo B simulan pagos de ordenes; para suscripciones habria que registrar preapprovals reales, acoplando CI a un recurso externo mutable. Se mockea `fetch` (patron ya establecido).
10. **Idempotencia del POST /preapproval**: NO es idempotente en MP. Doble click = dos suscripciones = dos cobros. Mitigacion: 409 con el `initPoint` existente si ya hay `mpPreapprovalId` en `pending_first_payment`.
11. **Regla de frontera de confianza**: el body del webhook ENRUTA, la respuesta de MP DECIDE, la DB CONCUERDA. Ningun campo del body decide una transicion por si solo. Combinacion desconocida -> 200 + warn, nunca 5xx (evita reintentos infinitos de MP).
12. **`paused` es un estado de MP que el transversal no modela** (4to hallazgo del transversal). Se loguea warn, no se transiciona, se reporta a Luis.
13. **Transicion por convergencia, no por evento**: el handler compara estado de MP contra estado local y escribe solo si difieren. Hace los eventos de preapproval idempotentes por construccion, sin necesitar `lastProcessedPaymentId` (que solo cubre pagos).
14. **`PUT /plan` escribe `planId` localmente pero `cancel`/`reactivate` devuelven 202 sin escribir**: cambio de intencion de negocio vs estado de MP. Evita que la UI diga "cancelada" cuando MP rechazo.

**Dependencias bloqueantes de sdd-apply (spike bloque 0)**: P1 literales type/action, P2 notification_url, P3 authorized_payments vinculo, P4 config por panel, P5 PUT notification_url para migrar URLs.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
