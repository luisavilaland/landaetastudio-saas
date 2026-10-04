---
id: 140
type: discovery
project: landaetastudio-saas
scope: project
topic_key: bug/conversion-centavos-unidad-moneda
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 15:07:42"
updated_at: "2026-10-04 15:07:42"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "toMpAmount/fromMpAmount centraliza la conversion; Math.round es load-bearing"
---

# toMpAmount/fromMpAmount centraliza la conversion; Math.round es load-bearing

**What**: `toMpAmount` (centavos -> unidad de MP) y `fromMpAmount` (unidad de MP -> centavos) en `packages/commerce/src/mp-amounts.ts`, exportados por `@repo/commerce`. Reemplazan 3 conversiones `/ 100` inline en T4.

**Why**: El bug del 100x en `POST /api/subscriptions/preapproval` (PR #189) fue exactamente una division por 100 escrita a mano: mandaba 4900 en vez de 49, o sea 100x de sobrecobro. Ningun test de integracion lo atrapo; lo atrapo un test de contrato del borde.

**Where**: `packages/commerce/src/mp-amounts.ts`, `packages/commerce/src/index.ts`, `apps/admin/app/api/subscriptions/preapproval/route.ts`, `apps/admin/app/api/subscriptions/plan/route.ts`

**Learned**:
- **`Math.round` en `fromMpAmount` es load-bearing, no decorativo.** Verificado en node antes de escribir el test: `(29 / 100) * 100` da `28.999999999999996` en coma flotante binaria. Sin el round, `fromMpAmount(toMpAmount(29))` devuelve `28.999...` y falla toda comparacion contra un entero de la DB. Hay un test que falla si se saca el round.
- Solo recibe montos de MP (2 decimales), asi que multiplicar por 100 siempre da entero matematicamente: el round corrige error de representacion, nunca un valor genuinamente fraccionario.
- **El test que mas valor dio no fue el roundtrip, fue el que documenta POR QUE existe el round.** Sin esa clase de test, alguien "simplifica" el `Math.round` como redundante y reintroduce el bug en silencio.
- **No se toco `email.ts`:** sus `/ 100` son `(total / 100).toFixed(2)` para mostrar. Usar un helper llamado `toMpAmount` ahi seria mentir sobre el dominio. Un helper compartido no es automaticamente aplicable en todos lados: hay que preguntar que dominio representa.
- Queda sin hacer la parte de tipado (que `CreatePreapprovalInput` exija centavos). Seria defense-in-depth contra el tipo, no contra la disciplina.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-bug]]
