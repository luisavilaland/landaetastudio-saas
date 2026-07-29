# Cobertura de Tests — Grupos A/B (Revisado) Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las brechas de cobertura real identificadas por el audit de grafo de imports: migrar 9 tests de contrato a reales, cubrir 5 endpoints sin test, y agregar cobertura a packages críticos.

**Architecture:** El audit reveló que ~47% de los endpoints "cubiertos" tenían tests de contrato (handlers inline que no ejercitan el código real). Prioridad máxima es reemplazar esos tests (Grupo 1, secuencial con checkpoint). Grupo 2 (5 endpoints sin test) y Grupo 3 (9 packages) son paralelizables.

**Tech Stack:** TypeScript, Vitest, `@repo/test-utils` (makeTxMock, session, mockReq), `@repo/db` (withTenantContext)

---

## Resumen

### Grupo 0 — Eliminar duplicado store/settings
**Task 0:** Eliminar `apps/admin/app/api/store/settings/route.ts`, actualizar `page.tsx` de `/api/store/settings` a `/api/config/settings`.

### Grupo 1 — Migrar 9 tests de contrato a reales (secuencial con checkpoint)
| Task | Endpoint | Handlers | App |
|------|----------|----------|-----|
| 1.1 | `categories/route` | GET, POST | admin |
| 1.2 | `categories/[id]/route` | GET, PUT, DELETE | admin |
| 1.3 | `dashboard/route` | GET | admin |
| 1.4 | `orders/route` | GET | admin |
| 1.5 | `products/route` | GET, POST | admin |
| 1.6 | `products/import/route` | POST (CSV) | admin |
| 1.7 | `shipping/route` | GET, POST | admin |
| 1.8 | `shipping/[id]/route` | GET, PUT, DELETE | admin |
| 1.9 | `search/route` | GET | storefront |

### Grupo 2 — 5 endpoints sin test (paralelizable)
| Task | Endpoint | Handlers | App |
|------|----------|----------|-----|
| 2.1 | `config/settings` | GET, PUT | admin |
| 2.2 | `config/tenant` | GET | admin |
| 2.3 | `config/tenant/domain` | PUT | admin |
| 2.4 | `domain-check` | GET | admin |
| 2.5 | `domain-check` | GET | superadmin |

### Grupo 3 — 9 packages sin cobertura (paralelizable)
| Task | Archivo | Riesgo |
|------|---------|--------|
| 3.1 | `@repo/db/src/index.ts` — `withTenantContext` | Crítico |
| 3.2 | `@repo/commerce/src/cart.ts` | Alto |
| 3.3 | `@repo/auth/src/index.ts` | Alto |
| 3.4 | `@repo/commerce/src/email.ts` | Medio |
| 3.5 | `@repo/commerce/src/tenant.ts` | Medio |
| 3.6 | `@repo/storage/src/index.ts` (placeholder) | Medio |
| 3.7 | `@repo/validation/src/env.ts` | Bajo |
| 3.8 | `@repo/validation/src/schemas.ts` (extender) | Bajo |
| 3.9 | `@repo/logger/src/index.ts` | Bajo |

---

## Notas de diseño por tarea

### Task 0 (Grupo 0)
- `apps/admin/app/api/config/settings/route.ts` y `apps/admin/app/api/store/settings/route.ts` son copias exactas (112 líneas)
- Solo referencia a `store/settings` está en `apps/admin/app/(dashboard)/store/settings/page.tsx` (fetch en líneas 59 y 99)

### Task 1.6 (products/import)
- NO usa `@repo/storage` — solo opera sobre `dbProducts`, `dbProductVariants`, `dbCategories`
- Usa `withTenantContext` en dos capas: (1) leer categorías, (2) por fila para check slug + insert producto+variante
- No requiere mock de storage

### Task 3.1 (withTenantContext)
- No prueba RLS en sí (validado contra Neon real en P1-1). Solo verifica que emite `SELECT set_tenant_id(...)` dentro de `db.transaction` y pasa `tx` al callback
- Es una red de regresión contra el bug original (SET fuera de transacción)

### Criterio Grupo 1
- Cada aserción que cambie debe justificarse contra el handler real, no solo hasta que el test dé verde
- El handler falso nunca reflejó el comportamiento real — es esperable que status codes, formas de respuesta y mensajes cambien
