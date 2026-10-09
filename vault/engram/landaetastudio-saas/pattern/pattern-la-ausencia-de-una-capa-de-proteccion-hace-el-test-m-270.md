---
id: 270
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/el-enmascaramiento-viene-de-haber-capa
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 14:49:18"
updated_at: "2026-10-09 14:49:18"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Pattern: la ausencia de una capa de proteccion hace el test MAS simple"
---

# Pattern: la ausencia de una capa de proteccion hace el test MAS simple

**What**: D5 del design de Fase 3, convertido en pattern reutilizable. El enmascaramiento de un defecto por el `WHERE` viene de **haber** una capa de proteccion, no de la falta de ella. `transitionSubscription` (sobre `subscriptions`, con RLS) necesita un test de **2 capas**; `activateTenant` (sobre `tenants`, sin RLS) necesita un test de **1 sola capa**.

**Why**: El item 61 mostro que con RLS el test de una sola capa era insuficiente: quitar el `tenantId` del `WHERE` dejaba la suite verde porque `withTenantContext(A)` + la policy bloqueaban la fila de B. La conclusion obvia ("hay que agregar una capa de test mas") es correcta pero incompleta. La propiedad general es la inversa y es mas util: **la ausencia de una capa de proteccion hace el test MAS simple, no mas dificil**.

**Where**: `packages/commerce/src/subscription-transition.ts` (2 capas) vs el `activateTenant` propuesto en `docs/superpowers/specs/2026-10-09-fase3-design.md` §2.2 (1 capa). Evidencia del caso de 2 capas: `packages/commerce/src/__tests__/subscription-transition.test.ts`.

**Learned**:
- **El criterio para elegir la forma del test no es "que tan importante es la tabla" sino "hay algo que pueda tapar el error".** Con RLS: 2 capas (productivo + owner/BYPASSRLS). Sin RLS: 1 capa alcanza, porque nada tapa. La pregunta operativa antes de escribir un test de aislamiento es: *¿que capa, si alguna, esta entre mi codigo y el dato que quiero observar?*
- **Corolario de seguridad que parece contraintuitivo: `tenants` sin RLS es un riesgo Y una propiedad de testing.** El riesgo es que un `UPDATE` a `tenants` desde cualquier endpoint es cross-tenant por definicion si no filtra, y no hay red. La propiedad es que el test lo detecta en una pasada. **Las dos cosas son la misma moneda**, y es la que hace que `activateTenant` sea una frontera critica y no un helper.
- **El sintoma de una capa que tapa a otra es un test que pasa en verde ante una mutacion que deberia romperlo.** Ese sintoma es la unica senal fiable, y se detecta solo haciendo la mutacion y viendo que el test falla.
- **D5 generaliza a defense in depth en cualquier contexto:** RLS tapando un WHERE, un retry que tapa un timeout, un cache que tapa una lectura stale, una validacion de schema que tapa un default. Si un test pasa en verde cuando se rompe lo que deberia proteger, hay que preguntarse que esta atrapando el error antes de agregar mas capas de test.
- **Por que la respuesta fue agregar la capa de owner y no el filtro dos veces:** el filtro duplicado habria sido mas barato de escribir y no habria detectado el defecto. La capa de owner no es redundancia: es **quitar la mascara** para poder observar. Distinguir "refuerzo" de "mascara quitada" es lo que separa un test que verifica de uno que acompaña.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
