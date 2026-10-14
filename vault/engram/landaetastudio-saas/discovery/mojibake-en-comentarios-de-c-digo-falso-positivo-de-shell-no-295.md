---
id: 295
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:07:24"
updated_at: "2026-10-14 15:07:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Mojibake en comentarios de código: falso positivo de shell, no del repo"
---

# Mojibake en comentarios de código: falso positivo de shell, no del repo

**What**: Se.linspace un mapeo que reportó mojibake en `packages/auth/src/index.ts`, `packages/validation/src/env.ts`, `packages/commerce/src/index.ts`, `packages/db/seed.ts`, `scripts/check-migrations.sh` y `scripts/check-migrations-applied.mjs`.
**Why**: Un agente de mapeo leyó esos archivos y reportó caracteres corruptos en comentarios de producción.
**Where**: packages/auth/src/index.ts:8,24; packages/validation/src/env.ts; packages/commerce/src/index.ts; packages/db/seed.ts:845; scripts/check-migrations.sh:32; scripts/check-migrations-applied.mjs:9,42,70,84
**Learned**: FALSO POSITIVO confirmado. Medido con Node: 0 ocurrencias de U+FFFD y sin BOM en los 6 archivos. `pnpm check:encoding` → "0 con hallazgos nuevos". El mojibake estaba en la CONSOLA de PowerShell (decodificación ANSI), no en los archivos — exactamente la trampa de AGENTS.md §6.5. Conclusión: NUNCA reportar mojibake leído desde salida de shell; hay que medir con Node o `git diff --numstat`. Lo que sí existe en esos archivos es texto español SIN tildes ("asi que", "lozenso"), que es estilo, no corrupción.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
