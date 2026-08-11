# Migración: timestamp → timestamptz (UTC explícito)

**Fecha:** 2026-07-20
**Estado:** Diseño aprobado pendiente de implementación

## Contexto

El schema de Drizzle declara 18 columnas en 10 tablas como `timestamp` (PostgreSQL `timestamp without time zone`). La aplicación depende de que Neon/Vercel corran en UTC para que estos valores representen correctamente UTC, pero no hay garantía a nivel de schema. Es deuda técnica documentada desde la auditoría P1-2.

## Decisión

Migrar las 18 columnas a `timestamp with time zone` (`timestamptz`) con `{ withTimezone: true }` en Drizzle, forzando `SET TIME ZONE 'UTC'` antes del ALTER TYPE para que la conversión de valores existentes sea determinística.

## Riesgos y mitigaciones

| Riesgo                                                 | Mitigación                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ACCESS EXCLUSIVE` lock durante ALTER TYPE             | Las migraciones generadas por drizzle-kit usan `--> statement-breakpoint` entre cada sentencia. Con `breakpoints: true` (journal v7), cada bloque corre en su propia transacción. El lock no acumula entre tablas. Exposición real: ~1.6s para una columna, ~3s para tablas con 2 columnas (ALTER seq.) Si el volumen crece 100x, revisar. |
| Datos existentes interpretados con timezone incorrecto | `SET TIME ZONE 'UTC'` como primera sentencia de la migración. PostgreSQL asume que los valores naive están en la zona de la sesión al convertirlos a `timestamptz`.                                                                                                                                                                        |
| Rollback por bloque                                    | Cada bloque (`--> statement-breakpoint`) corre en una transacción individual. Si un ALTER falla, solo ese bloque se revierte; los anteriores ya están commiteados.                                                                                                                                                                         |
| Seed con datos de prueba                               | `pnpm db:seed` solo se ejecuta en la branch de validación o en develop local. En producción no se corre seed — el checklist de verificación debe aclararlo explícitamente.                                                                                                                                                                 |

## Plan de implementación

### Fase 1: Branch efímera de validación (Neon)

1. Crear branch efímera desde el snapshot actual de BD
2. En el archivo de migración generado, agregar como **primeras sentencias del archivo** (antes de cualquier ALTER):
   ```sql
   SET TIME ZONE 'UTC';
   SET statement_timeout = '10s';
   --> statement-breakpoint
   ```
3. Ejecutar `pnpm db:generate` → genera `0011_timestamptz` (o el número siguiente)
4. Editar el archivo generado para insertar las sentencias SET + `--> statement-breakpoint` al inicio
5. Ejecutar `pnpm db:migrate`
6. **Validar** 2-3 filas con timestamps conocidos:
   ```sql
   SELECT createdAt AT TIME ZONE 'UTC' FROM orders ORDER BY createdAt DESC LIMIT 3;
   ```
   Confirmar que el valor coincide con la hora esperada (ej: ordenes del seed de esta sesión, ~21:45 UTC).
7. **Validar journal**: leer `meta/_journal.json` y confirmar que `0011_timestamptz` está registrado con `breakpoints: true`. Si migración manual `0010_force_rls.sql` rompió la secuencia, reparar el journal.

### Fase 2: Implementación en schema.ts

En el mismo PR de la migración:

```diff
- timestamp("createdAt").defaultNow().notNull()
+ timestamp("createdAt", { withTimezone: true }).defaultNow().notNull()
- timestamp("updatedAt").defaultNow().notNull()
+ timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
```

Tablas afectadas: `tenants`, `products`, `product_images`, `product_variants`, `customers`, `admin_users`, `orders`, `order_items`, `categories`, `shipping_methods`.

### Fase 3: Aplicación a producción

1. Push + PR a develop
2. Merge a main
3. Aplicación manual contra la Neon de producción (mismo procedimiento que 0009/0010):
   - Conectarse a la BD de producción con `neondb_owner`
   - Ejecutar `pnpm db:migrate` — no hay hook automático de deploy que lo haga
4. Post-deploy: query de verificación en la BD real

## Medición real

Ejecutada el 2026-07-20 contra BD con 2 tenants, 6 productos, 28 variantes, 4 órdenes:

| Métrica                      | Valor                          |
| ---------------------------- | ------------------------------ |
| Columnas medidas             | 18                             |
| Tiempo total (18 ALTER TYPE) | ~17.2s                         |
| Peor columna individual      | 1,625ms (`products.updatedAt`) |
| Peor tabla (2 columnas)      | ~2.8s (`products`, `tenants`)  |
| Promedio por columna         | ~954ms                         |
| Timeout por comando          | 10s                            |

La variación incluye latencia de red a Neon (~100-300ms por viaje redondo). En Vercel (misma región que Neon) sería menor.

## Verificación post-migración

- `pnpm build` — confirmar que schema.ts compila
- `pnpm test` — 292 tests pasando
- `pnpm db:seed` — solo en branch de validación o develop local. Jamás en producción.
- Query de verificación en BD validando 3 filas con timestamps conocidos

## Rollback plan

- Las migraciones generadas por drizzle-kit con `breakpoints: true` ejecutan cada bloque (`--> statement-breakpoint`) en su propia transacción
- `SET statement_timeout = '10s'` al inicio de la migración: si un ALTER TYPE individual excede 10s, PostgreSQL lo cancela automáticamente (error `query_canceled`), y drizzle-kit detiene la migración. El bloque completo se rollbackea (no deja la base en estado parcial dentro de ese bloque).
- Los bloques anteriores ya commiteados **no se revierten** — hay que aplicar un ALTER TYPE inverso manualmente (`ALTER COLUMN TYPE timestamp without time zone`) para cada columna ya migrada.

## Reintento después de falla parcial — verificado

Probado en BD real (2026-07-20):

- `ALTER COLUMN ... TYPE timestamptz` sobre columna ya `timestamptz` es **no-op exitoso** (incluso con cláusula `USING` explícita)
- Si una transacción (bloque) falla por timeout, todo el bloque se rollbackea — la columna vuelve a su estado anterior
- Reintentar `pnpm db:migrate` después de una falla parcial es seguro: las columnas ya convertidas aceptan el ALTER como no-op, las pendientes se reintentan limpiamente

## Procedimiento en producción si un bloque falla

1. Verificar qué columnas llegaron a migrar (consulta `information_schema.columns`)
2. Correr ALTER inverso manual para cada columna migrada: `ALTER TABLE "t" ALTER COLUMN "c" TYPE timestamp without time zone`
3. Corregir la causa de la falla (ej: ajustar `statement_timeout`)
4. Reintentar `pnpm db:migrate`
