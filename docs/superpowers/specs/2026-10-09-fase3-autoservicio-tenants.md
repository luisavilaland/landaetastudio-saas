# Spec — Fase 3: Autoservicio de tenants

**Fecha:** 2026-10-09
**Estado:** aprobado por Luis el 2026-10-09 (P1 y P2 resueltas). Design en curso.
**Ref:** item 61 cerrado en #235 · auditoría de Fase 2 · `cierre-fase2.md`

Este documento es el **QUÉ**. El **CÓMO** es `2026-10-09-fase3-design.md` y las tasks son
`docs/superpowers/plans/2026-10-09-fase3.md`. Ninguno de los dos existe todavía.

---

## 1. Objetivo

Que un tenant pueda convertirse en cliente sin intervención del superadmin: se registra,
paga su suscripción y su tienda queda activa por su propio medio.

Hoy ese camino no existe como producto. Fase 2 construyó la **máquina de estados** de la
suscripción y su webhook (Flujo A, cuenta de plataforma). Fase 3 construye el **camino de
entrada**: la puerta pública, el registro, la configuración de MP propio, el checkout y
la activación.

La distinción importa porque son **dos contratos distintos, con credenciales distintas y
webhooks distintos**. Confundirlos es el error más fácil de cometer en esta fase:

|                                      | Quién paga                         | Con qué credencial | Qué se suscribe           | Dónde vive el webhook                               |
| ------------------------------------ | ---------------------------------- | ------------------ | ------------------------- | --------------------------------------------------- |
| **Suscripción al SaaS** (Fase 2)     | El tenant paga **a la plataforma** | `MP_PLATFORM_*`    | La suscripción del tenant | `apps/admin/.../webhooks/mercadopago/subscriptions` |
| **Cobro del cliente final** (Fase 1) | El comprador paga **al tenant**    | MP del tenant      | La orden en la tienda     | `apps/storefront/.../webhooks/mercadopago`          |

**El MP del tenant NO cobra la suscripción.** El tenant configura su MP para poder
cobrarle a _sus_ compradores; la suscripción al SaaS la cobra la plataforma con
`MP_PLATFORM_ACCESS_TOKEN`. Resuelto por Luis el 2026-10-09 (§7, P1).

Por eso **no hay chicken-and-egg**: el tenant configura su MP _antes_ de pagar la
suspensión, y no es un bloqueo, porque son dos cuentas distintas. El orden del onboarding
es:

1. El tenant se registra (email + password).
2. Configura su tienda: subdominio, branding y **su propio MP**, para cobrarle a sus
   compradores.
3. Paga la suscripción al SaaS a la **plataforma**, con `MP_PLATFORM_*`.
4. El webhook de plataforma confirma el pago → el tenant pasa a `active`.

---

## 2. Alcance

### 2.1 Entra

| #   | Entregable                                 | Por qué                                                                                                                |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| E1  | Landing pública de planes                  | Hoy los planes no tienen cara pública; el alta es por Contacto                                                         |
| E2  | Registro de tenant                         | No existe el camino self-service                                                                                       |
| E3  | Asignación de subdominio/slug              | `tenants.slug` ya existe y es UNIQUE, pero se asigna a mano                                                            |
| E4  | Configuración de MP del tenant             | `tenant_mp_config` existe pero solo la puebla el superadmin. Es para cobrar a sus clientes, **no** para la suscripción |
| E5  | Checkout de suscripción                    | El endpoint `/api/subscriptions/preapproval` ya existe (Fase 2) pero no hay UI ni recorrido                            |
| E6  | Activación automática al confirmar el pago | El webhook ya activa; falta que el flujo llegue ahí sin intervention                                                   |
| E7  | Panel del tenant (mínimo)                  | Sin panel, autoservicio no es autoservicio                                                                             |
| E8  | Onboarding de branding                     | `customDomain` existe en schema y no se usa                                                                            |

