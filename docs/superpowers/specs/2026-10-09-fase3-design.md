# Design — Fase 3: Autoservicio de tenants

**Fecha:** 2026-10-09
**Estado:** aprobado por Luis el 2026-10-09 (D17 y D18 confirmadas). Plan en curso.
**Spec:** `docs/superpowers/specs/2026-10-09-fase3-autoservicio-tenants.md`
**Issue:** #238

Este documento es el **CÓMO**. El **QUÉ** está en el spec; las **tasks** están en
`docs/superpowers/plans/2026-10-09-fase3.md`.

Cada decisión lleva el prefijo **D<n>** para poder citarla desde el plan y desde el
código. Cuando una decisión tiene un coste que aceptamos a knowingly, dice cuál.

---

## 1. Arquitectura general

### 1.1 Flujo del onboarding

```
                    PLATAFORMA (MP_PLATFORM_*)                    TENANT (su MP)
                            │                                          │
  (1) registro ─────────────┤                                          │
      email + password      │  crea tenant (status=pending)           │
      slug reservado       │  crea subscription (pending_first_payment)│
      │                    │  email de verificación (no bloqueante)   │
      ▼                    │                                          │
  (2) configurar tienda    │──────────────────────────────────────▶  │ MP, branding
      subdominio           │                                          │subdominio
      branding             │                                          │
      │                    │                                          │
      ▼                    │                                          │
  (3) pagar suscripción ───┤◀─── preapproval (admin) ───────────────  │
      checkout             │    checkout de plataforma                │
      │                    │                                          │
      ▼                    │                                          │
  (4) webhook MP ──────────┤  subscription → active                  │
      activations           │  tenants.status → active  ◀── D4         │
      │                    │                                          │
      ▼                    │                                          │
  (5) tienda publicada ─────────────────────────────────────────────▶ │
```

**El paso (2) no bloquea el (3).** Son dos cuentas de MP distintas (spec §1, R8). El
tenant configura su MP para cobrar a sus compradores; paga la suscripción a la
plataforma. Por eso no hay chicken-and-egg.

**El paso (4) es el único que puede fallar sin que haya un humano.** Todo lo demás es
interacción del usuario.

### 1.2 Dónde vive cada cosa

| Superficie              | App                                         | Razón                                                                                                                    |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Landing SaaS + registro | `apps/storefront` (`/landing`, `/registro`) | Es donde ya vive el proxy que resuelve tenants. Ver D1                                                                   |
| Checkout de suscripción | `apps/admin`                                | El preapproval de plataforma ya existe ahí (`/api/subscriptions/preapproval`, Flujo A). **No se replica en storefront.** |
| Webhook de plataforma   | `apps/admin/.../subscriptions`              | Ya existe, 59 tests. Se le **agrega** la activación del tenant                                                           |
| Config de MP del tenant | `apps/admin`                                | Es un dato operativo del tenant, y vive cifrado en `tenant_mp_config`                                                    |
| Panel del tenant        | `apps/admin`                                | Ya existe el dashboard. Se le agregan las secciones de onboarding                                                        |

**Una sola decisión de superficie:** el registro y la landing van en `storefront`, todo lo
demás en `admin`. La razón es que `storefront` es la única app que tiene resolución de
tenant por host, y el subdominio es parte del onboarding. `admin` es la app del operador
del tenant, y ya tiene el flujo de plataforma.

### 1.3 D1 — La landing necesita una excepción en el proxy

**Problema verificado.** `apps/storefront/proxy.ts:95-98` devuelve **404** cuando no
resuelve ningún tenant. En el dominio de la plataforma (`app.landaetastudio.com`) no hay
tenant que resolver, así que la landing devolvería 404.

Además, el proxy tiene tres fallbacks que en desarrollo siempre resuelven algo:
`localhost → tienda1` (L83) y `DEFAULT_TENANT_SLUG` (L89). **En local, un host de
plataforma no se puede probar** sin cambiar ese comportamiento.

