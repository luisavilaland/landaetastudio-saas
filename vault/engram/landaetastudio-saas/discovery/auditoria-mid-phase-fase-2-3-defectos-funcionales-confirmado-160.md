---
id: 160
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 02:49:24"
updated_at: "2026-10-05 02:49:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoria mid-phase Fase 2: 3 defectos funcionales confirmados bloquean T6"
---

# Auditoria mid-phase Fase 2: 3 defectos funcionales confirmados bloquean T6

**What**: Auditoria mid-phase de Fase 2 (T1-T5) ejecutada con 2 subagentes de Paseo. Encuentra **3 defectos funcionales confirmados** que bloquean el cierre de Fase 2. Documento en `vault/04_Fases/auditoria-fase2-midphase.md` (315 lineas).

**Why**: Validar que lo mergeado en T1-T5 no muerda en T6/T7/T8 antes de arrancar las tareas de cierre.

**Where**: `vault/04_Fases/auditoria-fase2-midphase.md` (nuevo). Worktree: `~/.paseo/worktrees/0q5zj3gn/chore-audit-fase2-midphase`.

## Los 3 defectos (verificados por mi, no aceptados del subagente)

**H1 CRITICO — la estrategia L del webhook nunca resuelve.** `withTenantContextByPreapproval` consulta `subscriptions` por `mpPreapprovalId` con `db` directo (`route.ts:401-405`), fuera de `withTenantContext`. La tabla tiene `FORCE ROW LEVEL SECURITY` (`0000_baseline.sql:229`) y policy `USING ("tenantId" = current_setting('app.tenant_id', true)::UUID)` (`:248`). `db` usa `DATABASE_APP_URL` = rol sin BYPASSRLS. Sin `SET LOCAL`, `current_setting` devuelve NULL, la comparacion no es TRUE y **la query retorna 0 filas siempre**.

El docstring del propio codigo lo justifica mal: *"Es seguro: solo se LEE y el filtro es el indice unico parcial, que es por definicion de un solo tenant."* Confunde "WHERE selectivo" con "RLS deja pasar la fila". RLS filtra ANTES del WHERE.

**El repo ya lo tenia probado**: `rls-cross-tenant.test.ts:333` se titula *"sin set_tenant_id una conexion nueva devuelve cero filas RLS"*. El proyecto demonstrationo el comportamiento y depois lo pisotoneo en el webhook.

Consecuencia: el indice de T1 es codigo muerto en el camino principal, toda resolucion cae en la estrategia R (GET remoto), y si MP esta caido cada evento termina en `tenant_unresolved` + 200 = perdido en silencio.

**H2 ALTO — `pause` devuelve 202 que nunca confirma; `resume` inalcanzable.** `decideTarget` (`route.ts:548-577`) tiene 3 targets: `cancelled`, `active`, `past_due`. **No hay target `paused`.** El comentario L560-561 lo dice: "no hay transicion". Cadena rota: pause devuelve 202 sin escribir local -> evento llega con `approved:false` -> `decideTarget` null -> queda `active` para siempre -> `resume` exige `allowedFrom:['paused']` -> **siempre 409**. `REVIVABLE = ['pending_first_payment','past_due','expired']` sin `paused`.

**H3 ALTO — `planId` nunca se escribe.** `PUT /plan` devuelve 202 con comentario "Lo hace el webhook". El handler tiene **0 matches** de `planId|priceUyu|transaction_amount` en 629 lineas. **0 escrituras** de `planId:` en toda `apps/admin`. La base queda reportando el plan de creacion para siempre; volver al plan original dispara `409 "Ya tenes ese plan"` contra un estado falso.

## Consecuencia de proyecto

**No arrancar T6.** T6 es la tarea de tests de integracion y estos 3 defectos son justo lo que T6 debe detectar. Usarlos como tests faltantes convertiria T6 en una tarea de fixing con nombre de testing.

## Learnings

- **El modo `plan` de Paseo no es airtight**: deshabilita edit tools pero **permite bash**, y con bash se puede escribir. Verifique que ambos worktrees quedaron con 0 archivos modificados.
- **Un subagentePeut inventar hallazgos.** El de docs reporto que la bitacora carecia de entradas T1-T4. **Falso**: existen las 5 (L2269, L2344, L2452, L2716, L2987). Su patron `2026-.*T[0-9]\s+Fase 2` no matchea el titulo de T5, que no dice "Fase 2". Un search que no cubre el objeto buscado produce conclusion invertida. Lo descarte y lo dejedocumentado en el informe.
- **Verificar los "CRITICO" de un subagente mecanicamente, no por prestigio.** H1 era plausible y lo confirmei en 3 pasos. Pero la prueba la hice leyendo el codigo, no el grep: un grep de `\bdb\.(select` dio **0 matches** porque el codigo esta partido en lineas (`await db` \n `.select(`). Casi acepto un hallazgo falso por confiar en un grep mal escrito.
- **Me autoinjecte typos al escribir el doc** (5: `e2/`, `Sustainable`, `más_paths`, `subagentesRAN`, `separacióncumplió`). El scan de typos por patron los agarro. La consola de Windows muestra `?` por los 8 caracteres U+2192 y el `>=` U+2265: verify por codepoint antes de "corregir" algo que en realidad esta bien.
- **El conteo de archivos de test cierra exacto**: 83 en disco = 68 vitest + 15 e2e (Playwright). Sirve para detectar contadores erroneos sin correr la suite.
- 30 de los 36 `U+FFFD` de `bitacora.md` estan concentrados en **una sola entrada** (L936-945, 2026-08-11): eso los hace acotados y reparables.
- **Los 8 CJK de `bitacora.md:976-977` son falsos positivos**: son una entrada que documenta haber *corregido* texto chino en `SECURITY.md` y cita el original como evidencia. `SECURITY.md` sigue limpio. Un scan que solo busque CJK los marcaria como dano.
- Correccion de ruta del usuario: las auditorias de fase van en `vault/04_Fases/`, no en `docs/`. Convention `auditoria-fase<N>[-variante].md`.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
