# Auditoría — Calidad de tests de T6

- **Fecha**: 2026-10-06
- **Rama**: `audit/t6-test-quality`
- **Alcance**: los 3 tests que agregó T6 (PR #201) + verificación indirecta de los tests de H1/H2/H3. **No audita T1-T5** (ya auditados en #197).
- **Base**: `99cafbf` · 705 tests / 69 archivos · 78.11% stmts · 67.38% branches

## Resumen ejecutivo

- **Archivos de test en alcance**: 45 en `apps/admin`, `packages/commerce` y `packages/db`.
- **Total de tests**: 705.
- **Defectos encontrados**: **3** — 1 HIGH, 2 LOW.
- **Veredicto**: **T6 pasa.** Ninguno de los 3 tests de T6 es ciego, y los 7
  mutation-lite sobre funciones de H1/H2/H3/T6 fueron detectados. Pero hay un
  defecto HIGH de diseño de tests que conviene atender antes de Phase 3: los
  tests con mock **no pueden verificar la semántica de las queries**.

## Metodología

- 4 checks mecánicos: targets de `vi.mock`, `expect()` por `it()`, skips
  documentados, coverage + branches leídos del JSON.
- 7 mutation-lite (5 funciones críticas + los 3 handlers de mutación de T6).
- 3 mutaciones de aislamiento cross-tenant (fails-if-broken).
- Diagnóstico de los 3 archivos de Fase 2 con cobertura baja.
- Diagnóstico del flake de Neon con 3 corridas completas.
- **Read-only.** Ninguna modificación al código de producción: los 10 scripts de
  auditoría son descartables (`git check-ignore` los cubre con `/*.mjs`).

## Hallazgos

### H-T6-1 [HIGH] — Quitar el filtro `tenantId` de una query NO rompe ningún test

**Evidencia**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`,
mutaciones en el `SELECT` de la fila (L493) y en el `UPDATE` final (L562).

Las dos se aplicaron y la suite siguió **53/53 verde**. Ningun test fallo:

| Mutacion                                               | Resultado                            |
| ------------------------------------------------------ | ------------------------------------ |
| `UPDATE` final sin `eq(dbSubscriptions.tenantId, ...)` | 53 passed — **no detectada**         |
| `SELECT` de la fila con filtro tautologico             | 53 passed — **no detectada**         |
| la resolucion devuelve un tenant fijo                  | **detectada** (1 cross-tenant fallo) |

**Por que**: los tests de Fase 2 son mock-based. `withTenantContext` esta
mockeado y devuelve filas fijas sin importar que `WHERE` lleve. Con el filtro
tautologico, `row` pasa a ser una fila arbitraria y el `UPDATE` por `row.id`
escribe lo que sea: **una fuga cross-tenant completa, y ningun test la ve.**

Los tests cross-tenant que existen verifican que se **pase** el tenant correcto a
`withTenantContext`. No verifican que la query **filtre** por tenant. Son cosas
distintas, y la segunda es la que evita la fuga.

**Impacto**: un refactor que escriba `WHERE id = ${row.id}` sin el `tenantId`
pasa los 705 tests. El aislamiento real solo esta protegido por RLS en Postgres
(probado en `rls-cross-tenant.test.ts` contra Neon), que es una red distinta:
protege la DB, no el codigo que escribimos mal la query.

**Recomendacion**: un test que de verdad verifique el aislamiento tiene que
ejecutar SQL real, no un mock. Opciones, de menor a mayor costo:

1. Assert sobre la forma de la query es debil (ver limitaciones).
2. Un test de integracion contra Neon que inserte dos tenants y dispare el
   webhook, verificando que solo se modifica la fila del tenant correcto.
3. Subir el aislamiento a una funcion de dominio testeable: que el
   `applyTransition` reciba el `row` ya filtrado y no construya el `WHERE`.

La opcion 3 es la que mejor paga: convierte un invariante de SQL en un
invariante de tipos.

### H-T6-2 [LOW] — 5 archivos de test mockean un logger que el codigo no importa

**Evidencia**: 5 pares de archivo de test / ruta, todos con el mismo patron:

| Test                                                   | mockea         | la ruta importa |
| ------------------------------------------------------ | -------------- | --------------- |
| `api/config/settings/__tests__/route.test.ts:7`        | `@/lib/logger` | `@repo/logger`  |
| `api/config/tenant/__tests__/route.test.ts:7`          | `@/lib/logger` | `@repo/logger`  |
| `api/config/tenant/domain/__tests__/route.test.ts:7`   | `@/lib/logger` | `@repo/logger`  |
| `api/products/[id]/variants/__tests__/route.test.ts:7` | `@/lib/logger` | `@repo/logger`  |
| `api/shipping/__tests__/route.test.ts:7`               | `@/lib/logger` | `@repo/logger`  |

**Por que**: `apps/admin/lib/logger.ts` es un shim de re-export
(`export { createLogger } from '@repo/logger'`). Son **dos modulos distintos**
en el registro de vitest, asi que mockear el shim no afecta al import directo
que hace la ruta. El mock no tiene efecto: los 55 tests de esas rutas corren
contra el logger real de pino.

**Es exactamente la clase de bug de H3** (que hacia que 9 tests pasan sin
testear), replicada en 5 archivos mas. Alli la consecuencia fue grave porque los
tests afirmaban sobre `warn`. Aca ningun test afirma sobre logs, asi que:

**Impacto**: MEDIUM en ruido, LOW en cobertura. Los tests no producen falsos
verdes sobre logging porque no verifican logging; lo que queda es codigo muerto
y salida ruidosa. Se mantiene LOW para no inflar la severidad de una
inconsistencia que no produce falsos positivos.

**Recomendacion**: apuntar los 5 mocks a `@repo/logger`. Y, si se quiere
afirmar sobre logs en el futuro, usar `vi.hoisted` con spies estables, como
resolvio H3 en `handler.test.ts` (verificado: sigue en pie, 2 `vi.hoisted` y
mockeando `@repo/logger`).

### H-T6-3 [LOW] — Un `it()` sin `expect()` y un `skipIf` sin razon documentada

**Evidencia**:

1. `packages/commerce/src/__tests__/encryption.test.ts:105`
   `it('no hace nada si no hay tokens para cifrar')` llama a `encryptToken` y no
   afirma nada. Pasa mientras no lance, que es una forma valida de testear
   "no lanza", pero no esta documentada como tal.
2. `packages/db/src/__tests__/rls-cross-tenant.test.ts:161`
   `describe.skipIf(!hasAppUrl)` **sin comentario** que explique por que puede
   saltear. El guard es correcto (es `skipIf`, no el patron
   `if (!hasAppUrl) return` que ya produjo un verde falso dos veces), pero la
   razon no esta escrita. Contraste: el archivo de H1 si documenta el motivo en
   `dbUrl()`.

**Impacto**: ninguno en la cobertura. Es deuda de mantenibilidad: el primero
pasa por test, el segundo puede perder su explicacion y nadie sabra que
saltarse es legitimo.

**Recomendacion**: un comentario en cada uno. Minutos.

## Checks pasados

| Check                         | Resultado                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vi.mock` targets             | **83 / 88** correctos (5 defects, ver H-T6-2)                                                                                                                               |
| `expect()` por `it()`         | **454 / 455** (1 sin `expect`, ver H-T6-3)                                                                                                                                  |
| Skips documentados            | **1 / 2** (ver H-T6-3). `preapproval-tenant-resolution.test.ts` bien documentado; `rls-cross-tenant.test.ts` sin razon. **Ninguno usa el patron `if (!hasAppUrl) return`.** |
| Spies estables (`vi.hoisted`) | Sobrevivieron los de H3 en `handler.test.ts` (2 spies, mockeando `@repo/logger`). Sin `.only` en el repo.                                                                   |
| Mutation-lite                 | **7 / 7 detectadas**, revertidas limpias, produccion intacta                                                                                                                |
| Cross-tenant fails-if-broken  | **1 / 3** (ver H-T6-1)                                                                                                                                                      |

### Detalle del mutation-lite

| Mutacion                                                | Tests que rompieron |
| ------------------------------------------------------- | ------------------- |
| `decideTarget` (H2): `paused` invertido a `active`      | 1                   |
| `verifyPlanAmountConvergence` (H3): comparacion anulada | 2                   |
| `resolveTenantIdByPreapproval` (H1): siempre `null`     | 11                  |
| `resolveTenant` (H1): fallback R anulado                | 2                   |
| `cancel` (T6): catch ya no devuelve 500                 | 1                   |
| `pause` (T6): catch ya no devuelve 500                  | 1                   |
| `resume` (T6): catch ya no devuelve 500                 | 1                   |

Los 3 tests de T6 son **efectivos**: cada uno detecta exactamente la perdida de
comportamiento que cubre. Ese era el riesgo real de T6 y queda despejado.

## Archivos de Fase 2 con cobertura baja

Leido de `coverage/coverage-final.json` (**no** de la tabla de texto, ver item 60:
la tabla oculta archivos por truncado de directorio).

| Archivo                                       | Stmts  | Branches | Ramas sin cubrir | ¿Cubre los fixes?                             |
| --------------------------------------------- | ------ | -------- | ---------------- | --------------------------------------------- |
| `webhooks/mercadopago/subscriptions/route.ts` | 81.28% | 92.31%   | 20               | **si**, H1/H2/H3 detectados por mutation-lite |
| `commerce/mp-subscriptions.ts`                | 81.40% | 75.00%   | 8                | parcial (ver abajo)                           |
| `lib/subscriptions/handlers.ts`               | 96.88% | 84.62%   | 5                | si                                            |

### Caminos concretos sin cubrir

- **`webhooks/.../route.ts`** (20 ramas): L178, L180, L185, L219, L223, L248,
  L254. Son los fallbacks de `safeGet` y los guards de `mp_unavailable` /
  `tenant_unresolved`. **Ninguno es codigo de H1/H2/H3**: los fixes estan
  cubiertos y el mutation-lite lo confirma rompiendolos.
- **`mp-subscriptions.ts`** (8 ramas, el peor ratio branch de Fase 2):
  L63, L66, L68, L90, L97, L195, L198. Son los guards de respuesta de MP: no
  2xx, body invalido, timeout. **No incluye la verificacion post-escritura de
  H3**, que vive en `plan/route.ts` y esta al 100% de branches.

## Flake de Neon

- **3 corridas completas**: **0 fallos** de `beforeAll`.
- Historico (PR #199 y #201): ~1 fallo cada 4-5 corridas completas. Se manifiesta
  como `Failed Suites 1` con `705 passed`: es un fallo de `beforeAll` contra
  Neon, no de asercion.
- **Causa**: `preapproval-tenant-resolution.test.ts` y `rls-cross-tenant.test.ts`
  abren conexiones a Neon en paralelo con 69 workers. Es contencion de conexiones,
  no logica de test.
- **No afecta CI**: ahi ambas suites se saltean (URL dummy).
- **Item de deuda**: no se registra. No se reprodujo en esta auditoria (0/3) y
  el arreglo (serializar las suites) es una decision de infra que excede una
  auditoria de calidad de tests.

## Recomendación

**T6 pasa. Se puede arrancar T7.**

Los 3 tests de T6 son efectivos y los 7 mutation-lite sobre funciones de H1/H2/H3
fueron detectados: no hay tests ciegos en el alcance.

**Antes de Phase 3** (no antes de T7), atender H-T6-1 con la opcion 3 (mover el
aislamiento a un invariante de tipos). Es el unico hallazgo HIGH y la razon por la
que hoy una fuga cross-tenant seria invisible al suite.

H-T6-2 y H-T6-3 son de minutos y se pueden agrupar en un PR de limpieza.

## Limitaciones

- **Esta auditoria no verifica correctness del codigo de produccion.** Solo que
  los tests prueban lo que dicen probar. Un test puede pasar sobre codigo roto.
- **Los tests de Neon solo corren en el job `e2e` del CI.** Los mutation-lite se
  hicieron en local con `.env.local` real. En el CI, `preapproval-tenant-resolution`
  y `rls-cross-tenant` estan salteados y ninguna mutacion los habria detectado.
- **Los 5 defects de `vi.mock` (H-T6-2) son de T1-T5, fuera del alcance estricto.**
  Se reportan porque son la misma clase del bug de H3 y porque el metodo los
  encontro de paso. No se corrigieron (auditoria read-only).
- **No se hizo segunda pasada templada.** El precedente (#197) mostro que una
  segunda pasada encuentra errores que la primera no ve. Esta es la primera.
- **El check de `vi.mock` es una heuristica de grafo de importes**, no una prueba
  de ejecucion. Detectaria el patron de H3, pero no un mock mal escrito dentro
  del modulo correcto. Se verifico a mano cada uno de los 88.
- **Un falso positivo propio durante la auditoria**: la primera version del
  check de branches reporto `0%` en `mp-amounts.ts`. Era un bug del script (0/0
  mostrado como 0% en vez de "sin ramas"); el archivo tiene 0 ramas. Se corrigio
  antes de reportar.
