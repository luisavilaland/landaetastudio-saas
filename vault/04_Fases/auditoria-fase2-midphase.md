# Auditoría mid-phase de Fase 2 — Webhook de suscripciones T1–T5

**Proyecto:** SaaS eCommerce multi-tenant
**Blueprint:** v2.6 · **Spec transversal:** `docs/superpowers/specs/2026-09-subscription-lifecycle.md`
**Fecha:** 2026-10-05 · **Rama:** `chore/audit-fase2-midphase`
**Alcance:** T1–T5 (migración, env, helpers, endpoints, webhook handler), coherencia documental, deuda 48–55 y drift de proceso.
**Modalidad:** Auditoría read-only. No se modificó código de producción.
**Base de comparación:** `develop` en `260bb39`, 678/678 tests en 68 archivos.

> **Mid-phase, no cierre.** Esta auditoría no valida la Fase 2 como terminada: valida que lo ya mergeado no muerda en T6, T7 y T8. El cierre formal corresponde cuando las tres estén hechas.

## Resumen ejecutivo

La implementación de T1–T5 es **sustantivamente coherente en su estructura** y respeta las convenciones del proyecto: los helpers de T3 están correctamente centralizados, la idempotencia por convergencia funciona como está diseñada, el aislamiento multi-tenant de los endpoints funciona y `pause`/`cancel` comparten una ruta de mutación sin triplicar el flujo.

Sin embargo, la auditoría encontró **tres defectos funcionales confirmados que impiden cerrar la fase como está**. No son deuda documental: son comportamiento que no cumple lo que la documentación y los endpoints prometen.

El más grave es un choque entre la estrategia de resolución de tenant del webhook y las políticas RLS de la base. **La "estrategia L" del handler nunca resuelve.** La consulta que debería leer `subscriptions` por `mpPreapprovalId` se ejecuta con la conexión directa, fuera de `withTenantContext`, sobre una tabla con `FORCE ROW LEVEL SECURITY` cuya policy compara contra `current_setting('app.tenant_id', true)`. Sin el `SET LOCAL`, esa función devuelve `NULL`, la comparación no es verdadera y **la query retorna cero filas siempre**. El sistema cae siempre a la estrategia remota. El índice único parcial que T1 creó para_supportar esta estrategia nunca se usa en el caminoapasado.

Esto ya estaba probado en el repositorio: `packages/db/src/__tests__/rls-cross-tenant.test.ts:333` se titula *"sin set_tenant_id una conexión nueva devuelve cero filas RLS"*. El proyecto demonstrationó el comportamiento y después loupidieron en el código del webhook.

El segundo defecto es que **`pause` devuelve `202` sin confirmación posible**: la función `decideTarget` no tiene ningún target `paused`, así que el evento que debería confirmar la pausa no aplica transición alguna. En consecuencia `resume`, que exige `allowedFrom: ['paused']`, es inalcanzable. El tercer defecto es que **`planId` no se escribe nunca** después de la creación, pese a que `PUT /plan` devuelve `202` diciendo que el webhook lo confirma.

### Bloqueantes antes de T6

1. **Estrategia L muerta por RLS (H1).** Ningún test de integración real de la resolución local de tenant puede pasar. El índice de T1 queda sin cobertura porque la ruta que lo usa no existe en la práctica.
2. **`pause` sin confirmación y `resume` inalcanzable (H2).** El flujo pausa→reanudar no funciona de punta a punta. El e2e correspondiente no puede pasar.
3. **`planId` nunca se escribe (H3).** El cambio de plan devuelve `202` y la base sigue reportando el plan original para siempre. Un `409 "Ya tenes ese plan"` puede dispararse contra un estado que no refleja la realidad.
4. **Decisiones de Fase 2 sin registro arquitectónico.** Event order B, `paused` como único estado reversible e idempotencia por convergencia viven solo en spec, design y bitácora. `vault/01_ADRs/` termina en ADR-025. Sin ADR, la Fase 3 re-debate estas tres decisiones desde cero.

## 1. Consistencia interna T1–T5

### Centralización de helpers de T3 — conforme

