# Migraciones Drizzle

Este directorio contiene las migraciones SQL y los snapshots de
drizzle-kit (en meta/).

## Snapshots (meta/*_snapshot.json)

Los snapshots son generados por drizzle-kit y reflejan el estado
del schema TypeScript, no el estado real de la DB.

IMPORTANTE: el campo `isRLSEnabled: false` en el snapshot NO
significa que la tabla no tenga RLS. Drizzle no trackea RLS en el
schema TypeScript. Las policies se aplican vía migraciones manuales
(0009, 0010, 0014).

Para verificar si una tabla tiene RLS activo:

    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE relname = '<tabla>';

Ver vault/03_Deuda/deuda-tecnica.md ítem 15.