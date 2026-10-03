---
id: 122
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 15:32:01"
updated_at: "2026-10-03 15:32:01"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Drizzle e indices parciales: SI emite WHERE, NO emite IF NOT EXISTS"
---

# Drizzle e indices parciales: SI emite WHERE, NO emite IF NOT EXISTS

**What**: Al declarar un indice en el schema de Drizzle, el .sql generado SI incluye la clausula WHERE si se uso where(sql) en el schema, pero NO incluye IF NOT EXISTS. El orden correcto es: generar, LEER el .sql, y ahi decidir si se agrega idempotencia a mano.

**Why**: El plan de Fase 2 asumia el riesgo contrario (que Drizzle no emitiera el WHERE) y por eso pedia parar y reportar si faltaba. Se verifico y el riesgo era al reves: el WHERE sale, el IF NOT EXISTS no.

**Where**: packages/db/src/schema.ts, packages/db/migrations/0001_dapper_revanche.sql

**Learned**: El patron a recordar para migraciones de indice en este repo: verificar SIEMPRE el .sql generado antes de aplicarlo, porque las dos asynciones esperadas estan invertidas respecto de lo que uno supone. IF NOT EXISTS hay que agregarlo a mano cuando la migracion corre en una DB donde el objeto podria ya existir por aplicacion manual previa (precedente: la migracion 0015). Y un indice unico parcial sobre una columna nullable NO necesita el WHERE para tolerar multiples NULL: PostgreSQL ya trata los NULL como distintos entre si. El WHERE sirve para que el indice sea parcial y mas chico.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