Los cuatro helpers de T3 son la única fuente de su responsabilidad. Verificado con `grep` sobre `apps/` y `packages/`:

| Helper | Consumidor | Conversiones inline residuales |
| --- | --- | --- |
| `derivePermissions` | Solo `GET /api/subscriptions` (`route.ts:4`) | N/A |
| `calculateProration` | `PUT /plan` | 0 |
| `classifyMpEvent` | Handler del webhook | 0 |
| `toMpAmount` | 3 usos (item 48 aplicado) | 0 |

`fromMpAmount` no tiene consumidor en producción: solo export y tests. Es defensivo y coherente con el item 48.

Los `/ 100` presentes en `packages/commerce/src/email.ts` son legítimos: formatean un precio para mostrar en un email. No son una conversión de borde a MP y no deben unificarse con `toMpAmount`.

### Permisos en dos lugares — sin test de enlace (MEDIO)

La matriz `derivePermissions` decide qué botón se muestra; los `allowedFrom` hardcodeados de cada endpoint deciden si funciona. Son dos fuentes de verdad y solo el `GET` consulta la matriz. Ningún test afirma que coincidan.

El item 51 ya sufrió exactamente este modo de fallo: `canCancel: true` en la matriz sin tocar `POST /cancel` habría producido un botón que siempre devuelve `409`. Se corrigieron las dos capas a mano. Sin un test de enlace, el próximo estado nuevo repite el problema.

**Evidencia:** `REVIVABLE = ['pending_first_payment', 'past_due', 'expired']` y `CANCELLABLE = ['active', 'past_due', 'paused']` en `route.ts:56-59`; `allowedFrom` en `cancel/route.ts:35`, `pause/route.ts:26`, `resume/route.ts:27`, `plan/route.ts:143`. El único consumidor de `derivePermissions` en `apps/admin` es la ruta del GET.

### Guard de `live_mode` no implementado (MEDIO)

`liveMode` se calcula en `route.ts:168`, se propaga hasta `applyTransition` y **nadie lo lee**. La regla del design (`live_mode === false` en producción → no procesar) no existe. Los tests cubren solo la ausencia de la clave, y `handler.test.ts:180` fija `NODE_ENV` a `development`, lo que hace la rama de producción intestable.

Es correcto tratar "ausente" como distinto de `false` (el spike T0 verificó que `live_mode` solo viene en el topic `payment`). Pero el parámetro debe leerse o eliminarse.

## 2. Defectos funcionales confirmados — bloquean T6

### H1 [CRÍTICO] — La estrategia L nunca resuelve: RLS devuelve cero filas

**Descripción.** `withTenantContextByPreapproval` resuelve el tenant con una consulta sobre `db` directo, no dentro de `withTenantContext`. `subscriptions` tiene `FORCE ROW LEVEL SECURITY` y policy `USING ("tenantId" = current_setting('app.tenant_id', true)::UUID)`. El cliente `db` usa `DATABASE_APP_URL`, cuyo rol es `app_user` sin `BYPASSRLS`.

Sin `set_tenant_id` ejecutado, `current_setting('app.tenant_id', true)` devuelve `NULL`. `"tenantId" = NULL` evalúa a `NULL`, no a `TRUE`. La policy no deja pasar la fila y **la consulta retorna cero filas siempre**, independientemente del `WHERE`.

**Evidencia (las tres premisas verificadas individualmente):**

| Premisa | Verificación |
| --- | --- |
| Query con `db` directo | `route.ts:401-405` — `await db.select(...).from(dbSubscriptions).where(eq(dbSubscriptions.mpPreapprovalId, preapprovalId))` |
| `FORCE RLS` + policy | `0000_baseline.sql:229` (`ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY`) y `:248` (policy) |
| Rol sin bypass | `packages/db/src/index.ts:6-13` — `throw` explícito: *"Usa un rol sin BYPASSRLS (ej: app_user)"* |
| `set_config` es transaccional | `0000_baseline.sql:205` — `set_config('app.tenant_id', ..., true)`, el `true` es `is_local` |
| El comportamiento ya está probado | `rls-cross-tenant.test.ts:333` — *"sin set_tenant_id una conexión nueva devuelve cero filas RLS"* |