**Decisión.** `PLATFORM_HOST` en env. Si el hostname coincide, el proxy **no intenta
resolver tenant** y deja pasar `/landing`, `/registro` y `/api/registro`. El resto de las
rutas sigue igual.

```ts
if (process.env.PLATFORM_HOST && hostname === process.env.PLATFORM_HOST) {
  // Sin tenant. Se sirve la superficie de la plataforma.
  return NextResponse.next()
}
```

Va **antes** de los tres fallbacks, para que `DEFAULT_TENANT_SLUG` no lo secuestre en
local.

**Lo que NO hace esta decisión:** no cambia cómo se resuelven los tenants. Un tenant
existente sigue resolviendo por `customDomain`, subdominio o cookie, en ese orden.

### 1.4 D2 — El proxy tiene que filtrar por `status`

**Este es el punto que hace que `pgEnum` signifique algo.**

`proxy.ts:60` consulta `dbTenants` por `slug` **sin filtro de estado**. Con
`tenants.status` en `text` no había nada que filtrar. Con el enum, si no se agrega el
filtro, **un tenant `pending` o `cancelled` sigue teniendo su tienda pública**.

O sea: la migración a `pgEnum` sin tocar el proxy es cosmética.

```ts
.where(and(eq(dbTenants.slug, sub), eq(dbTenants.status, 'active')))
```

**Corolario con coste asumido:** un tenant `cancelled` pierde su subdominio de golpe, sin
página de "estás cerrado". Aceptamos el coste: el subdominio es la marca del tenant, y
mantenerlo vivo en un tenant cancelado confunde al comprador tanto como al dueño. El
mensaje de estado cerrado lo maneja el panel, no la tienda.

**Y al revés:** un tenant `pending` con subdominio elegido **no resuelve**, así que su
tienda no es accesible durante el onboarding. El onboarding vive en el panel de `admin`,
no en el storefront. Correcto.

### 1.5 Multi-tenancy durante el onboarding

**El problema.** En el resto del sistema, `tenantId` se resuelve del host (proxy) o del
token de sesión. Durante el registro **el tenant todavía no existe**, así que no hay host
que lo resuelva ni token que lo cargue.

**D3 — Pre-generar el `tenantId` en la aplicación.**

```ts
const tenantId = crypto.randomUUID() // en la app, antes de la transacción
```

Eso permite envolver **las tres escrituras del alta en una sola transacción con contexto
de tenant**:

```ts
await withTenantContext(tenantId, async (tx) => {
  await tx
    .insert(dbTenants)
    .values({ id: tenantId, slug, name, status: 'pending' })
  await tx
    .insert(dbSubscriptions)
    .values({ tenantId, planId, status: 'pending_first_payment' })
  return tx
})
```

**Por qué no dejar que la DB genere el id.** `id` tiene `defaultRandom()`, así que
`INSERT` + `RETURNING` funciona. Pero `subscriptions` y `tenant_mp_config` tienen FK a
`tenants.id`, y para escribir esas filas hace falta `set_tenant_id(tenantId)` — es decir,
el id **antes** del insert. Pre-generarlo convierte tres escrituras en una transacción
atómica; si no, son dos y el tenant puede quedar sin suscripción.

**Sobre `return await`:** obligatorio, sin excepción (AGENTS.md). Una rejection de
`db.transaction` sin `await` bypasea el `try/catch` del handler.

---

## 2. Modelo de datos

### 2.1 D4 — `tenants.status` a `pgEnum`

```sql
CREATE TYPE tenants_status AS ENUM ('pending', 'active', 'suspended', 'cancelled');
ALTER TABLE tenants ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tenants ALTER COLUMN status TYPE tenants_status USING status::tenants_status;
ALTER TABLE tenants ALTER COLUMN status SET DEFAULT 'pending';
```

**Backfill.** Los tenants existentes que operan van a `'active'`. **Antes de migrar** hay
que correr el conteo y reportar cualquier valor que no sea `'active'`:

