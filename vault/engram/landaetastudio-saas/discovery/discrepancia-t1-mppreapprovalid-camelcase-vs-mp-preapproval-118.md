---
id: 118
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 14:33:22"
updated_at: "2026-10-03 14:33:22"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Discrepancia T1: mpPreapprovalId camelCase vs mp_preapproval_id en plan/spike"
---

# Discrepancia T1: mpPreapprovalId camelCase vs mp_preapproval_id en plan/spike

**What**: El plan de Fase 2 (docs/superpowers/plans/2026-10-01-fase2.md §4, T1) y el spike T0 usan SQL con `mp_preapproval_id` snake_case, pero el schema Drizzle real define la columna como `mpPreapprovalId` (text, camelCase, entre comillas dobles en SQL). Además el nombre del índice difiere entre documentos: `subscriptions_mp_preapproval_idx` (plan T1) vs `subscriptions_mp_preapproval_uidx` (spike T0 §P3).

**Why**: Detectado durante la calibración previa a T1. El SQL del spike no es copiable tal cual a PostgreSQL: `ON subscriptions (mp_preapproval_id)` fallaría con columna inexistente.

**Where**: packages/db/src/schema.ts:64-96 (dbSubscriptions: mpPreapprovalId línea 78, índices tenantIdx/statusIdx/planIdx líneas 91-93), docs/superpowers/plans/2026-10-01-fase2.md:206-210, docs/superpowers/specs/2026-10-02-spike-t0-resultado.md:197-201

**Learned**: El SQL correcto para T1 es `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_mp_preapproval_idx ON subscriptions ("mpPreapprovalId") WHERE "mpPreapprovalId" IS NOT NULL;` — el plan §4 ya lo trae correcto con comillas; el doc del spike quedó desactualizado. Regla general: el SQL en docs es ilustrativo, el schema de Drizzle es la fuente de verdad para nombres de columna. Además `pnpm db:generate` no emite índices parciales con WHERE desde Drizzle: el índice va declarado en el schema para que quede en el snapshot, pero el WHERE hay que verificarlo en el .sql generado (riesgo P-R5).</content>
</invoke>

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