**Por qué el comentario del código no lo detecta.** El docstring en `route.ts:392-396` justifica la consulta así: *"Es seguro: solo se LEE y el filtro es el índice único parcial, que es por definición de un solo tenant."* Ese razonamiento confunde dos cosas: que el `WHERE` sea selectivo y que RLS deje pasar la fila. RLS aplica su filtro **independientemente y antes** del `WHERE`. Un `WHERE` muy específico no ayuda. La unicidad de `mpPreapprovalId` es irrelevante para la policy.

**Consecuencias:**
- La estrategia L nunca resuelve; toda resolución pasa por la estrategia R (GET remoto a MercadoPago).
- El índice `subscriptions_mp_preapproval_idx` de T1 no se usa en el camino principal.
- Si MP está caído o lento, cada evento termina en `tenant_unresolved` con `200`: **evento perdido en silencio**.
- La ruta R hace **dos** `GET /preapproval` por evento (resolución en `route.ts:375` y manejo en `:321`), latencia amplificada.

**Anti-duplicación:** no registrado. El item 36 menciona la estrategia L como diseño pero no discusses el choque con RLS.

**Recomendación.** Resolver el chicken-and-egg: el tenant es lo que se está buscando, así que no se puede abrir un contexto de tenant para buscarlo. La salida es una policy de bootstrap que permita el lookup por `mpPreapprovalId` sin `app.tenant_id` —por ejemplo una policy `SELECT` adicional limitada a esa columna, o un rol de servicio con `BYPASSRLS` restringido a lectura de `subscriptions`. Requiere decisión de arquitectura y skill `rls-audit`. Antes de eso, el test que "prueba" la estrategia L (`handler.test.ts:164-176`) debe marcarse como mock unitario, no como evidencia de la estrategia L.

### H2 [ALTO] — `pause` devuelve 202 sin confirmación posible; `resume` inalcanzable

**Descripción.** `decideTarget` tiene exactamente tres targets: `cancelled` (L555), `active` (L563, L570) y `past_due` (L575). **No existe target `paused`.** El propio comentario lo dice en L560-561: *"`approved === false` aquí significa que MP no está en `authorized` (por ejemplo `paused`), y en ese caso no hay transición."*

La cadena rota:
1. `POST /pause` devuelve `202` y no escribe estado local (`mutate.ts:34-36`: *"No escribe el estado local... lo hace el webhook"*).
2. Llega el evento `subscription_preapproval` con `authorized: false`.
3. `decideTarget` devuelve `null` → `{ applied: false, reason: 'no_transition' }`.
4. El tenant queda `active` para siempre.
5. `POST /resume` exige `allowedFrom: ['paused']` → **siempre 409**.

El caso inverso también falla: si el tenant pausa desde el panel de MercadoPago, el webhook no lo refleja. El design promete lo contrario en `2026-10-01-fase2-design.md:611-616` y `:636-641`.

**Consecuencia documental grave:** tres documentos ya mergeados afirman lo que el código no hace — `deuda-tecnica.md:1657-1659` (item 49), la nota de cierre del issue #168 ("la transición la confirma el webhook") y el `mutate.ts` mismo.

**Anti-duplicación:** no registrado como hueco de código. Los items 38, 49 y 51 hablan de `paused` pero ninguno cubre al handler.

**Recomendación.** Decidir el dueño real de la transición. La opción más coherente con lo ya mergeado: que `pause`/`resume` escriban localmente dentro de `withTenantContext` y que el webhook actúe como reconciliador, no como confirmador obligatorio. Si se mantiene "el webhook confirma", hay que agregar a `decideTarget` los tres renglones que el design ya especifica.

### H3 [ALTO] — `planId` nunca se escribe: divergencia permanente y `409` engañoso

**Descripción.** `PUT /plan` devuelve `202` con el comentario *"El plan no se escribe en la DB. Lo hace el webhook"* (`plan/route.ts:41-42`). El handler **no menciona `planId` en ningún punto**: cero coincidencias de `planId|priceUyu|transaction_amount` en sus 629 líneas. Cero escrituras de `planId:` en toda `apps/admin`.