```sql
SELECT status, count(*) FROM tenants GROUP BY status;
```

Si aparece algo que no sea `'active'`, **no se migra a ciegas**: se reporta y se decide.
Un `USING status::tenants_status` revienta con un valor fuera del enum, y eso es mejor que
un default silencioso.

**RLS:** `tenants` es tabla raíz y **no tiene RLS por diseño** (AGENTS.md, y el checklist
de RLS lo prohíbe explícitamente sin `tenantId` + policy). La migración **no** le agrega
RLS.

### 2.2 D5 — Quién escribe `tenants.status`, y por qué necesita su propia función

Este es el punto que más se parece al item 61, y la respuesta es contraintuitiva.

`transitionSubscription` cubre `subscriptions.status`. El alta tiene que cambiar
`tenants.status` de `pending` a `active`, y **no** hay función que lo haga.

**No se extiende `transitionSubscription` con un flag.** El diseño del item 61 (§9) lo
dice explícito: si una transición necesita una variante, **se agrega otra función**, no un
flag, porque un flag es exactamente el filtro volviendo a ser código escrito a mano.

```ts
// packages/commerce/src/tenant-lifecycle.ts
export async function activateTenant(
  tx: TenantTx,
  tenantId: string,
): Promise<TenantStatusResult>
```

**Y hay una diferencia de verificación que importa:**

`subscriptions` tiene RLS. Un `WHERE` mal escrito ahí **queda enmascarado por la policy**,
que es exactamente lo que volvió indetectable al item 61: el test pasaba en verde con el
filtro removido. Por eso el test del item 61 tiene dos capas.

`tenants` **no tiene RLS**. Si el `WHERE` de `activateTenant` está mal, **nada lo
enmascara**: la fila de otro tenant cambia y el test lo ve en una sola capa, con Neon y
dos tenants reales.

| Tabla           | ¿RLS? | ¿Qué verifica el test?                                                                           |
| --------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `subscriptions` | Sí    | **Dos capas.** La de owner es la que observa el `WHERE`; la de RLS prueba el comportamiento real |
| `tenants`       | No    | **Una capa alcanza.** No hay segunda capa que tape el error                                      |

La ausencia de RLS hace el test **más simple**, no más difícil. Es la inversión de lo que
ocurre con `subscriptions`, y vale la pena entender por qué: el enmascaramiento venía de
haber una capa de protección, no de la falta de ella.

**El riesgo residual:** `tenants` sin RLS significa que un `UPDATE` a esa tabla desde
cualquier endpoint admin es cross-tenant por definición si no filtra. `activateTenant` es
la frontera; el design asume que el resto del código no escribe `tenants.status` a mano.
Eso es una regla de revisión, no una garantía — ver §6.3.

### 2.3 Lo que NO cambia

- `subscriptions.status` sigue siendo `text` con default `pending_first_payment`. Los 7
  estados del transversal funcionan; convertirlos a enum es fuera de alcance.
- `tenant_mp_config` no cambia. Ver §4.

---

## 3. Auth + onboarding

### 3.1 D6 — Registro con email + password, sin OAuth

NextAuth v5 ya está con JWT y `tenantId` en claims (`AGENTS.md`). El registro reutiliza
ese provider de credenciales.

**OAuth social (Google, GitHub) queda fuera de Fase 3.** Razón: cada provider agrega una
tabla de cuentas, y el benefit es posterior al alta. Fase 3 tiene que funcionar sin él.

### 3.2 El `tenantId` en el token

`tenantId` ya está en los claims. Pero **durante el registro no hay token**: el tenant se
crea en esa misma request.

**Decisión:** el registro es un endpoint **público** que devuelve el tenantId y además
inicia sesión. El token se emite **después** del insert, no durante.

```ts
// pseudo
const tenantId = crypto.randomUUID()
const created = await withTenantContext(tenantId, async (tx) => {
  /* inserts */ return { id, slug }
})
// recién acá: firmar el token con tenantId
```

### 3.3 D7 — La verificación de email no bloquea