### 2.2 No entra (explícitamente)

- **Precios, prorrateo y dunning.** Ya están especificados en el transversal
  (`2026-09-subscription-lifecycle.md` §5 y §3). Fase 3 los **consume**, no los cambia.
- **Migración de los 45 call sites de `withTenantContext` en producción.** Es deuda
  (ver §6.4) y tiene su propio ritmo. Fase 3 escribe código nuevo con el patrón correcto,
  pero no reescribe el existente salvo donde toque el flujo nuevo.
- **Cambios de pricing o de planes.** `plans` es catálogo global y no tiene `tenantId`.
- **2FA, SSO, auditoría advanced de superadmin.**
- **Marketplace de apps.**

### 2.3 Riesgo de alcance

E7 (panel del tenant) es el que más puede crecer sin control. "Panel mínimo" significa:
listar pedidos, productos y suscripción. Si durante la implementación aparece "y también
coupons" o "y también reportes", eso es Fase 4. El spec no abre la puerta a esa
conversación; el design puede recortar, no ampliar.

---

## 3. Casos de uso

Formato: actor + precondición + flujo + postcondición.

### CU-1 — El happy path completo

- **Actor:** visitante anónimo.
- **Precondición:** no hay tenant con ese email; hay un plan publicado.
- **Flujo:** landing → elige plan → registro (email + password) → confirma email →
  asigna subdominio → conecta MP → checkout → paga.
- **Postcondición:** existe `tenant` con `status` activo, existe `subscription` en
  `active` con `currentPeriodEnd` a 30 días, `tenant_mp_config` con `isVerified: true`,
  el subdominio resuelve y la tienda está publicly accesible.
- **Invariante que no debe romperse:** la fila de `subscriptions` se escribió exactamente
  una vez, y el tenant ajeno no fue tocado.

### CU-2 — Se registra pero no paga

- **Actor:** visitante que completa el registro y abandona el checkout.
- **Precondición:** email verificado, tenant creado, `subscription` en
  `pending_first_payment`.
- **Flujo:** cierra el navegador o abandona.
- **Postcondición:** a los 7 días sin pago, la `subscription` pasa a `abandoned` (ya está
  en el transversal, L39). **El tenant no debe poder publicar productos** en ese estado.
- **Nota:** el abandono de `subscription` ya está modelado; el abandono de `tenant` **no**.

### CU-3 — Cambia de plan

- **Actor:** tenant activo.
- **Precondición:** `subscription.status = active`.
- **Flujo:** panel → cambiar plan → el sistema calcula el prorrateo (§5 del transversal) →
  llama a MP → redirect.
- **Postcondición:** `subscription.planId` cambia, `currentPeriodEnd` se recalcula según el
  prorrateo.

### CU-4 — Cancela

- **Actor:** tenant activo.
- **Precondición:** `subscription.status = active`.
- **Flujo:** panel → cancelar → MP cancela el preapproval → webhook.
- **Postcondición:** `status = cancelled`, acceso de lectura hasta el fin del período
  pagado, luego `expired`.

### CU-5 — Reactivación

- **Actor:** tenant `expired` o `past_due`.
- **Flujo:** vuelve a pagar → webhook de plataforma.
- **Postcondición:** `expired → active`. En el transversal L48 dice _"reactivación
  manual"_; Fase 3 tiene que decidir si lo automatiza.

### CU-6 — El superadmin interviene (excepción)

- **Actor:** superadmin.
- **Precondición:** tenant atascado en onboarding.
- **Flujo:** panel de superadmin → forzar estado.
- **Postcondición:** tenant desbloqueado.
- **Restricción:** este camino existe, pero **no es el camino normal**. Si se usa
  porque el autoservicio falló, eso es un bug de Fase 3, no una feature.

### CU-7 — Slug ya tomado