La base queda reportando el plan de creación para siempre. Al querer volver al plan original, `PUT /plan` responde `409 "Ya tenes ese plan"` (`plan/route.ts:136`) contra un estado que no refleja la realidad. El warn de monto divergente que pide el design (`fase2-design.md:643`) tampoco existe.

**Anti-duplicación:** no registrado.

**Recomendación.** En `applyTransition`, si el evento trae el monto esperado, escribir `planId`. Alternativa: eliminar el `202` y devolver `200` informativo, documentando explícitamente que `planId` local significa "plan de creación" y que la verdad vive en MercadoPago. Lo que no es sostenible es dejarlo en un comentario de route.

## 3. Coherencia documental

### Transversal se contradice sobre `paused → cancelled` (MEDIO)

`2026-09-subscription-lifecycle.md:46` dice `paused --> cancelled : POST /api/subscriptions/cancel (no expuesto aún por la API)`. El mismo documento, en `:79-82`, afirma que la transición **sí** está expuesta y que `derivePermissions` devuelve `canCancel: true`. El código sigue `:79-82` (`CANCELLABLE` incluye `paused`).

No es un error de contenido sino de mantenimiento: §2 se actualizó al cerrar el item 51 y §1 no. Un documento normativo que se contradice deja de servir como fuente de verdad. La skill `rls-audit` y el propio repo suffered el mismo modo de fallo en el item 38, invertido.

**No se encontró una segunda contradicción de este tipo** en §1, §2 ni §6: el mapeo de eventos de §6 es coherente con el handler y con el spike.

### Comentarios obsoletos sobre el número de estados (BAJO)

Después del PR #191 el transversal lista 7 estados, pero el código y su test siguen diciendo lo contrario:
- `packages/commerce/src/subscription-permissions.ts:15` — *"`paused` es el único estado que el transversal **todavía NO lista**"*
- `packages/commerce/src/subscription-permissions.test.ts:11,23-24` — *"Hoy el transversal dice 6 estados"* y un `TODO(transversal)` ya resuelto.

El riesgo ahora es invertido: alguien que lea el comentario puede "corregir" el código borrando `paused`.

### Design §6.3 incompleto respecto de las decisiones tomadas (MEDIO)

Tres cosas aprendidas en T5 viven solo en código y bitácora:

| Qué | Dónde está | Dónde falta |
| --- | --- | --- |
| Event order B (activar desde `subscription_preapproval`) | Handler `route.ts:21-24`, bitácora | Design §6.3 mapea el alta correctamente pero **no explica por qué**; el spike recomienda lo contrario (`spike-t0-resultado.md:496`) |
| `data.id` significa tres cosas según el topic | Handler `route.ts:26-29` | Design §6.3 no tiene la tabla |
| Activación por preapproval no guarda `invoiceId` | Bitácora, item 53 | Design §6.3:600 lo pide todavía |

La primera es la más peligrosa: sin la justificación en el design, un developer que lo lea implementará event order A, que es lo que el spike Measurements recomendar.

### Blueprint v2.6 desactualizado en 5 puntos

Ninguno rompe el sistema; todos induicen a error a quien construya desde el blueprint.

| Punto | Ubicación | Realidad | Item |
| --- | --- | --- | --- |
| "Estados (6)" | `:104-113` | 7, con `paused` | Nuevo (49 cubre el transversal, no el blueprint) |
| Webhook `/subscriptions/:tenantId` | `:258` | URL literal; MP no hace path templating | 37 |
| Eventos `preapproval.created`/`.canceled` | `:260` | Topics reales: `subscription_preapproval`, `subscription_authorized_payment`, `payment` | 35 |
| Schema `tenant_id`/`mp_preapproval_id` | `:229-231` | camelCase | 9 |
| Fase 2 "3-4 días" | `:255` | 10 días según el plan vigente | Nuevo |

Además, la tabla de hoja de ruta (`:187`) sigue marcando Fase 2 como "Pendiente" cuando T1–T5 están mergeadas.