Spec P4. El tenant puede operar con `pending` sin email verificado. Motivo: bloquear
convierte un problema de entrega de email (Resend caído, spam) en un tenant muerto, y R5
ya dice que los servicios externos no son un gate.

**Pero el subdominio sí lo bloquea** (D2), así que un tenant sin verificar existe pero no
tiene tienda pública. Es un punto medio razonable.

### 3.4 D8 — Slug: reserva de nombres y unicidad

Spec P6.

```ts
const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'platform',
  'checkout',
  'billing',
  'support',
  'help',
  'docs',
  'assets',
  'static',
  'mail',
  'cdn',
  'shop',
  'store',
])
```

**En la carrera de unicidad:** dos registros simultáneos con el mismo slug producen una
violación de `tenants_slug_key`, no un 409 limpio. Se captura la violación de unique y se
devuelve `409 { error: "Slug ya existe", field: "slug" }` (AGENTS.md).

**Slug liberado:** `slug` es UNIQUE y no se reutiliza. Cuando un tenant cancela, su slug
queda reservado para siempre. Motivo: si se liberara, el próximo que lo tome puede
heredar contenido cacheado, enlaces viejos y confianza de un tenant anterior.

---

## 4. MP por tenant

### 4.1 D9 — P3 resuelta: token manual en V1, OAuth diferido

Spec P3 quedó abierta; el design decide.

**V1 es token manual.** Razón: con P1 resuelto, el MP del tenant **no es necesario para
completar el alta**. Paga la plataforma. Entonces OAuth no es un requisito del primer día,
y OAuth son días de trabajo (redirect, refresh tokens, revocación, verificación real) sin
un desbloqueo que justifique ese coste hoy.

**Secuencia:** el tenant pega su `accessToken` y su `webhookSecret`. Se validan contra la
API de MP antes de guardar. Si la validación falla, R7: se puede reintentar.

**Con el MP configurado, el tenant puede cobrar a sus clientes.** Sin MP configurado, el
tenant opera pero **no puede recibir pedidos**: el checkout del storefront necesita
`tenant_mp_config`. Eso es una regla de negocio, no un error.

### 4.2 La fila se crea completa o no se crea

`tenant_mp_config` tiene `accessTokenEnc` y `webhookSecretEnc` **NOT NULL**. No hay
config parcial.

**Decisión:** no se_relaja el schema. La fila se crea **al final** del paso de MP, cuando
ambos valores están. Un tenant a medio camino no tiene fila, y `SELECT ... WHERE tenantId`
devuelve vacío, que es el estado "sin MP".

La alternativa —permitir parcial con `publicKey` solo— obligaría a cada reader a manejar
el caso "MP configurado a medias", que es exactamente el estado que R7 quiere evitar.

### 4.3 R8 — Los dos flujos no se cruzan

Ya está en el spec como restricción. En el código, la separación es:

|                  | Credencial                        | Firma                               | Webhook                           |
| ---------------- | --------------------------------- | ----------------------------------- | --------------------------------- |
| Suscripción      | `MP_PLATFORM_ACCESS_TOKEN`        | `MP_PLATFORM_WEBHOOK_SECRET`        | `apps/admin/.../subscriptions`    |
| Orden del tenant | `tenant_mp_config.accessTokenEnc` | `tenant_mp_config.webhookSecretEnc` | `apps/storefront/.../mercadopago` |

**El riesgo real:** un evento de plataforma arrives al webhook del storefront y active la
tienda de un tenant que no pagó. La separación lo evita por **credenencial**, no por
estructura: cada flujo resuelve su secreto de una fuente distinta.

---

## 5. Checkout de suscripción

### 5.1 D10 — Se reusa el flujo de Fase 2, no se escribe uno nuevo

`POST /api/subscriptions/preapproval` ya existe en `apps/admin` y ya resuelve el tenant
por `preapprovalId` con `SECURITY DEFINER` (ADR-026, item 68). El checkout de Fase 3 es
**UI sobre ese endpoint**.