- **Actor:** visitante que registra.
- **Precondición:** el slug elegido existe.
- **Flujo:** el backend devuelve 409 con `field: "slug"`; el formulario hace highlight.
- **Postcondición:** sugerencia alternativa. **No** se permite sufijos autogenerados
  silenciosos (`acme-2847`) porque el subdominio es la marca del tenant.

---

## 4. Estados del tenant durante el onboarding

### 4.1 El problema

`tenants.status` es un `text` con **default `'active'`** (verificado en
`packages/db/src/schema.ts`). Eso significa que **un tenant recién creado nace activo**.
No hay estado `pending`.

`subscriptions.status` sí tiene el default correcto: `pending_first_payment`.

Entonces hay dos máquinas de estados y no están sincronizadas: la `subscription` sabe que
todavía no se pagó, el `tenant` cree que ya está vivo.

### 4.2 Opciones

| Opción | Forma                                                                           | Pro                                                | Contra                                                                                  |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A**  | `tenants.status` pasa a `pgEnum` con `pending \| active \| suspended \| closed` | Fuente de verdad única y explícita; el tipo obliga | Migración de datos + RLS sobre enum                                                     |
| **B**  | Derivar el estado del tenant del estado de la `subscription`                    | Cero schema, una sola fuente de verdad             | El tenant no puede estar `suspended` por otra razón; un JOIN en cada query              |
| **C**  | Dejar `status` como está y agregar un campo `onboardingStep` aparte             | No rompe nada                                      | **Dos fuentes de verdad** — exactamente la clase de defecto que el item 61 vino a matar |

**Opción A — APROBADA por Luis (2026-10-09).**

`tenants.status` pasa a `pgEnum` con `pending | active | suspended | cancelled`, y el
default pasa a `'pending'`.

Razón: B deriva el estado de un JOIN, lo que agrega una query a cada verificación de
"¿puede operar?", y C crea una segunda fuente de verdad sobre esa misma pregunta — que es
justo la clase de defecto que el item 61 vino a matar. A deja una sola fuente de verdad y
la hace explícita en el tipo.

**Lo que implica (va al design):**

- Migración `text → pgEnum`, default `'pending'`.
- El webhook de plataforma que confirma el pago cambia `tenants.status` a `'active'`.
  **Eso es un segundo `UPDATE` sobre `tenants`, y `tenants` no tiene RLS** (es tabla raíz),
  así que el aislamiento no lo protege: el design tiene que decidir quién lo escribe y
  con qué garantía.
- Backfill: los tenants existentes que ya operan van a `'active'`. Si alguno tiene otro
  valor, se reporta antes de migrar.
- La comparación contra `'active'` en el código pasa a ser contra el enum, y Drizzle
  tipa el valor: un `status` inválido deja de ser un string cualquiera.

### 4.3 Relación con los 7 estados de la suscripción

Los 7 estados del transversal son de **cobro**, no de **identidad**. `abandoned` y
`expired` no dicen si el tenant existe o no. La relación correcta es:

- `tenant.status` responde **¿puede este tenant operar?**
- `subscription.status` responde **¿está este tenant al día?**

Un tenant `active` con `subscription.past_due` es el caso normal durante un rechazo de
pago: opera en modo degradado según §2 del transversal. La regla de negocio que falta
es el mapeo de "puede publicar" / "puede vender" sobre los dos campos. **Eso va al design.**

### 4.4 ¿El tenant existe antes de la suscripción?

**Sí.** Y tiene que: el slug, el subdominio y el `tenantId` se generan al registrarse, y
la `subscription` referencia `tenantId` con FK. La pregunta no es si existe, sino si
puede **operar** sin suscripción. Esa es la respuesta de §4.2.

---

## 5. Restricciones

### R1 — Aislamiento por tenant

Toda query a tabla de negocio va dentro de `withTenantContext(tenantId, cb)` y **con
`return await`**. `tenants` y `admin_users` están exceptuadas de RLS por diseño.

### R2 — Los precios son enteros en centavos

El backend nunca ve decimales. Solo se divide por 100 para mostrar.

