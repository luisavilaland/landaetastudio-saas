---
id: 328
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-27 15:06:45"
updated_at: "2026-10-27 15:06:45"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Regresión del seed en T11: jsonb muerto, deadlock de CI y caída de logos en producción"
---

# Regresión del seed en T11: jsonb muerto, deadlock de CI y caída de logos en producción

**What**: La regresion que el CI destapo al re-disparar el T11 fix (#278): `packages/db/seed.ts` seguia escribiendo el logo en `settings.logoUrl` mientras el storefront ya leia `tenants.logoUrl`. Corregido con espejo de transicion (columna + jsonb). Item 123 registrado.

**Why**: Al re-disparar CI con un commit vacio aparecio `seed: FAILURE` y `e2e: SKIPPED`. 12 tests unitarios no podian verlo: mockean la DB.

**Where**: packages/db/seed.ts; scripts/check-migrations-applied.mjs (rowChecks con `hint`); vault/03_Deuda/deuda-tecnica.md (item 123); vault/02_Bitacora/bitacora.md.

**Learned**:
- **`packages/db/seed.ts` era el unico escritor del jsonb viejo.** Mi PR cambio los lectores a la columna pero no el seed → tras `pnpm db:seed` el logo solo existia en el campo deprecado y el storefront mostraba vacio. Los tests unitarios mockean la DB y no pueden detectar un seed inconsistente.
- **DEADLOCK de CI**: el rowCheck de 0005 afirma "ningun tenant con logo en jsonb y columna NULL". El seed viejo recreaba ese estado. Como `db:migrate` corre el check y el script es `db:migrate && db:seed`, el check fallaba e impedia el seed que lo habria arreglado. La base no se auto-repara. Se destrabo sembrando a mano; ahora el rowCheck acepta `hint` y dice "corré pnpm db:seed" en vez de mandar al item 94.
- **PRODUCCION ROMPIO Y SE ARREGLO**: escribir solo la columna vacio el jsonb en la base compartida, y `main` todavia lee `settings.logoUrl`. **El job `seed` del E2E corre contra `NEON_DATABASE_URL`, la MISMA base que produccion, en cada PR.** Sin espejo, cada PR borraba los logos del sitio en vivo. El seed escribe las DOS ahora; el jsonb es espejo de transicion y se borra cuando `main` corra el codigo nuevo.
- **`wait-for-deployments` es un FALSO POSITIVO de deploy**: hace curl a `https://tienda1.landaetastudio.com`, `admin.` y `superadmin.` — URLs de PRODUCCION, no previews. Estaba verde mientras los 3 deployments del PR fallaban con "Account is blocked". Para saber del deploy hay que leer la status API del commit (`/commits/<sha>/status`).
- **`e2e: SKIPPED` no era paths filter**: `e2e` tiene `needs: [wait-for-deployments, seed]`; si `seed` falla, el job se saltea y `e2e-success` (con `if: always()`) marca rojo. Se arregla solo cuando el seed pasa.
- **Push post-aprobacion descarta la aprobacion** (`REVIEW_REQUIRED`). Es correcto cuando el contenido cambio de verdad; conviene cerrar docs ANTES de pedir re-review.
- **`gh` portable en `%TEMP%` se borra**: el binario en `$env:TEMP\gh\bin\gh.exe` desaparecio (limpieza de Windows). Reinstalado en `$env:TEMP\ghpkg\bin\gh.exe` v2.103.3. Verificar con `gh auth status` antes de usarlo.
- **Mensajes de commit multilinea en PowerShell rompen el comando** (regla 6 del repo): usar `git commit -F <archivo>` escrito con la herramienta de escritura.
- Nuevo item 123: `packages/validation/src/__tests__/store-settings.test.ts` define su PROPIO `storeSettingsSchema` y lo testea — test autorreferencial que afirma que `logoUrl` es valido en settings, justo lo que el T11 elimino.
- Item 121 referencia "item 122" que no existe (referencia colgante).

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