**El blueprint no debe usarse como fuente de verdad para construir.** La cadena real es transversal → design → plan. Actualizarlo es una tarea con nombre propio, no un retoque: son 443 líneas y las 10 fases arrastran el mismo desfase.

### Contadores de tests (MEDIO)

Cuatro documentos declaran **679 tests / 69 archivos**. La medición real es **678 / 68** (`vitest run`: `Test Files 68 passed (68)`, `Tests 678 passed (678)`).

| Archivo | Línea | Tipo | Acción |
| --- | --- | --- | --- |
| `README.md` | 515 | Estado actual | Corregir |
| `SETUP.md` | 454 | Estado actual | Corregir |
| `TESTING.md` | 295 | Estado actual | Corregir |
| `TESTING-MANUAL.md` | 225 | Estado actual | Corregir |
| `README.md` 522–536, `SETUP.md` 559–577, `TESTING.md` 319–328 | — | Historial append-only | **No tocar** |

Verificación de conteo: 83 archivos de test en disco = 68 de vitest + 15 de `e2e/` (Playwright, runner separado). La aritmética cierra exacta.

### Documentos de onboarding (BAJO)

- `vault/05_Specs/arquitectura.md:3` dice "Última revisión: 2026-09-17" y su sección "Blueprint vigente" no indexa spec, design ni plan de Fase 2.
- `PROMPTS.md:72-80` no advierte que los worktrees de Paseo no traen `node_modules` ni `.env.local`, ni documenta el path absoluto de `gh` ni el `Remove-Item Env:GITHUB_TOKEN` previo.
- `AGENTS.md:633` dice "SDD todavía no está inicializado en este repo" mientras `AGENTS.md:652` dice que **está** inicializado en modo hybrid. El item 50 se marcó resuelto pero corrigió solo el segundo. `SETUP.md:350` sí quedó bien.

## 4. Encoding drift

Verificado por enumeración de codepoints, no por regex.

| Archivo | `U+FFFD` | CJK |
| --- | --- | --- |
| `vault/02_Bitacora/bitacora.md` | 36 | 8 |
| `vault/03_Deuda/deuda-tecnica.md` | 1 | 0 |

**Los `U+FFFD` están concentrados.** 30 de los 36 están en una sola entrada del 2026-08-11 (`bitacora.md:936-945`), donde un reemplazo bulk destruyó acentos: `est? vac?o`, `Migraci?n`, `diagn?stico`, `pod?a`, `realine?`. Los 6 restantes son aislados (`:855`, `:861`, `:864`, `:1560`). Esto los hace **acotados y reparables**: un rango, una fecha.

El `U+FFFD` de `deuda-tecnica.md:501` es el residuo que el propio item 26 documenta. No es un defecto vivo, es evidencia: no corregirlo sin decidir antes.

**Los 8 CJK son falsos positivos.** Están en `bitacora.md:976-977` y son una entrada del 2026-08-15 que documenta haber **corregido** un texto chino en `SECURITY.md`, citando el original como evidencia. Se verificó que `SECURITY.md` sigue limpio. Un scan que solo busque CJK sobre este archivo produciría un falso positivo; por eso el item 40 insiste en enumerar codepoints.

**Item 52: los caracteres de control originales ya no están.** El escaneo por codepoint sobre los 8 archivos de T4/T5 da **0** control chars. El defecto se corrigió. Lo que queda es que la mitigación del item 52 **nunca se aplicó al item 40**: el scan del item 40 (`deuda-tecnica.md:913-919`) sigue cubriendo solo CJK y `U+FFFD`, y la rama de control chars existe únicamente como texto dentro del item 52.

## 5. Drift de proceso

### Revisión de merges

Los cinco PRs del bloque fueron mergeados con `reviewDecision: APPROVED` por EdgarVz: #184, #185, #186, #189, #193.

Sobre el PR #189: su body declara `reviewDecision: REVIEW_REQUIRED` y *"No mergear sin review de Luis"*, pero el review existe y la aprobación es previa al merge. **El gate no fue saltado**; el body quedó desactualizado respecto de lo que finalmente pasó. Es un defecto de documentación del PR, no de proceso.

### Issues cerrados automáticamente

