---
id: 121
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 15:31:01"
updated_at: "2026-10-03 15:31:01"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "T1 Fase 2: indice unico parcial en subscriptions.mpPreapprovalId"
---

# T1 Fase 2: indice unico parcial en subscriptions.mpPreapprovalId

**What**: Indice unico PARCIAL subscriptions_mp_preapproval_idx sobre subscriptions.mpPreapprovalId, con WHERE mpPreapprovalId IS NOT NULL. Migracion 0001_dapper_revanche. Base de la estrategia L del design de Fase 2: resolver tenantId desde el preapproval_id de MercadoPago sin joins.

**Why**: T1 del plan de Fase 2 (issue 165). El spike T0 confirmo que authorized_payments expone preapproval_id, asi que el cruce hacia tenantId se resuelve con un indice unico sobre la tabla existente. Cero tablas nuevas, cero columnas nuevas.

**Where**: packages/db/src/schema.ts (dbSubscriptions, mpPreapprovalUnique), packages/db/migrations/0001_dapper_revanche.sql, meta/0001_snapshot.json, meta/_journal.json, packages/db/src/__tests__/schema.test.ts

**Learned**: Drizzle-kit SI emite el WHERE de un indice parcial declarado con where(sql) en el schema. NO emite IF NOT EXISTS: se agrego a mano porque este repo ya aplico la 0015 manualmente y el item 43 documenta que drizzle-kit se traga errores de migracion. El WHERE no es necesario por los NULL: PostgreSQL ya trata los NULL como distintos en un indice unico. El WHERE hace el indice PARCIAL, mas chico y barato, porque solo cubre filas con preapproval. Inventario previo: 2 filas, 0 con mpPreapprovalId, 0 duplicados.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