### R3 — El subdominio se asigna al crear el tenant

`tenants.slug` es UNIQUE. El 409 debe incluir `field: "slug"`.

### R4 — Las URLs públicas salen del request

`getStorefrontBaseUrl(request)`, nunca `STOREFRONT_URL`. En Fase 3 esto pesa más: el
email de confirmación y el link de verificación se construyen con el host del request.

### R5 — Progresividad

Si Resend, R2 o Sentry no están configurados, el flujo **no se rompe**: se loguea y se
sigue. Un tenant sin email enviado puede confirmar por link directo.

### R6 — Idioma

UI y emails en español. Los logs en inglés.

### R7 — Los servicios externos no son un gate

La verificación de MP (`isVerified`) **no puede bloquear el registro**. Un tenant que
conecta MP y falla la verificación tiene que poder reintentar, no quedar bloqueado en un
estado sin salida.

### R8 — Dos flujos de MP, nunca mezclados

**El pago de la suscripción al SaaS usa MP de la PLATAFORMA** (`MP_PLATFORM_ACCESS_TOKEN`,
`MP_PLATFORM_WEBHOOK_SECRET`), y su webhook vive en `apps/admin`.

**El MP del tenant (`tenant_mp_config`, cifrado en la DB) es exclusivamente para que el
tenant cobre a sus clientes finales**, y su webhook vive en `apps/storefront`.

Los dos son públicos, pero usan credenciales distintas y **firmas distintas**
(`MP_PLATFORM_WEBHOOK_SECRET` no es `MERCADOPAGO_WEBHOOK_SECRET`). Mezclarlos rompe la
atribución del webhook: un evento de plataforma procesado por el flujo del tenant
activaría la tienda de un tenant que no pagó.

---

## 6. Dependencias de Fase 2

### 6.1 Item 61 — cerrado ✅

