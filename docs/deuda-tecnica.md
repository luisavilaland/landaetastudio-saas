# Deuda técnica — planes pendientes

> Documentación de deuda técnica identificada al 2026-08-08 (plan aprobado, ítem 3).
> **Estado: no ejecutado** — este documento es solo el plan; ninguno de los tres ítems fue implementado.

---

## 1. TOCTOU en stock de checkout (time-of-check to time-of-use)

**Contexto real:** `apps/storefront/app/api/checkout/route.ts` dentro de `withTenantContext`:

1. Lee stock de las variantes (`tx.select` de `dbProductVariants`, líneas ~85-98).
2. Valida stock suficiente contra el valor leído (líneas ~104-108).
3. Decrementa con `tx.update(...).set({ stock: (variant.stock ?? 0) - item.quantity })` (líneas ~169-182).

El decremento calcula el valor nuevo a partir del leído (**no `stock - qty` atómico en SQL**) y no hay `SELECT ... FOR UPDATE` ni lock: dos órdenes concurrentes pueden leer el mismo stock, pasar la validación ambas, y la segunda sobrescribe el stock con un decremento sobre un valor viejo → **oversell**.

**Plan propuesto (no implementado):**

- Opción A (recomendada): reemplazar el `update ... set({ stock: X })` por un UPDATE atómico condicional:

  ```ts
  const result = await tx
    .update(dbProductVariants)
    .set({ stock: sql`${dbProductVariants.stock} - ${item.quantity}` })
    .where(
      and(
        eq(dbProductVariants.id, item.variantId),
        eq(dbProductVariants.tenantId, tenantIdFromSlug),
        gte(dbProductVariants.stock, item.quantity)
      )
    );
  ```
  — y validar `result.rowCount === 1` por ítem; si hay 0, abortar la transacción con "Stock insuficiente". Como todo corre dentro de `withTenantContext` (transacción real), el rollback es automático si un ítem falla.

- Opción B: `SELECT ... FOR UPDATE` de las variantes al inicio del bloque, dentro de la misma transacción, y validar sobre esos valores lockeados (el `FOR UPDATE` se serializa correctamente entre transacciones concurrentes).

**Criterios de aceptación:**

- Test de concurrencia (o al menos unitario que valide el `WHERE gte` y el `rowCount`): dos flujos simultáneos sobre la misma variante con stock justo → solo uno completa; sin stock negativo tras ambos.
- Unit test sobre el SQL atómico con `makeTxMock` configurado con `rowCount` (patrón AGENTS.md → Helpers de test).

**Archivos a tocar:** `apps/storefront/app/api/checkout/route.ts` (+ su `__tests__/route.test.ts`).

---

## 2. Política de migraciones inmutables — formalizar en CI

**Contexto real:** AGENTS.md ya establece la regla *“Migraciones de DB inmutables: ante un cambio de schema, genera una nueva migración con `pnpm db:generate`. Jamás modifiques migraciones existentes”*. Hasta ahora es solo una regla de proceso (humana) — no hay guard automatizado.

**Plan propuesto (no implementar ahora):**

1. Script de verificación `packages/db/scripts/check-migrations.sh` (o task de turbo `db:check-migrations`):
   - Compara los archivos `.sql` de `packages/db/migrations` contra el commit base de la rama (ej: `git diff --name-only origin/develop...HEAD -- packages/db/migrations`).
   - Falla si algún `.sql` existente fue **modificado** (no debe permitirse; solo ADD de nuevos archivos).
2. Hook en CI: agregar paso al workflow existente (o job nuevo `db-migrations-check` en `.github/workflows/`) que corre el script en cada PR a `develop`.
3. Opcional: integración con `drizzle-kit generate` — documentar en AGENTS.md que el flujo canónico es `pnpm db:generate` y verificar que no genere diff en migraciones existentes (`git status` limpio después de generate).

**Criterios de aceptación:** un `.sql` viejo modificado a mano → el check falla con mensaje claro; un `.sql` nuevo → pasa. Documentar el comando en SETUP.md → Comandos de Base de Datos.

---

## 3. Pin IPv4 del endpoint Neon para el runner self-hosted

**Contexto real**: el runner self-hosted de GitHub Actions (AlmaLinux) que corre los E2E no tiene ruta IPv6; el endpoint de Neon publica también AAAA y el rollback DNS puede resolver a IPv6 → fallan las conexiones (ya observado en julio-2026; mitigado ad-hoc con pin en `/etc/hosts`, documentado parcialmente en SETUP.md → E2E).

**Plan propuesto (no implementar ahora):**

- Procedimiento documentado completo:
  1. Resolver la IP IPv4 actual del endpoint: `dig +short A <host>` o `getent ahostsv4 <host-neon>` (ej: `xxxxxxxx.eu-central-1.aws.neon.tech`).
  2. En el runner: `echo "<IP> <host-neon>" >> /etc/hosts` (con el usuario root / sudo).
  3. Verificar conectividad: `psql "$DATABASE_URL" -c "SELECT 1"` o corriendo el e2e webhook (`pnpm --filter root test:e2e`).
  4. Alternativa robusta si Neon lo soporta: usar un endpoint **IPv4-only** / IP allowlist del pool del proyecto para eliminar la dependencia de `/etc/hosts`.

**Riesgos y control:** las IPs de Neon pueden rotar (pool) — si una IP deja de responder y el problema de IPv6 reaparece, el pin debe actualizarse; documentar el rot de IPs como mantenimiento mensual o se ambia a la alternativa IPv4-only.

**Dónde documentar:** SETUP.md → seccion E2E (expandir el bullet actual) y este doc.

---

## Referencia

Plan aprobado el 2026-08-08 (ítem 3 de la tarea de calidad: limpieza email + health check + deuda técnica). Rama `quality/calidad-y-monitoreo`. Ver bitacora.md → entrada 2026-08-08 — Calidad.