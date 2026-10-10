-- T2 (SDD Fase 3, item P2 del spec): `tenants.status` deja de ser un `text`
-- libre y pasa a un enum con valores acotados.
--
-- Por que: `status` era `text` con default `'active'`, mientras
-- `subscriptions.status` arrancaba en `pending_first_payment`. Dos maquinas de
-- estados desincronizadas sobre la misma pregunta - ¿este tenant puede
-- operar? - y nada que hiciera cumplir ninguna de las dos. Un tenant
-- registrado por el superadmin nacia "activo" sin haber pagado nunca.
--
-- Por que ahora: Fase 3 construye el onboarding, que crea tenants en estado
-- `pending` y los activa cuando el webhook de plataforma confirma el pago. Sin
-- un tipo que lo diga, el estado depende de que cada call site recuerde
-- escribirlo bien.
--
-- El default pasa de `'active'` a `'pending'` porque es el estado correcto
-- para un tenant recien creado: no opero hasta que pago.
--
-- BACKFILL: no-op. Los 3 tenants de produccion ya estaban en `'active'`,
-- verificado con `scripts/dry-run-tenants-status.mjs` el 2026-10-10 contra
-- `neondb_owner@ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech`:
--
--     status    | total
--     ----------+------
--     'active'  |  3
--     (null)    |  0
--
-- Por eso NO hay un UPDATE aca. Agregarlo "por las dudas" seria un
-- `WHERE status = 'active'` que no matchea nada y que alguien va a leer
-- despues como "este UPDATE pone todo en active", que es exactamente la
-- operacion destructiva que el dry-run dio por descartada.
--
-- El `USING status::tenants_status` **falla** si algun valor no esta en el
-- enum. Eso es deliberado: un error en la migracion es mejor que un default
-- silencioso que deje un tenant en un estado que nadie puede leer.
--
-- ROLLBACK (documentado en el PR #244):
--
--     ALTER TABLE tenants ALTER COLUMN status DROP DEFAULT;
--     ALTER TABLE tenants ALTER COLUMN status TYPE text USING status::text;
--     ALTER TABLE tenants ALTER COLUMN status SET DEFAULT 'active';
--
-- El riesgo del rollback NO esta en la sentencia: esta en los datos. Si
-- alguien escribo un valor del enum que no existia como texto, revertir el
-- tipo lo deja como texto y no se pierde. Hoy no hay ese caso porque el
-- backfill fue no-op.

CREATE TYPE tenants_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'cancelled'
);

-- Se saca el default antes del cambio de tipo: `text` con default 'active' no
-- se castea a enum de forma implicita en todas las versiones de Postgres.
ALTER TABLE tenants ALTER COLUMN status DROP DEFAULT;

ALTER TABLE tenants
  ALTER COLUMN status TYPE tenants_status USING status::tenants_status;

ALTER TABLE tenants ALTER COLUMN status SET DEFAULT 'pending';