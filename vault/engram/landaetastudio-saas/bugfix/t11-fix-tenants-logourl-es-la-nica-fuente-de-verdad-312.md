---
id: 312
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-15 13:23:43"
updated_at: "2026-10-15 13:23:43"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "T11 fix: tenants.logoUrl es la única fuente de verdad"
---

# T11 fix: tenants.logoUrl es la única fuente de verdad

**What**: Item 107 (H-F3-v2-1, ALTA) RESUELTO. `tenants.logoUrl` es la unica fuente de verdad. Migracion 0005 aplicada y verificada. 3 lectores cableados. `config/settings` dejo de aceptar logoUrl (Opcion A). Nuevo helper `apps/storefront/lib/tenant-branding.ts`. 930 → 942 tests. Issue #277.

**Why**: T11 escribia `tenants.logoUrl` y el storefront leia `settings.logoUrl` (jsonb viejo). Feature construida sin efecto observable.

**Where**: packages/db/migrations/0005_migrate_logo_url.sql + meta/_journal.json + scripts/check-migrations-applied.mjs; apps/storefront/{lib/tenant-branding.ts, lib/__tests__/tenant-branding.test.ts, app/layout.tsx}; apps/admin/app/api/config/settings/route.ts + __tests__; apps/admin/app/(dashboard)/store/settings/page.tsx; vault (107 RESUELTO, 116 ampliado).

**Learned**:
- **El bug medido sobre la base es peor que "columna inerte"**: 3 tenants, 2 con `settings->>'logoUrl'`, **0 con `tenants."logoUrl"`. T11 NO HABÍA ESCRITO NUNCA NADA.** Con endpoint, tests y docblock.
- **`config/tenant/branding` NO TIENE UI QUE LO LLAME.** `git grep tenant/branding` solo lo encuentra a sí mismo. T11 construyó una **vía de escritura sin puerta de entrada**. Por la UI no se puede cambiar el logo de ningún tenant. Si se cambiaban los lectores sin más, el logo desaparecía de todas las tiendas: dato presente, escritor inalcanzable.
- **El wrapper de migraciones no sabía verificar migraciones de DATOS.** Agregué el tipo de señal `rowChecks` (query con número de filas esperado, default 0). Re-declarar `tenants.logoUrl` habría sido MENTIRA: la creó la 0004 y existiría aunque la 0005 nunca corriera — y ese wrapper existe para evitar exactamente eso (ítem 94). Verificado en ambas direcciones: antes de aplicar `FALTA, 2 filas donde se esperaban 0`; después `ok`.
- **La migración copia pero NO borra el jsonb**: borrarlo mientras haya lecturas viejas en rollout es una bomba. La limpieza va aparte, cuando nadie lo lea. `WHERE "logoUrl" IS NULL` la hace idempotente y da prioridad al logo nuevo.
- **TypeScript corrigió una prueba mía.** Escribí un test que afirmaba que el helper quita `settings.logoUrl`; el compilador rechazó el acceso porque `TenantBranding['settings']` no declara el campo. El TIPO hace el trabajo que yo delegaba al test. Reescribí la prueba para afirmar lo comprobable (settings se pasa por identidad) en vez de forzar al helper a hacer algo indebido.
- **El repo NO tiene infraestructura para renderizar Server Components**, y el único test de `perfil/page.tsx` no importa la página: asserta sobre objetos hardcodeados. Por eso los lectores NO eran testeables salvo que extrajera el helper — y sin tests habría repetido H-F3-v2-1 (código nuevo sin efecto verificable).
- **Un input editable que el endpoint ignora es peor que ninguno**: acepta el click, acepta la URL y no pasa nada sin avisar. El input del admin quedó en solo lectura con la razón a la vista.
- `config/settings` PUT con `logoUrl` responde 200, NO 400: Zod hace strip de claves desconocidas. Un 400 habría roto el formulario de admin entero.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