`transitionSubscription(tx, tenantId, from, to, patch)` en `@repo/commerce`
(PR #235, `e7d3f67`). Construye el `WHERE` internamente (`tenantId AND status`), no
acepta query cruda ni `WHERE` del caller, y devuelve
`{ applied: true, id } | { applied: false, reason: 'concurrent_update' }`.

**Cómo lo usa Fase 3:** toda transición de `subscription.status` del flujo nuevo debe pasar
por esa función. La alternativa —escribir el `UPDATE`— es el defecto que el item 61 vino a
cerrar, y reaparecería en los endpoints nuevos sin que ningún test lo detecte.

**Lo que la función NO cubre** (del propio diseño §8): queries Drizzle escritas fuera de
ella. El tipo no impide `tx.select().from(dbProducts)` en un endpoint nuevo; solo lo
desalienta. **Por eso el design tiene que decidir el patrón de los endpoints nuevos, no
solo si reusar la función.** Es la pregunta que el design responde (§6 del design).

### 6.2 Item 64 — `dataId` se lee solo del body (ALTO para Fase 3)

El fallback query→body se implementa cuando se suscriba `subscription_preapproval_plan`
en el panel de MP. Ese topic **sigue sin suscribir** (acción operacional de
`cierre-fase2.md` §135). Es dependencia de Luis, no de código.

### 6.3 Items 65 y 67 — antes de que exista la UI (recomendación de la auditoría)

La auditoría de Fase 2 dice textual: _"H-F2-3 y H-F2-5 antes de que exista la UI. Ambos
causan estados irrecuperables (`pending_first_payment`, loop de reintentos) y ninguno se
nota hasta que hay un usuario real."_

- **Item 65:** el 409 de doble click omite `initPoint` y **un test consagra la forma
  equivocada**. Fase 3 le pone un botón al lado. Hay que arreglar el test, no solo el
  handler.
- **Item 67:** `external_reference` sin validar puede producir 500. Con usuarios reales,
  un 500 en el checkout es un tenant perdido.

**Recomendación: resolver 65 y 67 dentro de Fase 3, antes de E5.** Costo estimado ~2 h y
desbloquea el resto del flujo.

### 6.4 Deuda que Fase 3 hereda

| Item  | Qué es                                                            | ¿Aplica a Fase 3?                                          |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| 62    | Un nombre o comentario puede hacer el trabajo de la review        | **Sí.** Fase 3 multiplica endpoints nuevos. El riesgo real |
| 63    | Docs y código muerto que afirman lo que el código no hace         | **Sí**, si se documenta onboarding                         |
| 74    | La rama `target === current` de `applyTransition` es inalcanzable | **Sí**, si se reusa `applyTransition`                      |
| 78    | Flake de tests de DB (~1 de cada 4-5 corridas)                    | **Sí.** Ver §6.5                                           |
| 79-90 | Encoding, CJK, Redis, `any`                                       | Heredadas, no bloquean                                     |

**Nota sobre 62.** Es el item de mayor severidad conceptual para Fase 3. La auditoría de
Fase 2 (§H-F2-1) dice que la causa raíz de H1 _"era un nombre y un comentario, no una falta
de tests"_. Fase 3 escribe muchos endpoints nuevos cuya garantía depende de nombres
correctos y no de tipos. **El design debería decidir una regla de revisión para esto.**

### 6.5 El flake del item 78 y los tests de Fase 3

La suite completa falla ~1 de cada 4-5 corridas. **Fase 3 va a agregar tests de
integración contra Neon**, que es exactamente la categoría que flakea. Contexto: el item
78 no tiene culprit identificado.

**Restricción para el design:** ningún test de Fase 3 debe depender de que la suite
completa esté verde en una corrida dada. Cada archivo nuevo de integración tiene que ser
verde en aislamiento y eso hay que reportarlo así, no como "la suite pasó".

### 6.6 Estado de deuda al arrancar

Abiertos: 62, 63, 64, 65, 67, 72, 74, 78, 79-90. **Ninguno bloquea Fase 3.** El único
bloqueante declarado (item 61) está cerrado.

---

## 7. Preguntas abiertas

Las marcadas **BLOQUEANTE** impiden escribir el design: la respuesta cambia la
arquitectura, no solo un detalle.

### P1 — ~~BLOQUEANTE~~ RESUELTO (Luis, 2026-10-09): cobra la plataforma

**Respuesta: la suscripción al SaaS la cobra la PLATAFORMA con `MP_PLATFORM_*`. El MP del
tenant es para que el tenant cobre a SUS clientes, los compradores de su tienda.**

La línea del plan de fase que decía _"el pago de la suscripción usa MP del tenant"_ era un
error de redacción: confundía los dos flujos. El spec transversal y el código de Fase 2
son la realidad.

Arquitectura confirmada:

- Plataforma cobra la suscripción al tenant → `MP_PLATFORM_*`, webhook en `apps/admin`.
- Tenant cobra a sus clientes finales → MP del tenant (`tenant_mp_config`), webhook en
  `apps/storefront`.

**Por qué esto no era menor.** La pregunta parecía de credencial y era de arquitectura:
"MP del tenant" para la suscripción habría invertido el orden del onboarding, porque el
tenant necesitaría MP configurado para poder pagar. Al ser dos cuentas distintas, el
tenant configura **su** MP primero (para vender) y **después** paga la suscripción (a la
plataforma). No hay chicken-and-egg, y el paso 2 del onboarding no bloquea al 3.

Consecuencia para el resto del spec: **P3 deja de bloquear.** Si la plataforma cobra, el
MP del tenant no es necesario para completar el alta, así que OAuth puede ser un
posterior en lugar de un requisito del primer día.

### P2 — ~~¿Estado del tenant durante onboarding?~~ RESUELTO (Luis, 2026-10-09): opción A

`tenants.status` → `pgEnum('tenants_status', ['pending', 'active', 'suspended',
'cancelled'])`, default `'pending'`. Ver §4.2 para el detalle de la migración y lo que
arrastra.

### P3 — ¿Cómo obtiene el tenant su MP? OAuth, token manual, o ambos? — ABIERTA

**Ya no bloquea** (ver P1): el MP del tenant no es necesario para el alta. El design
decide.

`tenant_mp_config` ya guarda `accessTokenEnc`, `webhookSecretEnc`, `publicKey`,
`isVerified`. Falta el **modo de obtenerlos**:

- **OAuth de MP**: el flujo correcto, pero exige app en MP, redirect, refresh tokens, y
  manejo de `isVerified` con verificación real. Es trabajo de días.
- **Token manual**: pegar un access token. Simple, pero el usuario tiene que saber
  dónde encontrarlo y la experiencia es mala.
- **Ambos**: OAuth como camino principal, token manual como escape hatch.

**Impacta, y el impacto cambió con P1.** Resuelto que cobra la plataforma, el MP del
tenant importa solo para _cobrar a sus clientes finales_. Eso puede ser un paso
posterior al alta, y el onboarding **no lo necesita para funcionar**. OAuth deja de ser un
requisito del primer día y puede ser un enhancement.

**Restricción que sí queda, sea cual sea la opción:** R7. Un tenant que falla al conectar
MP tiene que poder reintentar, no quedar bloqueado en un estado sin salida.

### P4 — ¿La activación depende de verificación de email?

Recomendación: **no bloqueante** (R5). Se verifica, pero el tenant puede operar mientras
espera, con un aviso en el panel. Bloquear es más seguro pero convierte un problema de
entrega de email en un tenant muerto.

### P5 — ¿El tenant puede publicar con `subscription.past_due`?

El transversal §2 sugiere que `past_due` opera en modo limitado. Falta la regla exacta:
¿puede publicar productos? ¿puede vender? **Afecta CU-1 y CU-2** y es una decisión de
producto, no de código.

### P6 — ¿El subdominio es `<slug>.lvh.me` en local o hay reserva de nombres?

CU-7 dice que no se autoincrementan slugs. Falta decidir si hay lista reservada
(`www`, `api`, `admin`) y qué pasa con el subdominio cuando el tenant cancela.

---

## 8. Criterio de aceptación del spec

**Cumplido el 2026-10-09.** Estado de cada condición:

1. ✅ **P1 tiene respuesta** — cobra la plataforma (§7). El design se puede escribir.
2. ✅ **P2 tiene respuesta** — opción A, `pgEnum` con default `'pending'` (§4.2).
3. ✅ **P3 a P6 quedan abiertas** y se resuelven en el design: P3 no bloquea desde P1,
   y P4-P6 son aislables en una sección del design o diferibles a una task.
4. ✅ **CU-1 a CU-7 aceptables** como comportamiento observable.

**Siguiente paso:** `2026-10-09-fase3-design.md` (CÓMO). Los tres puntos que el design
tiene que resolver sí o sí, porque son los que la ejecución no puede inventar:

- Cómo se escriben los endpoints nuevos de Fase 3 sin repetir el agujero del item 61
  (§6.1), dado que la función cubre `subscriptions.status` y nada más.
- La migración de `tenants.status` a `pgEnum` y **quién escribe `tenants.status`**, que
  es una tabla sin RLS (§4.2).
- La regla de "puede publicar / puede vender" sobre los dos campos de estado (§4.3), que
  responde a P5.

---

## Ref

`vault/04_Fases/cierre-fase2.md` · `vault/04_Fases/auditoria-fase2.md` ·
`vault/04_Fases/diseno-item-61-cross-tenant.md` ·
`docs/superpowers/specs/2026-09-subscription-lifecycle.md` · item 61 en #235 ·
ADR-026 (resolución de tenant por preapprovalId) · ADR-027 (planId del endpoint write) ·
ADR-028 (reserva condicional antes de crear)
