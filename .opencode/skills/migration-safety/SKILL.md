---
name: migration-safety
description: Usar al crear, editar o aplicar migraciones de DB en landaetastudio-saas. Trigger - cambiar el schema Drizzle, agregar tabla o columna, agregar indice o constraint, correr pnpm db:generate o db:migrate, tocar packages/db/migrations, o cuando el guard de migraciones inmutables falle en CI.
---

# Seguridad en migraciones

## Regla unica

Las migraciones son **append-only**. Un `.sql` o un `*_snapshot.json` que ya existe jamas se edita. Si el schema esta mal, se agrega una migracion nueva que lo corrige.

La razon es operacional, no ideales: una migracion ya aplicada en produccion no se puede deshacer editando el archivo. Editarla produce drift silencioso entre lo que dice el repo y lo que la base_real ejecuto.

## Comandos

```bash
pnpm db:generate   # cd packages/db && drizzle-kit generate  -> crea migraciones nuevas
pnpm db:migrate    # cd packages/db && drizzle-kit migrate
pnpm db:seed       # tsx packages/db/seed.ts
```

`db:migrate` ejecuta `drizzle-kit migrate`, **no** `drizzle-kit up`. Los dos comandos se confundieron en el pasado: `up` reaplica migraciones manualmente insertadas y deja el tracking en un estado que `migrate` no reconoce. Si alguien propone cambiar el script, es un rediseno, no un fix.

## Que es inmutable y que no

| Artefacto | Inmutable | Nota |
| --- | --- | --- |
| `packages/db/migrations/*.sql` | Si | Editar o borrar rompe el guard. |
| `packages/db/migrations/meta/*_snapshot.json` | Si | Los snapshots son parte del estado. |
| `packages/db/migrations/meta/_journal.json` | No | Crece con cada migracion nueva. Es metadata, no contiene SQL. |
| Archivos nuevos (agregados) | N/A | El guard los espera y permite. |

El guard es `scripts/check-migrations.sh`. Falla si detecta un `.sql` o `_snapshot.json` existente que fue modificado o eliminado. Usa `--diff-filter=MD` a proposito: los archivos agregados son esperados y validos, y sin ese flag cualquier PR que agregue una migracion nueva fallaria.

El guard **falla cerrado**: si `origin/develop` no esta disponible localmente hace `git fetch`, y si tampoco puede resolverlo, sale con error en vez de pasar en silencio. Un guard que pasa cuando no pudo verificar no es un guard.

## Excepcion: reset de baseline

Un reset documentado es la unica via para reescribir el historial. Se hace moviendo el historial viejo a `docs/migrations-archive/<fecha>/` y agregando un `README.md` en ese directorio. La presencia de ese README es el marcador explicito de aprobacion: el guard permite modificar o borrar unicamente archivos que tengan contraparte con el mismo basename en el archive. Cualquier otro archivo sigue bloqueado.

Ejecucion real: `docs/migrations-archive/2026-09-24/`.

## Procedimiento para una migracion ya aplicada con problema

1. No editar el `.sql` original.
2. No editar `_journal.json` retroactivamente. Rompe las bases ya migradas porque drizzle intenta re-aplicar.
3. Crear una migracion nueva idempotente que garantice el estado deseado en cualquier entorno:

```sql
-- Idempotente: se puede correr sobre DBs que ya lo tienen y sobre las que no
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON "subscriptions"
      USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;
```

4. Regenerar el snapshot con `pnpm db:generate` (no editarlo a mano).
5. Aplicar y verificar.

Una migracion idempotente cubre el caso dificil: la DB de develop ya la aplico, la de staging no, produccion tampoco. Un `ALTER` plano funciona en las tres. Un `CREATE TABLE` sin `IF NOT EXISTS` revienta en las dos que ya la tienen.

## packages/db/migrations/meta/ es solo JSON

drizzle-kit lee y parsea **todo** lo que hay en `meta/` como JSON en cada operacion (`generate`, `migrate`). Un archivo no-JSON ahi rompe el pipeline completo con:

```
Unexpected token '#', "... is not valid JSON
```

La cadena de fallas es: `drizzle-kit up` falla, `pnpm db:migrate` falla, `pnpm db:seed` no corre, y el E2E queda bloqueado. Por eso la documentacion de snapshots y journal vive en `packages/db/migrations/README.md`, un nivel arriba, y no en `meta/`.

Antes de agregar cualquier archivo a `meta/`:

```bash
cd packages/db && pnpm exec drizzle-kit up
```

Si ese comando no termina sin error, el archivo esta mal.

## Verificacion de append-only

```bash
git diff --name-only --diff-filter=MD origin/develop -- \
  'packages/db/migrations/*.sql' \
  'packages/db/migrations/meta/*_snapshot.json'
```

Salida vacia = nadie toco historia. Cualquier linea es un regresion.

## Checklist antes de abrir PR con cambio de schema

- [ ] `pnpm db:generate` genero la migracion; el `.sql` es nuevo, no editado.
- [ ] Los comandos `ALTER` son idempotentes o la migracion esta guiada por un bloque `DO` que verifica el estado previo.
- [ ] Toda query nueva va dentro de `withTenantContext`.
- [ ] Si la migracion habilita RLS, la tabla tiene `tenantId` y policy `tenant_isolation`. Verificar contra la lista de globales exentas: `tenants`, `admin_users`, `plans`.
- [ ] `pnpm db:migrate` corre y termina sin error.
- [ ] `pnpm db:seed` corre despues del migrate, en ese orden.
- [ ] `git diff --diff-filter=MD origin/develop -- packages/db/migrations` esta vacio.
- [ ] Si es un reset de baseline: hay `docs/migrations-archive/<fecha>/README.md` y cada archivo modificado tiene contraparte en el archive.

## Roles de DB

`DATABASE_APP_URL` es el rol de la app, con permisos reducidos, sin `rolbypassrls`. `DATABASE_URL` es del owner y se usa **solo** para migraciones y seed. `packages/db/src/index.ts` tira `throw` si `DATABASE_APP_URL` falta, sin fallback a `DATABASE_URL`, porque el owner tiene `rolbypassrls=true` y anularia RLS en toda la aplicacion.

El seed y las migraciones necesitan poder escribir sin restriccion. Si una migracion falla con `permission denied` para el owner, el problema es un `REVOKE` previo (por ejemplo el que deja a `app_user` con solo `SELECT`), no la sintaxis SQL.

## Limpieza de artefactos

`pnpm db:generate` escribe archivos. Si la migracion generada no es parte de la tarea, borrarla antes de comitear, salvo que el plan diga explicitamente que esos archivos si son el entregable.
