---
id: 276
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/item-94-db-migrate-no-verifica
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 17:58:15"
updated_at: "2026-10-10 17:58:15"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 94: db:migrate reportaba exito sin aplicar, por un created_at corrupto"
---

# Item 94: db:migrate reportaba exito sin aplicar, por un created_at corrupto

**What**: Item 94 — `pnpm db:migrate` reportaba éxito sin aplicar nada. Registro `id=3` de `drizzle.__drizzle_migrations` con `created_at = 1799110400000` (2027-01-05, 3 meses en el futuro). Corregido a `1791301469000`. Wrapper `scripts/check-migrations-applied.mjs` agregado y cableado a `db:migrate`. PR #243.

**Why**: S1 quedó bloqueado en R1. La migración `0003_tenants_status_enum` se aplicó "con éxito" y no cambió nada.

**Where**: `drizzle.__drizzle_migrations` (fila id=3 en Neon producción), `scripts/check-migrations-applied.mjs` (nuevo), `package.json` (`db:migrate`), items 43 y 94 de `vault/03_Deuda/deuda-tecnica.md`.

**Learned**:
- **Drizzle decide qué migrar comparando el `when` del journal contra el `created_at` MÁS ALTO de la base.** Si una migración nueva tiene `when` menor que ese máximo, la considera ya aplicada y la salta. **Un solo registro corrupto vuelve invisibles todas las migraciones siguientes.** Y lo reporta como `migrations applied successfully`.
- **El fix de #222 fue parcial: corrigió el journal y no el registro en la base.** La fuente visible quedó bien y el estado real quedó mal. Es la quinta variante de "un control que reporta éxito y no ejecutó el trabajo": 61 (RLS enmascarando el WHERE), 62 (el nombre haciendo la review), 67 (external_reference sin validar), 90 (el detector que no mira CJK), 94 (db:migrate que no verifica).
- **El wrapper verifica el EFECTO OBSERVABLE, no el tracking.** Consultar `drizzle.__drizzle_migrations` para saber si la migración aplicó sería consultar justamente la tabla que puede estar mintiendo. El wrapper mira si el tipo/columna/índice/función existen.
- **Una migración sin señal declarada hace fallar el check.** Sin eso el wrapper sería decorativo: pasaría en verde sobre migraciones que no aplicaron, que es el bug.
- **El wrapper falló al implementarse y el fallo fue suyo, no de la base:** inventé el nombre de índice `subscriptions_preapproval_unique`; el real es `subscriptions_mp_preapproval_idx`. **Eso es exactamente el valor de un control que falla cuando debe**: me obligó a verificar el nombre real en la base en vez de confiar en el recuerdo. Un check que hubiera pasado en verde sobre un nombre inventado no habría verificado nada.
- **Item 43 y 94 no son duplicado:** el 43 es una migración que se intenta y falla con el error tragado por `hanji`; el 94 es una que ni se intenta. Se cruzaron y se subió la severidad del 43 a ALTA.
- **La costura que NO queda cerrada:** el wrapper no corre en CI contra producción. `e2e.yml:108` invoca `db:migrate` contra la base del runner. El bug del `created_at` es de producción, así que el wrapper solo lo atrapa si alguien corre `db:migrate` contra producción.
- **Drizzle usa el schema `drizzle`, no `public`**, para su tabla de tracking. Un `information_schema` filtrado por `schemaname='public'` no la encuentra, y eso hace que parezca que la tabla no existe.
- Gotcha de tooling: `enum` es palabra reservada en ES modules, no puede ser nombre de variable en un `.mjs`.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