| Issue | PR | ¿Cerrado por el PR? |
| --- | --- | --- |
| #165 T1 | #184 | Sí |
| #166 T2 | #185 | Sí |
| #167 T3 | #186 | Sí |
| #169 T5 | #193 | Sí |
| **#168 T4** | **#189** | **No — faltaba `Closes #168`** |

#168 quedó abierto 3 días después del merge por esa única omisión. Se cerró manualmente el 2026-10-05 con una nota de scope correcta (5→6 endpoints). **Único caso de la serie**: los otros cuatro PRs sí declararon su cierre.

### Descalibración del informe del subagente

El subagente de coherencia documental reportó que la bitácora carecía de entradas T1–T4. **Es falso, y el hallazgo fue descartado.** Las cinco entradas dedicadas existen:

| Entrada | Línea |
| --- | --- |
| `## 2026-10-03 - T1 Fase 2: indice unico parcial` | 2269 |
| `## 2026-10-03 - T2 Fase 2: MP_PLATFORM_* obligatorias` | 2344 |
| `## 2026-10-03 - T3 Fase 2: helpers de dominio` | 2452 |
| `## 2026-10-03 - T4 Fase 2: 6 endpoints` | 2716 |
| `## 2026-10-04 - T5: handler completo del webhook` | 2987 |

El patrón de búsqueda usado (`2026-.*T[0-9]\s+Fase 2`) no matchea el título de T5, que no dice "Fase 2". De esa exclusiónylanó la conclusión invertida. Se deja constancia porque un patrón de búsqueda que no cubre el objeto que se busca produce un hallazgo inventado, y eso erosiona la confianza en el resto del informe.

El mismo subagente Infló severidades: clasificó como CRÍTICO dos divergencias documentales que no rompen comportamiento. Fueron reclasificadas.

## 6. Deuda técnica — estado de aplicación

| Item | Sev. | Estado verificado | Nota |
| --- | --- | --- | --- |
| 48 | — | ✅ Aplicado | 3 usos de `toMpAmount`, 0 inline |
| 49 | — | ⚠️ Parcial | Transversal sí; comentarios del código siguen diciendo 6 estados |
| 50 | — | ❌ Incompleto | `AGENTS.md:633` contradice a `:652` |
| 51 | — | ✅ Aplicado | Matriz **y** `allowedFrom` corregidos (ambos capas) |
| 52 | — | ❌ No aplicado | Mitigación nunca volcada al item 40; los chars originales ya no están |
| 53 | — | ✅ Coherente | Solo `payment` escribe la columna; convergencia en el resto |
| 54 | BAJA | 🔵 PR #196 abierto | Ciclo de Engram ensucia el working tree |
| 55 | MEDIA | 🔵 PR #196 abierto | GGA no cubre `.md`; alcance confirmado contra `.gga` |

**Ítems blockers de Fase 2 que siguen abiertos:** #44 (seed trunca producción en CI), #46 (seed no trunca `subscriptions`), #47 (validación de env global, no per-app). El #47 tiene fix temporal aplicado en Vercel y fix definitivo pendiente.

## 7. Riesgos para T6, T7 y T8

### Antes de T6

1. **Resolver H1.** Sin la estrategia L funcionando, el test de integración real de resolución de tenant no puede pasar. Es la tarea de mayor riesgo: toca RLS, una policy y posiblemente un rol de base de datos.
2. **Resolver H2 y H3 o cambiar la promesa.** Los tests de integración tienen que poder verificar lo que los endpoints prometen. Hoy `pause` y `plan` prometen confirmación que no llega.
3. **Añadir el test de enlace de permisos** (§1). Es barato y evita el modo de fallo del item 51.

### Antes de T7

1. Corregir la contradicción del transversal en `:46`.
2. Documentar en design §6.3 el event order B con su justificación, la tabla de los tres significados de `data.id` y la decisión del item 53.
3. Corregir los 4 contadores de tests. **No tocar** las entradas de historial.
4. Actualizar el docstring y el `TODO` obsoletos de `subscription-permissions.ts`.
5. Completar el item 50 en `AGENTS.md:633`.

### Antes de T8