**Lo que Fase 3 agrega:**

1. Un paso de UI que hace la reserva condicional antes del POST (ADR-028, item 69), para
   que el doble click no cree dos preapprovals.
2. La página de retorno, que ya existe partially (`checkout/success`, `checkout/pending`,
   `checkout/failure` son del **flujo de tienda**, no del de plataforma — hay que revisar
   que no se mezclen).

### 5.2 D11 — Los items 65 y 67 se resuelven en Fase 3, antes del checkout

La auditoría de Fase 2 lo pidió textual: _"H-F2-3 y H-F2-5 antes de que exista la UI.
Ambos causan estados irrecuperables."_

| Item   | Qué                                                                                 | Por qué antes de la UI                                                                                                       |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **65** | El 409 de doble click omite `initPoint`, y **un test consagra la forma equivocada** | Con botón, el doble click es el camino normal. Hay que arreglar el handler **y el test**, o el test sigue consagrando el bug |
| **67** | `external_reference` sin validar puede producir 500                                 | Un 500 en el checkout es un tenant perdido, y no se nota hasta que hay usuarios reales                                       |

**El item 65 es el que más importa**, y no por el 409: porque **el test consagra la forma
equivocada**, arreglarlo es cambiar un test que hoy está verde. Es la clase de trabajo que
se pospone y después cuesta.

### 5.3 Activación

El webhook de plataforma ya activa la suscripción. Fase 3 **agrega** el paso de
`tenants.status`:

```
applyTransition(...)  →  subscriptions.status = 'active'   ✅ ya existe
activateTenant(...)   →  tenants.status      = 'active'   🆕 D5
```

**Orden:** la suscripción primero. Si `activateTenant` falla, el tenant queda `pending`
con una suscripción `active`, que es recuperable (el superadmin fuerza, CU-6) y
preferible a un tenant `active` sin suscripción, que es un cliente cobrando sin pagar.

---

## 6. Uso de `transitionSubscription` (item 61)

Esta es la sección que el spec marcó como obligatoria. La respuesta tiene tres partes.

### 6.1 D12 — Reusar, extender no, ni funciones genéricas

| Decisión          | Contenido                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reusar**        | Toda transición de `subscriptions.status` del flujo nuevo pasa por `transitionSubscription(tx, tenantId, from, to, patch)`. Sin excepciones. |
| **Extender**      | **Nada.** No se le agrega `patch` para otros campos, ni un flag, ni una variante con `WHERE` opcional.                                       |
| **Función nueva** | `activateTenant(tx, tenantId)` para `tenants.status` (§2.2). Hoja propia, mismo patrón.                                                      |

**Por qué no una abstracción genérica tipo `updateWhere(table, tenantId, values)`.** El
diseño del item 61 (§9) nombra el riesgo exacto: que la función se vuelva un cajón de
sastre. Una abstracción genérica **es** el cajón de sastre desde el primer día, y además
reintroduce el problema que D5 acaba de resolver: volvería imposible saber, leyendo la
firma, si el `WHERE` incluye `status` o no.

**El criterio para el futuro:** si aparece una tercera transición que no encaja en
`transitionSubscription` ni en una hoja propia, se escribe una tercera función. **Tres
funciones que dicen qué hacen** son mejores que **una función que puede hacer todo.**

### 6.2 D13 — Los endpoints nuevos de Fase 3 llevan test de integración en 2 capas

El aprendizaje del item 61 no es "usar la función". Es que **la función es testeable con
Neon y el `WHERE` es observable ahí**, y que RLS lo enmascara.

**Regla para cada endpoint nuevo de Fase 3 que escriba en tabla con RLS:**

| Capa | Rol                                | Verifica                                                   |
| ---- | ---------------------------------- | ---------------------------------------------------------- |
| 1    | `DATABASE_APP_URL` (sin BYPASSRLS) | Comportamiento real + compare-and-set                      |
| 2    | Owner con BYPASSRLS                | Que el `WHERE` es el único guard y por lo tanto observable |

