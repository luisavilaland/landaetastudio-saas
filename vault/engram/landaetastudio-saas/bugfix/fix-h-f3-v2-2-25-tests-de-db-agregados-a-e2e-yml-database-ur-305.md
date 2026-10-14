---
id: 305
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 16:35:49"
updated_at: "2026-10-14 16:35:49"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Fix H-F3-v2-2: 25 tests de DB agregados a e2e.yml + DATABASE_URL"
---

# Fix H-F3-v2-2: 25 tests de DB agregados a e2e.yml + DATABASE_URL

**What**: H-F3-v2-2. Agregados 3 archivos de test de DB a e2e.yml (register-tenant 15, tenant-lifecycle 5, subscription-transition 5) + la variable DATABASE_URL que faltaba en el env del paso. 25 tests que no corrian en ningun workflow. Registrados items 114 (leccion del rebase) y 115 (ventana de red en fixtures).
**Why**: Hallazgo H-F3-v2-2 de la segunda pasada de auditoria (#258, ya mergeado como 62e9cdb).
**Where**: .github/workflows/e2e.yml (paso "Run RLS integration tests", L125-136); vault/03_Deuda/deuda-tecnica.md (items 114, 115).
**Learned**:
- **Agregar los paths NO habria bastado**: el paso tenia solo `DATABASE_APP_URL`, y los 3 archivos nuevos necesitan `DATABASE_URL` (rol owner). 2 de 3 la exigen y `subscription-transition` exige ambas. Agregar solo las rutas las habria hecho **skipear en silencio** — el mismo bug que se estaba arreglando.
- **Verificacion empirica decisiva**: probe si `afterAll` corre cuando `beforeAll` lanza. **CORRE.** Esto descarto el riesgo grande, porque `tenant-lifecycle` y `subscription-transition` crean sus fixtures en `beforeAll`. Un fallo a mitad del setup igual limpia. Metodo: archivo de test scratch que escribe un archivo en beforeAll, "inserta", lanza; afterAll registra si corrio. Borrado despues.
- **El riesgo residual (item 115) es una ventana de red**: ambos hacen `INSERT` dejando que Postgres genere el id y lo pushean a la lista DESPUES (`tenant-lifecycle.test.ts:80`, `subscription-transition.test.ts:144`). Si el insert commitea server-side pero el cliente no recibe el RETURNING, el throw ocurre antes del push y la fila queda huerfana. Ventana estrecha, preexistente.
- `register-tenant` SI tiene el patron robusto de #247: genera el slug y lo registra ANTES del POST, y limpia por patron (`%@test.invalid` + slug). Los otros dos no.
- **El workflow ya escribe en Neon de produccion**: L108 corre `pnpm db:migrate && pnpm db:seed` con el owner, y el job de Playwright (L144-152) tambien. Agregar tests que escriben y limpian es consistente con el diseno existente.
- El job esta gateado: corre en pushes y en PRs solo del mismo repo, nunca de forks.
- Secret confirmado: `NEON_DATABASE_URL`, ya usado en L107, L110 y L151 del mismo job.
- `prettier --check` sobre un `.yml` valida la sintaxis YAML. No hay parser yaml en el root.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