1. **Crear ADR-026 y ADR-027.** Event order B + idempotencia por convergencia, y `paused` como único estado reversible con cancelación terminal. Sin esto, las decisiones de Fase 2 no tienen registro arquitectónico.
2. Actualizar el blueprint o marcarlo explícitamente como **no normativo**, para que nadie construya desde él.
3. Indexar spec, design y plan de Fase 2 en `arquitectura.md` y actualizar su fecha.
4. Decidir qué ítems de deuda abiertos se aceptan explícitamente en el cierre.

## 8. Hallazgos nuevos a registrar en deuda

Ninguno de estos está en `deuda-tecnica.md` a la fecha de esta auditoría:

1. La estrategia L del webhook nunca resuelve por RLS (H1, CRÍTICO).
2. `pause` sin confirmación y `resume` inalcanzable (H2, ALTO).
3. `planId` nunca se escribe (H3, ALTO).
4. Guard de `live_mode` calculado y nunca leído (MEDIO).
5. Matriz de permisos y `allowedFrom` sin test de enlace (MEDIO).
6. Decisiones de Fase 2 sin ADR (ALTO).
7. Event order B, los tres significados de `data.id` y el item 53 ausentes del design §6.3 (MEDIO).
8. Blueprint v2.6 desactualizado en 5 puntos y Fase 2 marcada "Pendiente" (BAJO).
9. Item 52 mitigado en el item 40 (BAJO).
10. Item 50 incompleto en `AGENTS.md:633` (BAJO).
11. 30 `U+FFFD` concentrados en `bitacora.md:936-945` (MEDIO, acotado).

## Limitaciones de la auditoría

- **Ningún comando del DoD se ejecutó.** El worktree de Paseo no tiene `node_modules` ni `.env.local`. Los conteos de tests citados en los subagentes son estáticos (`it`/`describe`), no el total real; el total real (678/68) se verificó aparte en el worktree principal.
- **H1 no se confirmó contra una base de datos real.** La verificación es estática: policy, cliente y comportamiento ya probado por `rls-cross-tenant.test.ts`. La ejecución del handler contra DB real es precisamente T6.
- **No se verificó si MercadoPago envía `data.id` en query-string o solo en body.** Requiere una entrega real.
- **El escaneo de control chars cubrió los 8 archivos de T4/T5**, no todo el repositorio.
- **Los items 54 y 55 no se auditaron en profundidad**; su estado se verificó vía `gh` y contra `.gga` local.
- **Las aprobaciones de PR se verificaron por metadata**, no leyendo cada review.

## Limitación de esta auditoría sobre sí misma

Los subagentes corrieron en modo `plan`, que deshabilita herramientas de edición pero **permite bash**. Un agente con bash puede escribir un archivo. Se verificó que el worktree de auditoría quedó con **0 archivos modificados** y que el worktree principal quedó limpio, así que la separación cumplió su objetivo. Ninguna afirmación de este documento se apoya en código que los subagentes pudieran haber alterado.

## Conclusión

**T1–T5 no puede cerrarse como está.** La estructura es buena y los helpers están correctamente centralizados, pero tres defectos funcionales confirmados impiden que el flujo de suscripciones cumpla lo que la documentación y los endpoints prometen: la resolución local de tenant nunca funciona, `pause` no se confirma y nunca se puede reanudar, y el plan cambia en MercadoPago pero no en la base.

**Recomendación: no arrancar T6 todavía.** T6 es la tarea de tests de integración, y los tres defectos son exactamente lo que T6 debe detectar. Es tentador usarlos como tests faltantes y seguir, pero eso convertiría T6 en una tarea de fixing con nombre de testing, y sus criterios de salida —cobertura ≥80% y tests verdes— no se pueden cumplir sin antes decidir la arquitectura de la resolución de tenant.

El orden correcto es: decidir y corregir H1, resolver H2 y H3 o ajustar la promesa de los endpoints, y recién entonces arrancar T6 con el flujo funcionando debajo.

Lo que sí puede avanzar en paralelo, porque no depende de los tres defectos: la documentación de T7 (transversal, design, contadores, comentarios) y los ADR de las decisiones de Fase 2.