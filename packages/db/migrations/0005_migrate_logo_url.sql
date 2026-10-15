-- T11 fix: `tenants."logoUrl"` pasa a ser la fuente de verdad del logo.
--
-- H-F3-v2-1 (auditoria v2, #258): T11 escribia `tenants."logoUrl"` y nadie lo
-- leia. El storefront leia `settings->>'logoUrl'`, un campo jsonb de una era
-- anterior. La feature estaba construida y testeada, pero sin efecto observable:
-- subir un logo no cambiaba nada en la tienda.
--
-- Medido sobre la base antes de migrar (2026-10-14):
--   tenants totales                          3
--   con settings->>'logoUrl' (origen viejo)  2   (tienda1, tienda2)
--   con tenants."logoUrl" (columna de T11)    0   <- el bug, medido
--
-- Esta migracion mueve los datos de la fuente vieja a la nueva. Es
-- **migracion de datos**: no crea columnas, ni tipos, ni indices. Solo mueve
-- valores de un sitio a otro.
--
-- Idempotente por dos motivos:
--   1. `WHERE "logoUrl" IS NULL` — no pisa un logo ya presente en la columna.
--      Un tenant con logo nuevo gana prioridad sobre el viejo.
--   2. Correrla dos veces no cambia nada la segunda.
--
-- Solo copia; **no borra** `settings->>'logoUrl'`. Ese campo queda deprecado
-- pero intacto: borrarlo seria una segunda migracion, y mientras haya lecturas
-- viejas en rollout seria una bomba. La limpieza va aparte, cuando ningun
-- proceso lo lea.
--
-- `tenants` NO tiene RLS (es tabla raiz), asi que este UPDATE no necesita
-- `withTenantContext`: corre en la migracion, no en una request.

UPDATE tenants
SET "logoUrl" = settings->>'logoUrl'
WHERE "logoUrl" IS NULL
  AND settings->>'logoUrl' IS NOT NULL;