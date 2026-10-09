---
id: 271
type: architecture
project: landaetastudio-saas
scope: project
topic_key: architecture/sdd-fase3-plan
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 14:56:44"
updated_at: "2026-10-09 14:56:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Plan Fase 3: 16 tasks, 6 slices, y el backfill como riesgo mayor"
---

# Plan Fase 3: 16 tasks, 6 slices, y el backfill como riesgo mayor

**What**: Plan de Fase 3 escrito. 16 tasks (T0-T16), 6 slices encadenados (S1-S6), ~58 h estimadas, ~1900 lineas contra el presupuesto de review de 400. R1 (backfill) y R2 (flake) marcados como los riesgos reales. D17/D18 aprobadas.

**Why**: El plan es el tercer entregable del SDD de Fase 3 y el ultimo antes de implementar.

**Where**: `docs/superpowers/plans/2026-10-09-fase3.md`, rama `docs/sdd-fase3`.

**Learned**:
- **El presupuesto de 400 lineas por PR obliga a encadenar desde el principio, no a dividir al final.** La estimacion de Fase 3 es ~1900 lineas con tests y migraciones: 4.75x el presupuesto. Descubrir eso al final del trabajo seria tarde; el plan tiene que nacar con los slices ya definidos.
- **El riesgo mas serio del plan no es una task dificil: es el backfill de T2.** El filtro del proxy (T4) depende de que todos los tenants existentes queden en `active`. Un backfill mal hecho **les cae la tienda a clientes que hoy funcionan**, y el sintoma es un `404` que no dice "migracion mal hecha". Por eso T4 esta en su propio slice y no se mezcla, y por eso T2 lleva conteo obligatorio con PARAR si aparece un valor inesperado.
- **Con el item 78 al 25%, "la suite paso" no es un DoD utilizable.** Cada task reporta **su archivo en aislamiento**. Es la misma conclusion del item 78 aplicada al plan en vez de al fix.
- **El camino critico arranca con las dos tasks mas riesgosas** (T2 conteo, T3 migracion). Eso es malo para la planificacion y bueno para el discovery: los dos primeros dias de Fase 3 son los que mas pueden romper produccion, y saberlo antes evita la sorpresa.
- **Un grafo de dependencias dibujado a mano en caracteres de caja NO es legible en Markdown** - los caracteres multibyte rompen la alineacion de columnas y el grafo queda ilegible. **La tabla de dependencias es mas corta y es inequivoca.** Para 17 tareas no hace falta mas.
- **El punto de entrada cuando el camino critico esta ocupado son las tasks sin dependencias** (T1, T6). T6 tiene un motivo propio para ir primera: la auditoria de Fase 2 la pidio antes de que exista la UI, asi que adelantarla no es opcionalidad sino cumplimiento de un compromiso.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-architecture]]