**Con la mutación del filtro aplicada, la capa 2 tiene que fallar.** Si pasa, el test no
está probando el filtro: está probando RLS. Ese es el criterio de aceptación, y es el
mismo que usó el item 61.

**Con el item 78 de fondo:** la suite completa flakea ~1 de cada 4-5 corridas, y Fase 3
agrega tests de integración. **Por eso el DoD de cada task reporta el archivo en
aislamiento**, no "la suite pasó". Una verde de suite completa no es evidencia de nada
cuando hay un flake conocido sin culprit.

### 6.3 D14 — Los 45 call sites existentes no se migran, pero sí se declaran

Hay **45 call sites de `withTenantContext` en producción** (23 en `admin`, 16 en
`storefront`, 6 en `commerce`) — verificado, más que los "30" que decía el diseño del
item 61.

**No se migran en Fase 3.** Es deuda con su propio ritmo. Pero:

1. El código nuevo de Fase 3 sigue el patrón correcto desde el día uno.
2. **La regla de revisión (D14)** para el código nuevo: todo endpoint nuevo que escriba en
   tabla de negocio entra en §6.2. El existente se migra cuando se toque.

**Sobre el item 62** (un nombre puede hacer el trabajo de una review), esto es lo que la
auditoría pidió: la garantía de los endpoints nuevos depende de que el test exista, no de
que el nombre sea correcto. El design acepta eso con una condición: **si un endpoint nuevo
no puede tener su test de 2 capas, no entra.** Un endpoint sin test de integración es un
endpoint cuyo `WHERE` nadie verifica.

---

## 7. Subdominio, branding y tests

### 7.1 D15 — El subdominio se elige en el registro y se activa con el pago

`slug` se elige y se reserva en el paso (1). El subdominio **no resuelve** hasta que el
tenant está `active` (D2).

**Consecuencia para el email de verificación:** el link se construye con
`getStorefrontBaseUrl(request)`, nunca con `STOREFRONT_URL` (R4). En el paso (1) el
request viene del host de la plataforma, así que el link es a la plataforma, no al
subdominio del tenant.

### 7.2 D16 — Branding como fase posterior del MP

`customDomain` ya existe en schema y no se usa. Fase 3 **no** lo activa: resolver
`customDomain` ya está en el proxy (L38), pero la emisión y verificación del dominio es un
flujo propio con DNS, y no bloquea el onboarding.

**Lo que sí entra:** branding básico (nombre y logo) en el mismo paso que el subdominio.
Es un campo más y no agrega un flujo.

### 7.3 Estrategia de tests de Fase 3

| Tipo                      | Qué cubre                                                                | Dónde                              |
| ------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Integración Neon, 2 capas | `WHERE` y aislamiento de cada endpoint nuevo                             | `__tests__/` junto al route        |
| Integración Neon, 1 capa  | `tenants.status` (sin RLS, §2.2)                                         | junto a `tenant-lifecycle.test.ts` |
| Unitario                  | Reglas de negocio puras: prorrateo, slug reservado, transición de emails | `__tests__/` junto al módulo       |
| E2E                       | El recorrido de onboarding completo en Preview                           | `e2e/`                             |

**El E2E es el que no existe y el que más valor da**, porque el onboarding es un flujo
con estado distribuido entre email, checkout y webhook. Requerirá `E2E_WEBHOOK_TEST=1`
en Preview (ya configurado) para no depender de MP real.

---

## 8. Decisiones del design

