---
id: 182
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 20:50:27"
updated_at: "2026-10-06 20:50:27"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Cierre formal de Fase 2 (T8) con DoD verificado"
---

# Cierre formal de Fase 2 (T8) con DoD verificado

**What**: Fase 2 cerrada formalmente (T8). Documento `vault/04_Fases/cierre-fase2.md`. T0-T8 completadas, T9 (polling) cancelado por H1 confirmada. 3 fixes H1/H2/H3 resueltos y registrados en ADR-026/027. Mini auditoría T6 (#202) + mini-PRs documentales #204 y #205.

**Why**: T8 del plan de Fase 2. La auditoría mid-phase #197 (§7 "Antes de T8") exigía 4 precondiciones antes de firmar el cierre. Las 4 quedaron cumplidas: #1 ADR-026/027 en #199/#200, #2 y #3 en #205 (blueprint no normativo + arquitectura.md indexando Fase 2), #4 en este documento.

**Where**: `vault/04_Fases/cierre-fase2.md`, `vault/02_Bitacora/bitacora.md`

**Learned**:
- **DoD verificado sin cache** sobre `c2b477e`: lint 6/6, typecheck 9/9, 705/705 tests en 69 archivos, build 3/3, format:check limpio, migraciones OK (3 archivos). El plan estimaba 10 días hábiles; se ejecutó del 2026-10-02 al 2026-10-06 (4 días calendario).
- **Coverage medido, no estimado**: 78.12% stmts / 74.45% fns, leído de `coverage/coverage-final.json`. El rango "92-100% para Fase 2" que se daba por supuesto es FALSO: el webhook de suscripciones de plataforma queda en 81.3% y `mp-subscriptions.ts` en 81.4%. El archivo más bajo (68.9%) es el webhook de órdenes del tenant en storefront, que es Fase 1. **Se documentó la discrepancia en vez de alisarla**: un cierre es el registro que todos leen después, y una cifra inflada se hereda como cierta.
- **El DoD verde mide el código, no la configuración de un tercero.** El panel de MP tiene 3 de 4 topics; falta `subscription_preapproval_plan`. El PR #204 arregló el doc que reproducía el error, pero la suscripción real sigue incompleta. Es la única acción de Fase 2 fuera del repo, y ningún test puede detectarla.
- **H2 del spike T0 fue descartado parcialmente.** Obs 119 lo descartó porque "se suscribieron todos"; con el cuarto topic nunca suscrito, la hipótesis no estaba del todo cerrada. No cambia la conclusión material (H1 sigue siendo la causa raíz de P1) pero queda corregido por escrito para que la auditoría de Fase 2 no lo dé por cerrado.
- **Housekeeping**: #170 (T6) y #171 (T7) estaban abiertos porque los PRs #201/#203 no llevaron `Closes`, aunque su trabajo estaba mergeado y verificado. Cerrados con referencia al PR. Queda abierto solo #172.
- **Lección de tiempo**: el plan estimaba 10 días hábiles, se ejecutó en 4, pero el trabajo que no se contabiliza (3 defectos de una auditoría, 2 mini-PRs documentales, 1 drift de config en un panel externo) es el que hace que una fase "rápida" no sea una fase corta.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
