---
id: 110
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 04:02:07"
updated_at: "2026-10-03 04:02:07"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "E2E verde pero seed ahora trunca produccion en cada run de CI"
---

# E2E verde pero seed ahora trunca produccion en cada run de CI

**What**: E2E verde tras unificar ambos secrets a production. **Pero eso hizo que `pnpm db:seed` (que hace TRUNCATE de 10 tablas) corra ahora contra PRODUCCION en cada run de CI.** Los items 44 y 45 NO existian en la deuda (el archivo terminaba en 43); los registre.

**Why**: Cierre del drift de vault y actualizacion de la bitacora, con los items de deuda que corresponden.

**Where**:
- `vault/02_Bitacora/bitacora.md` - entrada 2026-10-02/03 (primera entrada desde 2026-10-01)
- `vault/03_Deuda/deuda-tecnica.md` - items 44 y 45 nuevos
- `vault/engram/` - export de obs 107-110

**Learned**:

1. **E2E verde: run `37088993766` (fd93d2d) re-ejecutado.** Los 4 jobs en `success`: `seed`, `wait-for-deployments`, `e2e`, `e2e-success`. `e2e.yml` **NO cambio** desde mi commit `fd93d2d`; la unica variable fue el secret.

2. **`NEON_DATABASE_URL` se actualizo `2026-10-03T03:16:11Z`** - despues de que el run fallara (03:06). `NEON_DATABASE_APP_URL` intacto desde `2026-09-24T14:55:50Z`. **Ambos apuntan ahora a production.** Eso elimino el split: el spec crea/lee la orden y el webhook escribe en la misma base.

3. **HALLAZGO NUEVO Y GRAVE: `seed` trunca PRODUCCION en cada run.** El job `seed` corre `pnpm db:migrate && pnpm db:seed` con `DATABASE_URL = NEON_DATABASE_URL = production`. Y `packages/db/seed.ts` hace `TRUNCATE TABLE ... CASCADE` sobre 10 tablas (`plans`, `order_items`, `orders`, `product_variants`, `product_images`, `products`, `categories`, `customers`, `admin_users`, `tenants`). **Cada push a develop borra los datos de produccion y los reemplaza por datos de prueba.** Esto estaba latente desde antes, pero solo se vuelve real ahora que el secret apunta a produccion.

4. **El item 44 fue subestimado en el encargo.** Venia como "CI/dev comparten base, BAJA". Con la evidencia nueva **es ALTA**: no es solo compartir base, es que el pipeline destruye datos de produccion de forma automatica y silenciosa.

5. **El item 45 (split E2E) queda RESUELTO** - por la unificacion de secrets, no por un fix de codigo. El diagnostico previo (spec en rama / webhook en production) sigue siendo valido como explicaracion de por que fallaba; lo que cambio fue la configuracion.

6. **`gh secret list` no expone valores, solo nombres y fecha de ultima actualizacion.**Fue la unica forma de inferir que los secrets cambiaron: la marca de tiempo del 03:16 posterior al fallo del 03:06.

7. **El drift de vault estaba confirmado:** Engram 109 vs vault 106. Cerrado con `pnpm vault:export`.

8. **La bitacora estaba parada desde `9af860e` (2026-10-01).** Dos dias sin registrar: spike T0 completo, items 39-43, merges #178/#180/#181, tres rounds de diagnostico del item 41, y el fix de nftables del runner.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