| #   | Decisión                                                      | Estado                                          |
| --- | ------------------------------------------------------------- | ----------------------------------------------- |
| D1  | `PLATFORM_HOST` en el proxy, antes de los fallbacks           | Propuesta                                       |
| D2  | El proxy filtra `status = 'active'`                           | Propuesta — **sin esto el pgEnum es cosmético** |
| D3  | `tenantId` pre-generado en la app, alta en una transacción    | Propuesta                                       |
| D4  | `tenants.status` → `pgEnum`, default `pending`, sin RLS       | Aprobada en spec (P2)                           |
| D5  | `activateTenant` como función propia; test de 1 capa          | Propuesta                                       |
| D6  | Email + password, sin OAuth social en Fase 3                  | Propuesta                                       |
| D7  | Verificación de email no bloqueante                           | Propuesta                                       |
| D8  | Lista de slugs reservados; slug nunca se reutiliza            | Propuesta                                       |
| D9  | Token manual de MP en V1; OAuth diferido                      | Propuesta — resuelve P3                         |
| D10 | Reusar `/api/subscriptions/preapproval`, sin flujo nuevo      | Propuesta                                       |
| D11 | Items 65 y 67 antes del checkout                              | Propuesta — la auditoría lo pidió               |
| D12 | Reusar `transitionSubscription`, extender nada, hoja por caso | Propuesta                                       |
| D13 | Todo endpoint nuevo con test de 2 capas                       | Propuesta                                       |
| D14 | Los 45 call sites no se migran; la regla es para código nuevo | Propuesta                                       |
| D15 | Slug en el registro, subdominio activo con el pago            | Propuesta                                       |
| D16 | Branding básico entra; `customDomain` queda fuera             | Propuesta                                       |
| D17 | P5: `past_due` permite vender durante la gracia, no publicar  | **APROBADA (2026-10-09)**                       |
| D18 | P6: slug nunca se reutiliza + 16 reservados                   | **APROBADA (2026-10-09)**                       |

### 8.1 D17 — La regla de "puede vender" (spec P5) — APROBADA 2026-10-09

El transversal §2 sugiere que `past_due` es "limitado" pero no define el límite. Este
design propone:

| `tenants.status` | `subscriptions.status`  | ¿Publica? | ¿Vende?                                            |
| ---------------- | ----------------------- | --------- | -------------------------------------------------- |
| `pending`        | `pending_first_payment` | No        | No                                                 |
| `active`         | `active`                | Sí        | Sí                                                 |
| `active`         | `past_due`              | **No**    | **Sí**, durante la gracia (3 días, transversal §3) |
| `active`         | `cancelled`             | No        | No — storefront en read-only hasta fin de período  |
| `active`         | `expired`               | No        | No                                                 |
| `suspended`      | cualquiera              | No        | No                                                 |
| `cancelled`      | cualquiera              | No        | No                                                 |

**La asimetría de `past_due` es deliberada:** el comprador no falló el pago, el tenant sí.
Cortarle la tienda castiga al que no corresponde.

**Reversibilidad:** es un guard sin migración. Si la práctica lo desmiente, se cambia la
regla sin tocar el schema. Por eso no bloquea el plan.

### 8.2 D18 — Slug: nunca se reutiliza (spec P6) — APROBADA 2026-10-09

**Es seguridad, no naming.** Un slug liberado deja contenido cacheado, links viejos de
compradores del tenant cancelado, y URLs que resuelven al nuevo tenant sin que nadie lo
sepa.

Los 16 slugs reservados cubren los que rompen infraestructura.

---

## 9. Lo que este design NO decide

- **OAuth de MP.** Diferido explícitamente (D9). Es una decisión de coste, no de
  arquitectura.
- **Los 45 call sites.** Deuda (§6.3).
- **Si `subscriptions.status` pasa a enum.** No es necesario y agrega una migración sin
  beneficio observable.
- **`customDomain`.** Fase 4 (D16).
- **2FA, SSO, marketplace de apps.** Fuera de alcance.

---

## Ref

Spec: `docs/superpowers/specs/2026-10-09-fase3-autoservicio-tenants.md` ·
`docs/superpowers/specs/2026-09-subscription-lifecycle.md` ·
`vault/04_Fases/diseno-item-61-cross-tenant.md` · `vault/04_Fases/auditoria-fase2.md` ·
ADR-026 · ADR-027 · ADR-028 · items 61, 62, 65, 67, 74, 78, 90 · issue #238
