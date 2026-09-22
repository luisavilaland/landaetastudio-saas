# Meta de migraciones Drizzle

Los archivos `*_snapshot.json` son generados por drizzle-kit y
reflejan el estado del **schema TypeScript**, no el estado real
de la DB.

**Importante:** el campo `isRLSEnabled: false` en el snapshot NO
significa que la tabla no tenga RLS. Significa que Drizzle no
trackea RLS en el schema. Las policies se aplican vía migraciones
manuales (0009, 0010, 0014).

Para verificar si una tabla tiene RLS activo, consultar la DB real:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = '<tabla>';
```

Ver `docs/deuda-tecnica.md` ítem 15.