# Auditoría — Fase 2: Webhook de suscripciones + checkout dinámico

**Proyecto:** SaaS eCommerce multi-tenant
**Fecha:** 2026-10-06 · **Rama:** `audit/fase2-cierre`
**Alcance:** T0–T8 + H1/H2/H3 + mini auditoría T6 (#202) + mini-PRs (#204, #205, #206)
**Base:** `develop` en `8e2c4f9`
**Modalidad:** Auditoría read-only. Ninguna modificación al código de producción.
**Equivalente:** #140 (auditoría de cierre de Fase 1)

## Resumen ejecutivo

**Veredicto: Fase 2 pasa.** Sin hallazgos CRITICAL ni HIGH. No hay nada que
bloquee el arranque de Fase 3 más allá del item 61, que ya estaba declarado
bloqueante antes de esta auditoría.

Lo más importante que encontró esta auditoría no es un defecto de código: es que
**la fase tenía tres defectos funcionales confirmados y ningún proceso los detectó
antes de que llegara a producción.** H1, H2 y H3 estaban escritos y dados por
verificados. No se rompieron al ejecutarse: se nacieron rotos, y la suite los
declaraba buenos.

**Totales: 11 hallazgos de código (0 CRITICAL · 0 HIGH · 6 MEDIUM · 5 LOW) + 1
hallazgo de proceso (ALTO).**

## Metodología

- **Inventario read-only** de la fase: 9 commits, diffstat, documentos, tests,
  coverage medido sobre `coverage-final.json` (no del reporter de texto, que
  oculta archivos).
- **Búsqueda de defectos** por categoría sobre T0–T8 y los fixes H1/H2/H3.
- **5 verificaciones mecánicas:** RLS, firma, separación de secrets,
  idempotencia, orden de convergencia de H3.
- **Verificación independiente de las afirmaciones de los subagentes** contra el
  código y el historial de git. Esto cambió dos severidades.
- **Análisis de 5 procesos** y **4 propuestas** de mecanismos (no implementadas).

**Read-only verificado.** El worktree terminó con un único archivo modificado:
`AGENTS.md`, fix de documentación de esta misma auditoría. Ningún subagente
escribió archivos.

## Inventario

| Métrica         | Valor                                                      |
| --------------- | ---------------------------------------------------------- |
| Commits         | 9 (`41f5a3c..8e2c4f9`)                                     |
| Diffstat        | 43 archivos · +3888 / −103                                 |
| Tests           | **705 en 69 archivos**                                     |
| Coverage global | 78.11% stmts · 67.38% branches · 74.44% fns · 78.66% lines |
| Migraciones     | 3                                                          |
| ADRs nuevos     | 2 (ADR-026, ADR-027)                                       |
| Docs de fase    | 3 (mid-phase #197, T6 #202, cierre #206)                   |

El rango `41f5a3c..8e2c4f9` excluye su propio extremo izquierdo: son 9 commits
**después** de la auditoría mid-phase. Incluyéndola, la fase completa son 10.

**Cifras de coverage.** Esta auditoría midió 78.11% / 74.44% y `cierre-fase2.md`
afirma 78.12% / 74.45%. Diferencia de redondeo de una décima, **no
discrepancia**. El documento de cierre es fiel.

**Sobre branches en 67.38%.** Es la cifra que más preocupa, y la que el cierre no
reportaba. Statements y functions mienten menos: una función puede figurar como
cubierta si se la llamó una vez. Una rama sin cubrir es una decisión que el
código tomó y nadie ejercitó.

## Verificaciones mecánicas

| #   | Check                                                 | Resultado                          |
| --- | ----------------------------------------------------- | ---------------------------------- |
| 1   | Todo query bajo `withTenantContext`                   | **PASS** (1 excepción documentada) |
| 2   | Firma validada antes de cualquier dispatch            | **PASS** (con desvío: H-F2-2)      |
| 3   | Secrets de plataforma vs tenant separados             | **FAIL** → H-F2-9                  |
| 4   | Idempotencia (`lastProcessedPaymentId`)               | **PASS parcial** → H-F2-8          |
| 5   | `verifyPlanAmountConvergence` antes de `decideTarget` | **PASS**                           |

**Check 1.** Único `db.execute` de producción en admin:
`webhooks/mercadopago/subscriptions/route.ts:436` — la función `SECURITY
DEFINER` de ADR-026, blindada por `preapproval-tenant-resolution.test.ts`. Todo
lo demás usa `await withTenantContext`; los 7 call sites usan `await`, así que
la trampa de `return` sin `await` (que bypassea el `try/catch`) no está
presente.

**Check 5.** `verifyPlanAmountConvergence` en `:542-549` → `decideTarget` en
`:551`. Orden correcto: se verifica contra MP antes de transicionar. Cubierto
por 4 tests.

## Hallazgos

### H-F2-1 [ALTO · proceso] — La causa raíz de H1 era un nombre y un comentario, no una falta de tests

**Evidencia:** `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`,
versión previa al fix (`e21e72d~1`), líneas 404–420.

**Impacto.** Tres factores combinados dejaron H1 inadvertido:

**1. Un argumento de seguridad falso, escrito en el propio código:**

```ts
// Es seguro: solo se LEE y el filtro es el indice unico parcial, que
// es por definicion de un solo tenant.
async function withTenantContextByPreapproval(preapprovalId: string) {
  const rows = await db.select({ tenantId: dbSubscriptions.tenantId })
    .from(dbSubscriptions)
    .where(eq(dbSubscriptions.mpPreapprovalId, preapprovalId))
    .limit(1)
```

La premisa es falsa: RLS se aplica **antes** del `WHERE`, así que la función
devolvía cero filas siempre. Confundió **selectividad del índice** con
**permiso de acceso**. El índice de T1 y el filtro eran ambos correctos y ambos
irrelevantes.

**2. El nombre afirmaba la garantía que el código no cumplía.** Se llamaba
`withTenantContextByPreapproval`. Una revisión que greppeara `withTenantContext`
veía el nombre, marcaba el casillero y seguía. **El nombre hizo el trabajo de la
review.**

**3. La prueba que lo refutaba ya estaba en el repo.** El test
`"sin set_tenant_id una conexion nueva devuelve cero filas RLS"`
(`packages/db/src/__tests__/rls-cross-tenant.test.ts:333`) se creó el
**2026-09-24** en `670a7b3`, el commit de cierre de Fase 1. **Doce días antes de
que empezara Fase 2.** Nadie lo conectó con el código nuevo.

**Recomendación.** Dos reglas de revisión, no más código:

1. Un comentario que **justifica saltarse una frontera de seguridad es un
   hallazgo**, no documentación. Exige verificar la premisa contra el motor.
2. Una función cuyo **nombre promete una propiedad de seguridad** debe
   verificarse como si no la cumpliera. Si el nombre dice `withTenantContext`,
   la revisión tiene que abrir el cuerpo.

**Costo estimado:** 1 h (reglas en AGENTS.md + checklist de PR).

### H-F2-2 [MEDIUM] — El `dataId` de la firma se lee solo del body

**Evidencia:** `webhooks/mercadopago/subscriptions/route.ts:151` —
`dataId: parsed?.data?.id ?? ''`. Cero ocurrencias de `searchParams`,
`nextUrl` o `request.url` en todo el archivo.
**Contraste:** `plans/2026-10-01-fase2.md:597` y el checkbox `:639` —
_"`dataId` del query param `data.id`, fallback al body (test de ambos)"_. No
implementado ni testeado.

**Esta severidad fue corregida contra el subagente que la cazó.** El primer
reporte la marcó ALTO con el escenario "401 en cada entrega → activación rota".
**La evidencia del spike T0 lo desmiente:** registró tres entregas reales contra
MP y en las tres `data.id` vino **en el body** (`181244133433`, `7032544182`,
`25f8cf82…`).

**Riesgo residual real:** el spike no observó
`subscription_preapproval_plan`, que es **precisamente el topic que todavía no
está suscrito**. Si MP lo entrega solo en query string, ese topic da 401.

**Recomendación:** implementar el fallback query→body y testear ambos, como pide
el checkbox del plan que quedó sin marcar. **Costo:** 2 h.

### H-F2-3 [MEDIUM] — El 409 de doble click omite `initPoint`, y un test fija el shape equivocado

**Evidencia:** `subscriptions/preapproval/route.ts:122-131`; test
`route.test.ts:278-289`.

**Impacto:** el plan (`:469`, `:481`) y el design (§6.5) dicen que el 409
devuelve `preapprovalId` **con `initPoint`** para que la UI pueda navegar al
checkout. El código no lo devuelve. Peor: **el test asserta la forma
incorrecta**, así que no falla — consagra el error. Cuando exista la UI, el
tenant queda atrapado en `pending_first_payment` sin poder retomar el pago.

**Recomendación:** agregar `initPoint` al 409 y corregir el test. **Costo:** 1 h.

### H-F2-4 [MEDIUM] — `redisPexpire` sin verificar puede dejar claves sin TTL para siempre

**Evidencia:** `handlers.ts:137-139` + `redis.ts:73-84`, `106-111`.

**Impacto:** el PEXPIRE se intenta **solo si `count === 1`** y su resultado no se
chequea (`safeRun` traga el error con `void`). Si falla, la key queda sin TTL →
`count > limit` → **429 permanente** por IP. Eso es **fail-closed**, y
contradice tanto el docstring de `handlers.ts:114-118` como la convención de
AGENTS.md ("rate limits son fail-open: protección, no crítica").

**Recomendación:** loguear el fallo y aceptar el key sin TTL con warning.
**Costo:** 1 h.

### H-F2-5 [MEDIUM] — `external_reference` sin validar puede producir 500

**Evidencia:** `webhooks/.../subscriptions/route.ts:406` →
`packages/db/src/index.ts:22`.

**Impacto:** la estrategia R devuelve `external_reference` **sin validar que sea
UUID**. `withTenantContext` corre `set_tenant_id(${tenantId}::uuid)`, que
**lanza** ante un valor no-UUID → **500** → loop de reintentos de MP. Rompe el
invariante documentado de "si no resuelve → `200` + warn, nunca `5xx`" (design
§3.5/§6.2 paso 9).

**Recomendación:** validar el formato UUID antes de invocar `withTenantContext`;
si no matchea, `200` + warn. **Costo:** 1 h.

### H-F2-6 [MEDIUM] — `/preapproval` no re-verifica el monto que creó

**Evidencia:** `subscriptions/preapproval/route.ts:148-164`.

**Impacto:** `plan/route.ts:260-287` y `mutate.ts` sí re-verifican con GET.
`/preapproval` no. Es el borde exacto del item 48 (el bug del 100x): un `2xx` de
MP no prueba nada. La única detección es el warn de H3 en el webhook (`:542`),
y **solo loguea**.

**Recomendación:** re-verificar antes de persistir, alineando los tres
endpoints. **Costo:** 2 h.

### H-F2-7 [MEDIUM] — Doble POST concurrente crea dos preapprovals en MP

**Evidencia:** `subscriptions/preapproval/route.ts:76-131`.

**Impacto:** guard read-then-act sin lock ni constraint unique. Dos requests
concurrentes crean **dos preapprovals en MercadoPago**; el segundo pisa el
`mpPreapprovalId` y deja un preapproval **huérfano en MP**, que hay que cancelar
a mano. El rate limit (10/min por IP) no lo evita. El design §6.5 existe
precisamente para evitar "dos suscripciones → dos cobros".

**Recomendación:** unique parcial sobre el estado pending, o lock por tenant.
**Costo:** 3 h.

### H-F2-8 [MEDIUM] — read-modify-write sin `FOR UPDATE`

**Evidencia:** `webhooks/.../subscriptions/route.ts:500-517`, `:603-611`.

**Impacto:** `SELECT` sin `FOR UPDATE` y `UPDATE ... WHERE id + tenantId` sin
compare-and-set. Dos eventos concurrentes (`preapproval.cancelled` vs
`payment.approved`) compiten y gana el último. Si queda `active` mientras MP dice
`cancelled`, la suscripción queda desincronizada hasta el próximo evento, o
indefinidamente.

**Recomendación:** `FOR UPDATE` en el select dentro de la transacción, o
compare-and-set sobre `lastProcessedPaymentId`. **Costo:** 3 h.

### H-F2-9 [MEDIUM] — El secret de plataforma tiene fallback al del tenant

**Evidencia:** `webhooks/mercadopago/subscriptions/route.ts:113-115` —
`MP_PLATFORM_WEBHOOK_SECRET ?? MERCADOPAGO_WEBHOOK_SECRET`.

**Impacto:** único archivo de producción donde conviven ambos secrets.
Contradice literalmente ADR-023 ("cada flujo tiene su propio `WEBHOOK_SECRET`").
**Es intencional y está testeado:** mitiga una regresión real — sin el fallback,
dev y preview daban 401. El problema no es el código: es que **el ADR no
registra la excepción.**

**Recomendación:** actualizar ADR-023 con la excepción y su razón. Un ADR que el
código contradice es peor que ningún ADR. **Costo:** 0.5 h.

### H-F2-10 [LOW] — Código muerto y guards que no hacen lo que dicen

**Evidencia:** `mp-webhook-events.ts`, `subscription-proration.ts`,
`mp-amounts.ts`.

**Impacto:** `TOPIC_BY_ACTION` es espejo idéntico de `TOPIC_BY_TYPE` con claves
(`payment.created`) que no coinciden con los literales reales → **fallback
muerto**. `daysRemaining` sin cap → prorrateo incorrecto sobre 30 días. `NaN`
pasa el guard `!= null` de H3 → el warn se dispara siempre.

**Costo estimado:** 2 h.

### H-F2-11 [LOW] — Comentarios que no coinciden con el código

**Evidencia:**

- `route.ts:127-135` — el body se materializa antes del check de tamaño (el 413
  llega tarde) y `rawBody.length` cuenta code units UTF-16, no bytes.
- `subscriptions/route.ts:73-84` — el comentario dice _"se degrada a `none`"_;
  el código devuelve `serverError(...)` → 500.
- `preapproval/route.ts:151` — `payerEmail: email ?? ''` manda string vacío a
  MP si falta el email.
- `preapproval/route.ts:56` — el rate limit cubre solo el alta, no
  `cancel`/`pause`/`resume`/`plan`.

**Costo estimado:** 1.5 h.

## Lo que la mid-phase (#197) y la mini auditoría T6 (#202) NO vieron

| Hallazgo         | Por qué se les escapó                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-F2-1           | Auditaron el **código presente**. Nadie auditó **por qué se escribió así**.                                                                                                                                                      |
| H-F2-2           | #197 lo anotó como _duda empírica_ (`auditoria-fase2-midphase.md:354`): _"no se verificó si MP envía `data.id` en query o solo en body"_. Quedó como incógnita, no como criterio de aceptación incumplido contra el plan `:639`. |
| H-F2-3           | Nadie contrastó `preapproval/route.ts` contra el plan T4 ni contra **su propio comentario de cabecera** (`:39`).                                                                                                                 |
| H-F2-4           | #197 revisó los helpers de T3; la falta de re-verificación está en un endpoint de T4.                                                                                                                                            |
| H-F2-5 a H-F2-8  | Fuera del alcance de ambos (cubrieron H1/H2/H3 y calidad de tests).                                                                                                                                                              |
| H-F2-9           | El fallback se introdujo **después** de #197, como fix de una regresión.                                                                                                                                                         |
| H-F2-10, H-F2-11 | No aparecen en ninguno de los dos reportes.                                                                                                                                                                                      |

**Lo que sí detectaron ellos, sin duplicar:** H1/H2/H3 corregidos
(#199/#198/#200); el parámetro `liveMode` muerto
(`route.ts:177,185,216,244,278,459`); el test de enlace `derivePermissions` ↔
`allowedFrom`, que **sigue ausente** (cero ocurrencias de `derivePermissions` en
los tests de mutaciones); coverage 81.3%.

**Anti-duplicación contra `deuda-tecnica.md`.** Los items 36, 48, 49/51, 53, 56,
57 y 61 están registrados y no se duplican. **H-F2-1 es nuevo** y se registra
como item.

## Análisis de procesos

| Proceso                     | Veredicto                     | Análisis                                                                                                                                                                                                               |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auditoría mid-phase (#197)  | **Falló en timing**           | Encontró 3 defectos graves, pero llegó tarde: T1–T5 ya estaban mergeados y T6 no podía pasar sin resolverlos. El proceso de revisión miraba "código correcto", no "código que cumple lo que promete la documentación". |
| Mini auditoría T6 (#202)    | **Funcionó**                  | Detectó lo que el proceso normal no ve: tests que pasan sin proteger. **Debería ser paso estándar antes de cada cierre** (~2-3 h por fase).                                                                            |
| Mini-PRs (#204, #205)       | **Funcionó con overhead**     | ~2-3 h extra (2 PRs, 2 CI, 2 cleanups). **Regla propuesta: mini-PR solo para docs/config; fixes de código van en el PR principal.**                                                                                    |
| Detección de config externa | **Falló — es el gap central** | Ningún mecanismo. Es lo que permitió cerrar con DoD 100% verde y fase incompleta.                                                                                                                                      |
| Cleanup de worktree         | **Funciona, ruido aceptado**  | Costo conocido y directo de `pnpm install` real (sin junction, que es requisito del DoD). Ver nota aparte.                                                                                                             |

**Sobre el cleanup hay un desacuerdo entre los subagentes, registrado a
propósito.** Un subagente dio veredicto de "ruido aceptable, no cambiar la
regla", con el argumento de que la secuencia de 7 pasos ya está documentada. La
auditoría verificó que la secuencia existe pero **no cubre tres modos de falla
observados**:

| Modo de falla                                                                   | Observado en |
| ------------------------------------------------------------------------------- | ------------ |
| `gh` exit 1, pero el merge **sí** aplicó                                        | #204         |
| `gh` exit 0, directorio **433 MB huérfano**                                     | #205, #206   |
| `git worktree remove` → _"'path' is not a working tree"_ (git ya lo desvinculó) | #204, #206   |
| `paseo_archive_workspace` → _"Workspace not found"_ **y archivar igual**        | #205         |

El caso de #205 es el relevante: **la herramienta respondió error y funcionó.**
Un cleanup automatizado que confíe en el exit code acumula basura. Se actualizó
`AGENTS.md` con esos modos de falla.

## Propuestas de mecanismos

Propuestas, **no implementadas**.

### M1 · Verificación de configuración externa — PRIORIDAD ALTA · 4-6 h

Script `pnpm mp:verify-webhooks` que llama `GET /webhooks` de MP con
`MP_PLATFORM_ACCESS_TOKEN`, compara los topics suscritos contra el union type
`MpTopic` de `packages/commerce/src/mp-webhook-events.ts` y reporta faltantes.
Complementar con un checklist pre-cierre obligatorio.

**Es el único gap que el DoD verde no puede cubrir**, y es el que produjo el
4to topic faltante. Debe existir **antes de Fase 3**, que suma más webhooks.

_Alternativa si la API de MP no lista suscripciones de forma estable:_ un
checklist pre-cierre firmado, con la evidencia pegada en el documento de cierre.
Cuesta 15 min y cubre el 90% del riesgo.

### M2 · Invariante de tipos para aislamiento cross-tenant — PRIORIDAD ALTA · 6-8 h · BLOQUEANTE

Item 61. `applyTransition(row, ...)` → `applyTransition(filteredRow, ...)`, donde
la fila ya viene del `SELECT` ejecutado dentro de `withTenantContext` y el
handler **no construye el `WHERE`**. Un tipo `TenantFilteredRow<T>` garantiza en
tiempo de compilación que la fila pertenece al tenant.

**Obligatorio antes de Fase 3.** Sin esto, cada endpoint nuevo hereda el mismo
agujero: quitar el `tenantId` deja la suite verde.

### M3 · Umbral de coverage de branches — PRIORIDAD MEDIA · 2 h

Global está en 67.38% branches, y `cierre-fase2.md` solo reporta stmts y fns.
`coverageThreshold` en `vitest.config.ts`: `branches: 70%` global y `branches:
85%` en archivos nuevos de la fase.

Los caminos sin cubrir **se concentran donde la auditoría tuvo que meter fixes**:
`mp-subscriptions.ts` (guards de respuesta no-2xx, timeout) y el webhook de
plataforma (fallbacks de `safeGet`/Redis). La cifra y el hallazgo coinciden.

### M4 · Regla de revisión para caminos optimizados — PRIORIDAD ALTA · 1 h

Todo path "optimizado" (estrategia L, cache, shortcut) necesita test de
integración **real** contra base de datos, no mock. En Fase 2 la estrategia L
tenía test unitario con mock —pasaba— y **cero** test real, que fallaba por
RLS.

Más las dos reglas de H-F2-1: un comentario que justifica saltarse una frontera
de seguridad es hallazgo; un nombre que promete una propiedad de seguridad debe
abrirse.

## Recomendación para Fase 3

**Sí, se puede arrancar Fase 3.** Condiciones:

1. **Item 61 antes de escribir el primer endpoint.** Es el único bloqueante, y
   por costo-beneficio es mejor pagarlo antes que auditar veinte endpoints que
   heredan el agujero.
2. **H-F2-3 y H-F2-5 antes de que exista la UI.** Ambos causan estados
   irrecuperables (`pending_first_payment`, loop de reintentos) y ninguno se nota
   hasta que hay un usuario real.
3. **H-F2-2 con el topic ya suscrito.** Implementar el fallback query→body
   cuando se suscriba `subscription_preapproval_plan`, y testearlo.
4. **El resto (H-F2-4, 6, 7, 8, 9, 10, 11) puede agendarse** en Fase 3 o Fase 4.
   Ninguno bloquea.

Los 6 MEDIUM suman **~12 h** de trabajo. Los 5 LOW, **~4.5 h**.

## Limitaciones

- **No se hizo segunda pasada.** El precedente de #197 es elocuente: una segunda
  pasada templada encontró **4 errores factuales** en la primera, incluido un
  root cause mal diagnosticado. Esta auditoría es la primera pasada. Una
  segunda pasada con el mismo prompt y otro perfil es **costo bajo, valor alto**,
  y está recomendada antes de mergear este documento.
- **Dos severidades fueron corregidas contra el subagente que las reporto**
  (H-F2-2, de ALTO a MEDIUM). Un subagente puede sobreestimar; verificar contra
  el código es parte del método, no una excepción.
- **La verificación de configuración externa no se ejecutó.** M1 no se probó
  contra la API real de MP; el costo de 4-6 h es una estimación.
- **No se auditó el comportamiento en producción.** H-F2-2 en particular depende
  de qué envía MP, y la evidencia disponible es de tres entregas del spike T0.
- **No se revisó el código de Fases 0 y 1** salvo donde tocaba Fase 2.
- **Los subagentes corrieron en dos perfiles distintos** (QA en modo `plan`,
  Orquestador en modo `build`). La separación de scopes funcionó, pero un
  subagente con capacidad de escritura habría podido tocar el worktree. Se
  verificó `git status` antes de commitear.

## Trazabilidad

| Documento                  | Ruta                                                          |
| -------------------------- | ------------------------------------------------------------- |
| Plan                       | `docs/superpowers/plans/2026-10-01-fase2.md`                  |
| Spec                       | `docs/superpowers/specs/2026-10-01-fase2-webhook-checkout.md` |
| Design                     | `docs/superpowers/specs/2026-10-01-fase2-design.md`           |
| Spike T0                   | `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md`     |
| Auditoría mid-phase        | `vault/04_Fases/auditoria-fase2-midphase.md`                  |
| Auditoría T6               | `vault/04_Fases/auditoria-t6-test-quality.md`                 |
| Cierre de fase             | `vault/04_Fases/cierre-fase2.md`                              |
| ADR-026 tenant resolution  | `vault/01_ADRs/ADR-026-resolucion-tenant-preapproval.md`      |
| ADR-027 planId en endpoint | `vault/01_ADRs/ADR-027-planid-endpoint-write.md`              |
