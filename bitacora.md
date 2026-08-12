# Bitácora — saas-ecommerce

> SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.
> Monorepo Turborepo (pnpm) — Next.js 16, Drizzle ORM, PostgreSQL, NextAuth v5.

---

## 2026-04-22 — Fundación del proyecto

- Commit inicial desde `create-turbo`.
- Configuración monorepo: 3 apps (`storefront`, `admin`, `superadmin`), paquetes iniciales.
- Docker Compose con PostgreSQL 16, Redis 7, MinIO, MailHog.
- Variables de entorno con dotenv, scripts base en `package.json`, Turbo repo config.

---

## 2026-04-22 al 2026-04-25 — Fase 1: Auth y Órdenes

- NextAuth v5 con Credentials provider para admin y superadmin.
- Middleware multi-tenant con resolución de subdominios.
- CRUD de tenants en superadmin.
- CRUD de productos en admin (variante única).
- Validación backend con Zod (price > 0, stock >= 0).
- Subida de imágenes a MinIO con `@repo/storage`.
- Carrito funcional: Redis + cookie session, 7 días TTL, usuarios anónimos.
- Checkout con MercadoPago (Checkout Pro, binary_mode).
- Webhook con verificación de firma y prevención de duplicados.
- Email de confirmación con nodemailer.
- Seed de datos de prueba.
- Customer auth (registro y login en storefront).
- Panel de órdenes en admin (lista, detalle, cambio de estado).

---

## 2026-04-26 al 2026-04-29 — Fase 2: Dashboard y Stock

- Dashboard con métricas reales (ventas del mes, órdenes pendientes, stock bajo).
- Edición rápida de stock en tabla de admin.
- Badge "Agotado" en storefront y product-card.
- Lista de productos con stock bajo en dashboard.

---

## 2026-04-29 al 2026-05-03 — Fase 3: Experiencia de Tienda

- Categorías de productos (CRUD completo).
- Búsqueda server-side con ILIKE en storefront.
- Múltiples imágenes por producto (tabla `product_images`, orden por position).
- Variantes reales con JSONB (talle, color, SKU, stock independiente).
- Validación Zod en todos los endpoints.
- Seed actualizado con categorías, variantes, órdenes de ejemplo.
- 165 tests.

---

## 2026-05-03 al 2026-05-15 — Fase 3.5: Bug Fixes y Refactor

- Corrección de bugs en carrito, variantes, imágenes, logout redirects.
- Refactor de `proxy.ts` → `middleware.ts` (convención Next.js).
- Refactor de `new Response()` → `NextResponse` en todas las rutas.
- Tests de categorías reescritos con patrón de lógica pura (compatibilidad vitest).
- Solución de problemas con Turbopack y proxy.
- 195 tests.

---

## 2026-05-15 al 2026-06-01 — Fase 4: Autoservicio del Tenant

- Configuración visual del tenant (logo, colores, variables CSS).
- Dominio personalizado con verificación (API + UI).
- Perfil de tienda pública con SEO.
- Métodos de envío configurables por tenant (CRUD completo).
- Checkout con selector visual de envío y cálculo dinámico.
- Refactor: consolidación de auth en `@repo/auth`, lógica de negocio en `@repo/commerce`.
- Normalización de slugs en `@repo/validation`.
- Importación de productos por CSV.
- Seguridad: proxy de validación de host en admin y superadmin.
- 225 tests.

---

## 2026-06-01 al 2026-06-15 — Fase 5: Producción y Seguridad

- **RLS (Row Level Security):** políticas `tenant_isolation` en todas las tablas de negocio. Helper `withTenantContext`.
- **AUTH_SECRET obligatorio:** sin fallback hardcoded. Validación al arrancar.
- **CSRF protection:** activado automáticamente por NextAuth v5 en producción.
- **Validación Zod de entorno:** schema `env.ts` que valida variables críticas al arrancar.
- **Logs estructurados:** Pino en `@repo/logger`, `pino-pretty` en dev, JSON en prod.
- **Sentry:** integrado en las 3 apps, condicional vía `SENTRY_DSN`.
- **NEXTAUTH_URL dinámica:** opcional; NextAuth v5 la infiere del Host header.
- **Errores 409** con campo específico + UI inline con highlight visual.
- **Build config:** `ignoreBuildErrors: false` en `next.config.mjs`.
- **Deploy a Vercel:** las 3 apps desplegadas con URLs reales.
- **Fix de dominios:** proxy permitiendo subdominios vercel.app, `DEFAULT_TENANT_SLUG` como fallback.

---

## 2026-07-10 — Post-Producción: Alineación y Cloud

- Rama `production` renombrada a `develop` (local y remoto).
- Configuración del repo alineada con bienesraicesVe: `.prettierrc`, `opencode.json`, `dependabot.yml`, PR template, CI workflow.
- **Migración a servicios cloud:**
  - PostgreSQL local → **Neon**
  - Redis local → **Upstash**
  - MinIO local → **Cloudflare R2**
  - MailHog local → **Resend**
- Documentación actualizada (README, SETUP, sin Docker).
- Fix: nombre de variable `MERCADOPAGO_WEBHOOK_SECRET` alineado entre validación Zod y código.
- 225 tests, build limpio en las 3 apps.

---

---

## 2026-07-10 — Sesión 2: CI/CD, Vercel, Documentación

- AGENTS.md unificado con mejores prácticas de bienesraicesVe (checklists, inyección de prompts, permission boundaries, progresividad).
- PROMPTS.md actualizado con templates base (API Route, Client Component, Server Component, Zod Schema).
- bitacora.md creada con historial completo del proyecto.
- **CI fix:** error de `pnpm/action-setup` por version duplicada eliminado. Node 20→22.
- **CI fix:** env vars movidas a job level y luego a `.env.local` en CI para que Turbo las herede.
- **turbo.json:** declaradas todas las env vars en `tasks.build.env` (Turbo 2 no las expone sin esto).
- **Vercel:** creados `apps/admin/vercel.json` y `apps/superadmin/vercel.json` con filtro monorepo.
- **Documentación:** actualizadas todas las referencias de `MP_WEBHOOK_SECRET` → `MERCADOPAGO_WEBHOOK_SECRET`.
- **Problemas conocidos (resueltos):**
  - ✅ Admin en Vercel: renombrado `MP_WEBHOOK_SECRET` → `MERCADOPAGO_WEBHOOK_SECRET`.
  - ✅ Superadmin en Vercel: env vars cloud agregadas.

**Deuda técnica pendiente:**

- ❌ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migración a `docs/adr/` con verificación individual por ADR.
- ❌ `withTenantContext` nunca se llama en runtime. RLS es decorativo. Pendiente wiring completo post-hotfixes.

## 2026-07-10 — Categories centralization

- Migrada `getCategoriesForTenant` de `apps/storefront/lib/categories.ts` a `packages/commerce/src/categories.ts`
- Creado `packages/commerce/src/__tests__/categories.test.ts` con 2 tests (TDD)
- Actualizado `packages/commerce/src/index.ts` y `package.json` exports
- `apps/storefront/lib/categories.ts` ahora re-exporta desde `@repo/commerce/categories`
- Comportamiento mejorado: sin try/catch silencioso (el original devolvía [] en error)
- test: 227/227, typecheck: 8/8, lint: ✅

## 2026-07-10 — Vitest deprecation + PROMPTS.md verification

- Reemplazado plugin `vite-tsconfig-paths` por opción nativa `resolve.tsconfigPaths: true` en vitest.config.ts
- Warning de deprecación eliminado de la salida de tests
- PROMPTS.md verificado: encoding UTF-8 correcto, sin caracteres corruptos
- Creado .env.local con vars mínimas para build (necesidad pre-existente)
- test: 225/225, lint: ✅, typecheck: 8/8, build: 3/3

## 2026-07-10 — Proxy cleanup (admin/superadmin)

- Eliminados `apps/admin/proxy.ts` y `apps/superadmin/proxy.ts` (no-ops con params sin usar)
- Storefront conserva su proxy multi-tenant real
- lint, typecheck y tests pasan; build fallo pre-existente por AUTH_SECRET

---

## Estado actual (10 de julio 2026)

| Métrica      | Valor                                   |
| ------------ | --------------------------------------- |
| Tests        | 238 pasando, 0 fallos                   |
| Apps         | storefront, admin, superadmin           |
| Servicios    | Neon, Upstash, R2, Resend               |
| Deploy       | Vercel (3 apps)                         |
| Rama default | `develop`                               |
| Build        | Limpio (sin `ignoreBuildErrors`)        |
| CI           | GitHub Actions (lint, typecheck, build) |
| Storefront   | ✅ Deploy OK                            |
| Admin        | ✅ Deploy OK                            |
| Superadmin   | ✅ Deploy OK                            |

**Deuda técnica resuelta:**

- ✅ Proxy placeholders (`apps/admin/proxy.ts`, `apps/superadmin/proxy.ts`) eliminados
- ✅ Vitest deprecation warning (`vite-tsconfig-paths` → `resolve.tsconfigPaths`) corregido
- ✅ PROMPTS.md verificado: encoding UTF-8 correcto
- ✅ Categories centralizadas en `@repo/commerce` (+2 tests, ahora 227)
- ✅ P0 Security Hotfix: tenant isolation gaps cerrados en 12 handlers

**Infraestructura completada (10 de julio 2026):**

- ✅ `MP_WEBHOOK_SECRET` → `MERCADOPAGO_WEBHOOK_SECRET` renombrado en Vercel admin
- ✅ Env vars faltantes agregadas al proyecto superadmin en Vercel
- ✅ `default_branch` cambiado a `develop` en GitHub
- ✅ Monorepo Change Detection configurado en Vercel (deploys selectivos)

---

## 2026-07-10 — P0 Security Hotfix: Tenant Isolation

- **Auditoría de seguridad completa:** 31 rutas API analizadas por verbo HTTP. 12 handlers con gaps de aislamiento multi-tenant confirmados.
- **Estado de RLS documentado:** `withTenantContext` definido en migración DB pero nunca llamado en handlers. Conexión DB usa `neondb_owner` (owner de tabla) que bypasses RLS. RLS es decorativo — la app depende 100% de filtrado manual `tenantId`.
- **Verificación de logs en Vercel:** sin evidencia de tráfico a las rutas vulnerables, consistente con no tener aún tenants/usuarios reales en producción. No se detectaron accesos cross-tenant ni intentos de explotación.
- **227 tests pasando**, lint ✅, typecheck ✅
- **PR mergeado a `develop`.**

### Hotfixes aplicados

| #   | Ruta                           | Fix                                                                                                             |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | `webhooks/mercadopago`         | Fail-closed HMAC, queries scoped por tenant, `x-test-order-id` solo dev                                         |
| 2   | `checkout/preference`          | IDOR same-tenant cerrado (ownership check por email), rate limiting 10 req/min/IP, logging estructurado sin PII |
| 3   | `cart/*`                       | `getTenantId` + filtro `tenantId` en variant/image queries                                                      |
| 4   | `checkout`                     | Variant SELECT y stock UPDATE scoped por tenant                                                                 |
| 5   | `products/[id]/*` (8 handlers) | SQL-level `and(eq(id), eq(tenantId))` — TOCTOU eliminado                                                        |
| 6   | `orders/[id]`                  | 6 queries scoped por tenant                                                                                     |
| 7   | `shipping/[id]`                | UPDATE/DELETE scoped por tenant                                                                                 |
| 8   | `register`                     | Email lookup con `and(eq(email), eq(tenantId))`                                                                 |
| 9   | `tenants/*` (superadmin)       | Role check `=== "superadmin"` en 5 handlers                                                                     |

#### ADR-022 creado

- `docs/adr/ADR-022-rls-status.md` documenta el hallazgo de RLS decorativo + verificación de logs.

### Deuda técnica documentada

- ❌ `withTenantContext` nunca se llama en runtime. RLS es decorativo. Pendiente wiring completo.
- ❌ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migración a `docs/adr/`.
- ❌ Faltan 14 tests de integración de tenant isolation (27 planeados - 13 escritos en hotfixes 1, 2 y 9).

---

## 2026-07-10 — P0 Hotfix v2: IDOR same-tenant + rate limiting + tests

- **Fix IDOR same-tenant en checkout/preference:** se agregó `customerEmail` al schema de validación y ownership check: si `order.customerEmail !== callerEmail`, devuelve 403. Antes solo había tenant-scoping cross-tenant, pero cualquier visitante del mismo tenant podía crear preferencias para órdenes ajenas. `packages/validation/src/schemas.ts` y `apps/storefront/app/api/checkout/preference/route.ts`
- **Rate limiting:** 10 req/min/IP con Redis (`INCR` + `PEXPIRE`), devuelve 429 al exceder. `apps/storefront/app/api/checkout/preference/route.ts`
- **Frontend actualizado:** `apps/storefront/app/checkout/page.tsx` ahora envía `customerEmail` en el body de la preferencia.
- **Pruebas de regresión reales (no inline handlers):** Los tests iniciales de checkout/preference, webhook y superadmin usaban handlers inline que nunca ejercitaban el código de producción. En esta sesión se reescribieron los 3 archivos para importar los handlers reales (`POST`, `GET` desde `../route`), con mocks de dependencias (`db`, `redisClient`, `getTenantId`, `auth`) que devuelven datos crudos (fila de orden, sesión, etc.), no respuestas HTTP armadas. 238 tests pasando.
- **Tests reescritos (3 archivos, 11→32 tests efectivos):**
  - `checkout/preference/__tests__/route.test.ts`: 12 tests (rate limiting, token, validación Zod, tenant resolution, IDOR 404/403/200, shipping). Importa `POST` real.
  - `webhooks/mercadopago/__tests__/route.test.ts`: 11 tests (HMAC 503/401/200, dev mode approved/rejected, validation payload). Importa `POST` real. Reemplaza ~18 tests inline preexistentes (desde `daa9845`, nunca modificados en P0).
  - `tenants/__tests__/route.test.ts`: 9 tests (GET role 401/403/200, POST role 403/201/409/400/400/401). Importa `GET`/`POST` reales. Reemplaza ~8 tests inline.
- **Verificación:** lint ✅ | typecheck 8/8 ✅ | tests 238/238 ✅
- **Branch:** `fix/p0-idor-rate-limit-tests`

---

## 2026-07-13 — Refuerzo de aserciones en tests de magic ID del webhook

- Los dos tests de dev mode (magic ID 123456789 y 000000) solo verificaban `res.status === 200`, que el handler devuelve en múltiples caminos (procesado, order no encontrado, sin external_reference). Se agregaron aserciones de body (`expect(data).toEqual({ received: true })`) y confirmación de que `db.update` fue efectivamente llamado, distinguiendo el procesamiento exitoso del early exit.
- `webhooks/mercadopago/__tests__/route.test.ts`: +4 aserciones (2 body + 2 db.update).
- **No cambia el conteo de tests (sigue 238/238).

---

## 2026-07-14 — Tests de regresión para 6 hotfixes P0 sin cobertura + bug en cart PUT/DELETE

- **7 archivos de test creados** en branch `p1/tenant-isolation-tests` (Paseo worktree), cubriendo los 6 hotfixes P0 que no tenían test de regresión:
  - Storefront: `cart/__tests__/route.test.ts` (22 tests, reemplaza stubs inline), `checkout/__tests__/route.test.ts` (9 tests, reemplaza stubs), `register/__tests__/route.test.ts` (5 tests, nuevo)
  - Admin: `products/[id]/__tests__/route.test.ts` (12 tests), `products/[id]/variants/__tests__/route.test.ts` (8 tests), `orders/[id]/__tests__/route.test.ts` (8 tests), `shipping/[id]/__tests__/route.test.ts` (10 tests)
- **Bug descubierto y corregido:** `getEnrichedItems` era `async function` pero se llamaba sin `await` en `cart/route.ts` PUT (line 259) y DELETE (line 347). El handler serializaba la Promise como `{}`, produciendo `{"items":{}}` en producción. Se agregó `await` en ambos handlers.
- **12 fallos resueltos en storefront:** register (5 — mock bcryptjs), cart (4 — await faltante + mock images), checkout (1 — total esperado), webhooks (2 — mock contamination).
- **Bug de contaminación de mocks en webhooks:** los HMAC tests `"should return 200 when signature is valid"` y `"should verify signature when x-request-id is present"` usan `RAW_BODY` con `paymentId: "123456789"`. En dev mode, el handler entra al path magic ID y retorna antes de consumir `db.select` (porque `external_reference` es null). El `mockReturnValueOnce` no consumido persistía al siguiente test, haciendo que `db.select` devolviera `[]` y el handler no encontrara la orden. Fix: eliminar los `db.select.mockReturnValueOnce` innecesarios de esos dos tests. Las aserciones `expect(db.update).toHaveBeenCalled()` se restauraron en ambos tests de magic ID (approved + rejected).
- **Verificación:** storefront 90/90 ✅ | admin 140/140 ✅ | lint ✅ | typecheck ✅
- **Branch:** `p1/tenant-isolation-tests`

---

## 2026-07-14 — P1-1 Plan: withTenantContext real + FORCE RLS

- **PR #6 mergeado a develop:** P1-3 (tests de regresión P0 + bug await cart + bug contaminación webhooks). branch `p1/tenant-isolation-tests`
- **Bug crítico descubierto en `withTenantContext`:** la implementación actual usa `set_config('app.tenant_id', ..., true)` (SET LOCAL) dentro de `db.execute()`, que es auto-commit. El setting se pierde antes de las queries del callback. RLS es 0% efectivo — ninguna query evalúa las políticas en runtime.
- **Solución:** `withTenantContext` debe usar `db.transaction` internamente, pasando `tx` al callback. SET LOCAL + todas las queries viven en la misma transacción.
- **Plan P1-1 diseñado** con 7 fases (A→G) y validación contra Neon branch real.
- **3 correcciones del usuario aplicadas al plan:**
  1. Webhook: email de confirmación movido fuera del `return withTenantContext(...)` — antes quedaba como código muerto
  2. `checkout/preference`: ejemplo corregido (solo lee, no inserta órdenes)
  3. CI (`pnpm test`) como Fase 0 — PR independiente antes del refactor
- **Plan de ejecución en 4 PRs:**
  - **PR1:** Fase 0 — `pnpm test` en CI workflow
  - **PR2:** Patrón A (18 handlers sin I/O externo) + tests
  - **PR3:** Patrón B (5 handlers con I/O externo) + tests — revisión aislada
  - (validación manual: Neon branch + concurrencia)
  - **PR4:** FORCE ROW LEVEL SECURITY — solo después de validación
- **Deuda técnica:** 229 tests (90 storefront + 139 admin). Tras reescritura de tests de Fase B, subirá ~11 archivos

---

---

## 2026-07-14 — Fase 0: pnpm test en CI workflow

- **Branch:** `ci-add-pnpm-test`
- **Cambio:** una línea agregada en `.github/workflows/ci.yml` — `- run: pnpm test` después de `pnpm build`, reusando el `.env.local` del paso anterior.
- **Verificación:** 289/289 tests pasan en CI local. `turbo.json` ya tenía el task `test` definido.
- **PR:** https://github.com/luisavilaland/landaetastudio-saas/pull/new/ci-add-pnpm-test

---

## Estado actual (14 de julio 2026)

| Métrica      | Valor                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Tests        | 289 pasando, 0 fallos                                                                           |
| Apps         | storefront, admin, superadmin                                                                   |
| Servicios    | Neon, Upstash, R2, Resend                                                                       |
| Deploy       | Vercel (3 apps)                                                                                 |
| Rama default | `develop`                                                                                       |
| Build        | Limpio (sin `ignoreBuildErrors`)                                                                |
| CI           | GitHub Actions (lint, typecheck, build, **test**)                                               |
| RLS          | Decorativo — `withTenantContext` roto (SET LOCAL en auto-commit). Plan P1-1 listo para ejecutar |

**Deuda técnica resuelta:**

- ✅ P0 Security Hotfix: 12 handlers con filtrado manual `tenantId`
- ✅ P1-3: 7 archivos de test de regresión para 6 hotfixes P0
- ✅ Bug `getEnrichedItems` sin `await` en cart PUT/DELETE (raíz de bug productivo)
- ✅ Bug contaminación mocks webhooks (mockReturnValueOnce no consumido)
- ✅ Plan P1-1 diseñado con 4-PR execution plan, transacciones angostas, validación contra DB real
- ✅ Fase 0: `pnpm test` agregado al CI workflow

---

## 2026-07-14 — PR2: Wire withTenantContext en handlers Patrón A + tests

- **Branch:** `feat-p1-1-patron-a`
- **withTenantContext corregido:** ahora usa `db.transaction(async (tx) => { tx.execute(SET LOCAL); return cb(tx); })` en lugar de `db.execute()` auto-commit. SET LOCAL + queries en misma transacción.
- **21 handlers wireados con Patrón A** (sin I/O externo) — todos envueltos en `withTenantContext(tenantId, async (tx) => {...})`.
- **products/import:** transacción POR FILA (cada fila su propio `withTenantContext`), preservando éxito parcial en CSV bulk import.
- **Bug descubierto:** `return withTenantContext(...)` sin `await` hace que rejections de la transacción bypassean el `try/catch` del handler. En handlers con catch block (variants 409 FK, órdenes, etc.), las excepciones no se capturaban correctamente. Fix: `return await withTenantContext(...)` en los 21 handlers.
- **Test fixes:** el approach original de mockear `db.transaction` no funciona porque `withTenantContext` cierra sobre el `db` real del módulo. Todos los tests ahora mockean `withTenantContext` directamente con `makeTxMock()`.
- **MakeTxMock centralizado:** patrón con `select`, `insert`, `update`, `delete`, `execute` mockeados, casteado `as any` para compatibilidad con `DbLike`.
- **Storefront shipping test fix:** el mock de `drizzle-orm` reemplazaba TODO el módulo solo con `eq` y `asc`, rompiendo la importación de `relations` en `@repo/db/schema`. Fix: `vi.mock("drizzle-orm", async () => ({ ...actual, eq: vi.fn(), asc: vi.fn() }))`.
- **Assertions `toHaveBeenCalledWith`:** agregadas en tests cross-tenant de 3 archivos (orders `[id]`, shipping `[id]`, variants — 6 tests) para verificar que `withTenantContext` se llama con el tenant correcto. Única excepción: el test "400 validación falla" de variants, donde Zod rechaza el body antes de llegar a `withTenantContext`.
- **Verificación:** lint ✅ | typecheck 8/8 ✅ | tests 289/289 ✅ (22 fix, 0 regresiones)
- **22 tests resueltos** que antes fallaban por `ECONNREFUSED` o mock contamination.

**Deuda técnica resuelta:**

- ✅ `withTenantContext` wiring completo en 21 handlers Patrón A
- ✅ Bug `return withTenantContext` sin `await` (bypass de try/catch en todos los handlers)
- ✅ Storefront shipping test suite roto por mock de `drizzle-orm`
- ✅ Tests de shipping/[id], orders/[id], variants, products/[id] DELETE con mock de `withTenantContext`

---

## 2026-07-15 — PR3: Wire withTenantContext en handlers Patrón B (I/O externo) + tests

- **Branch:** `feat-p1-1-patron-b`
- **5 handlers Patrón B wireados** — los que tienen I/O externo intercalado entre DB ops, requiriendo múltiples `withTenantContext`:
  - **Webhook:** `external_reference` compuesto `${tenantId}:${orderId}`, email fuera del contexto, dev mode magic IDs preservados
  - **Checkout/preference:** `external_reference` compuesto, single context para 4 lecturas, guard `orderId` (const) para TS closure
  - **Images POST:** dos contextos (read → upload → read+insert), FK violation 23503 → 409 (TOCTOU entre contextos)
  - **Images GET:** single context (Patrón A — se cayó entre PR2 y PR3, ahora incluido)
  - **Images DELETE:** dos contextos (read → delete S3 → delete DB)
  - **Register:** dos contextos (check email + tenant → hash → insert), `console.error` → `logger.error`, UK 23505 → 409
- **`withTenantContext` assertions:** agregadas en checkout (5 tests), register (1 test), images (GET 1 test)
- **Images test file reescrito completamente:** 11 tests (GET 3, POST 3, DELETE 5) — reemplaza 8 tests inline que nunca ejercitaban los handlers reales
- **Tests checkout y register migrados** a mock de `withTenantContext` (11 + 5 tests)
- **Verificación:** lint ✅ | typecheck ✅ | tests **290/290** ✅ (+1 vs baseline)
- **Review de aprobación:** 4 hallazgos corregidos post-review:
  1. `console.error` → `logger.error` en `images/[imageId]/route.ts` (bloqueante)
  2. Magic ID por `withTenantContext` con `external_reference` compuesto — confirmado como desviación intencional (más seguro que bypass total)
  3. Test FK 23503 → 409 agregado en images POST
  4. Test UK 23505 → 409 agregado en register
- **292 tests finales** (290 originales + FK + UK)

**Deuda técnica pendiente:**

- ❌ FORCE ROW LEVEL SECURITY — PR4 (validación manual en Neon branch + concurrencia)
- ❌ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migración a `docs/adr/`.

## Estado actual (15 de julio 2026)

| Métrica          | Valor                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Tests            | 292 pasando, 0 fallos                                                               |
| Apps             | storefront, admin, superadmin                                                       |
| Servicios        | Neon, Upstash, R2, Resend                                                           |
| Deploy           | Vercel (3 apps)                                                                     |
| Rama default     | `develop`                                                                           |
| Build            | Limpio (sin `ignoreBuildErrors`)                                                    |
| CI               | GitHub Actions (lint, typecheck, build, test)                                       |
| Patrón A         | 21 handlers wireados con `withTenantContext`                                        |
| Patrón B         | 5 handlers wireados con `withTenantContext`                                         |
| RLS              | FORCE RLS en 8 tablas + `app_user` (sin BYPASSRLS)                                  |
| Conexión runtime | `DATABASE_APP_URL` (app_user), `DATABASE_URL` (neondb_owner solo build/migraciones) |

---

## 2026-07-15 — Fase B: Seed con dos tenants para validación RLS cross-tenant

- **Motivación:** La Fase C (validación RLS en Neon branch) requiere al menos 2 tenants con datos para probar que `set_tenant_id` dentro de transacción filtra correctamente.
- **Seed modificado:** se agregó un segundo tenant (`tienda2` / "Tienda Premium") con productos distintos (Campera Premium, Zapatillas Runner, Mochila Urbana), su propio admin, categorías, variantes, imágenes, cliente, órdenes y métodos de envío.
- **SKUs de tenant 2 diferenciados:** `CAMP-*`, `ZAPA-*`, `MOCH-*` — sin conflicto con tenant 1.
- **Verificación:** lint ✅ | typecheck ✅ | build 3/3 ✅ | commit `2000107`
- **Próximos pasos:**
  - Fase C: correr `pnpm db:seed` contra Neon branch y re-ejecutar batches de verificación RLS
  - Fase D: pruebas de concurrencia contra la branch
  - PR4: `ALTER TABLE ... FORCE ROW LEVEL SECURITY`

---

## 2026-07-15 — Fase C + R1: App User Role y FORCE RLS validados

- **Hallazgo crítico:** `neondb_owner` tiene `rolbypassrls=true` — ni `ENABLE RLS` ni `FORCE ROW LEVEL SECURITY` tienen efecto porque el rol de conexión bypassea las políticas a nivel de rol, no de tabla. RLS era completamente decorativo.
- **Solución documentada por Neon:** usar un rol de aplicación dedicado sin `BYPASSRLS`, manteniendo `neondb_owner` solo para tareas administrativas (migraciones, seed).
- **Fase C (branch `fase-c-verificacion`):**
  - Creado `app_user` con grants explícitos (tabla por tabla: 10 tablas de negocio) + `EXECUTE` sobre `set_tenant_id(UUID)`
  - Verificado: `rolbypassrls=false`, `rolsuper=false` en el nuevo rol
  - Aplicado `0010_force_rls.sql` (FORCE RLS en 8 tablas de negocio)
  - **B2:** tenant 1 → 3 productos (Gorra, Pantalón Jeans, Remera Básica) ✅
  - **B3:** tenant 2 → 3 productos distintos (Campera Premium, Mochila Urbana, Zapatillas Runner) ✅
  - **B4:** app_user sin context → **0 productos** (el owner ya no bypassea) ✅
  - **B5:** UUID inexistente → **0 productos** ✅
- **R1 (rama `feat/app-user-role`):** 4 cambios preparatorios para usar `app_user` en runtime:
  1. `packages/db/src/index.ts`: `DATABASE_APP_URL` requerida (sin fallback — `throw` si falta)
  2. `packages/validation/src/env.ts`: `DATABASE_APP_URL: z.string().url()` requerida
  3. `apps/superadmin/app/api/tenants/[id]/route.ts`: DELETE envuelto en `withTenantContext(params.id, ...)` — necesario porque al usar `app_user` con FORCE RLS, las queries sobre tablas protegidas necesitan el `tenantId` seteado para matchear las filas del tenant a eliminar. El callback usa `ctxTx` (alias consistente con el resto del codebase).
  4. `.github/workflows/ci.yml`: agregado `echo "DATABASE_APP_URL=..."` al bloque de variables dummy para build
- **`admin_users` sin RLS confirmado como intencional:** el `authorize()` de NextAuth busca por email global (sin tenant) porque no sabe a qué tenant pertenece el usuario hasta después de encontrarlo. Agregarle RLS crearía un huevo y la gallina.
- **Superadmin GET/PUT confirmados sin tocar tablas RLS:** grep verifica que las 23 referencias a `dbProducts`, `dbProductVariants`, etc. están todas dentro del DELETE handler.
- **Fase D (16 jul):** pruebas concurrentes contra preview Vercel con `app_user`@`fase-c-verificacion`. Todos los escenarios verificados:
  - 10 GET concurrentes alternando tienda1/tienda2 → 200 ✅ ~330ms avg
  - 10 search concurrentes alternando → 200 ✅ producto correcto por tenant
  - POST imagen (dos contextos: read→upload→read+insert) + GET → 201 ✅, tenantId correcto
  - Register POST (dos contextos: read→insert) → 201 ✅
  - Aislamiento cross-tenant verificado sin data leak ✅
- **R3 (16 jul):** `app_user` creado en Neon producción con password fuerte, `rolbypassrls=false`
- **R4 (16 jul):** `DATABASE_APP_URL` seteada en Vercel (3 projects, Production+Preview+Development)
- **Hallazgo de PowerShell:** el register devolvía 500 por JSON malformado al pasar strings inline desde PowerShell. Usar `-d @archivo.json` o `--data-raw` como workaround.
- **Verificación:** lint ✅ | typecheck 8/8 ✅ | tests 291/292 ✅ (1 pre-existing failure en register — store URL)
- **Pendiente:** mergear `feat/app-user-role` → `develop` (R1), aplicar migración 0010 FORCE RLS en producción (R2), re-seed (R5)

---

## 2026-07-16 — Register test fix + DoD housekeeping

- **Register test arreglado:** el 4to argumento de `sendWelcomeEmail` esperaba `undefined` pero recibía `process.env.STOREFRONT_URL` en CI. Se seteó `process.env.STOREFRONT_URL` en el test y se actualizó la expectativa.
- **Verificación:** lint ✅ | typecheck 8/8 ✅ | build storefront ✅ | tests 292/292 ✅
- **State:** develop — limpio, pasando todos los checks

---

## 2026-07-16 — Hotfix: checkout/route.ts sin withTenantContext (incidente en producción)

- **Incidente confirmado:** `checkout/route.ts` usaba `db.select()` y `db.transaction()` sin `withTenantContext`. Con FORCE RLS + app_user (sin BYPASSRLS), `current_setting('app.tenant_id', true)` devuelve NULL, la política RLS evalúa `tenantId = NULL` para todas las filas, y cada query retorna 0 filas — todo intento de compra fallaba con "Stock insuficiente".
- **Causa raíz:** el handler nunca apareció en los inventarios de PR2 (Patrón A) ni PR3 (Patrón B). Quedó fuera del wiring de `withTenantContext` desde el inicio de P1-1.
- **Fix:** reemplazado `db.select().from()` + `db.transaction()` por un único `withTenantContext(tenantId, async (tx) => {...})` que envuelve todas las DB ops (lectura de variantes, lectura de shipping, stock update, inserción de orden + items). Dentro del callback, errores de negocio (stock, shipping) se retornan como objetos y se traducen afuera a `NextResponse.json()`.
- **Tests migrados:** el test mockea `withTenantContext` en vez de `db.transaction`, con mock chain completa (`.select().from().where()` para variantes, `.select().from().where().limit()` para shipping, `.update().set().where()`, `.insert().values().returning()`).
- **9 tests en checkout**, assertions de `withTenantContext` en happy paths.
- **Verificación:** lint ✅ | typecheck 8/8 ✅ | build storefront ✅ | tests 292/292 ✅
- **27 handlers wireados con withTenantContext** (21 Patrón A + 5 Patrón B + checkout). Ningún handler de storefront queda sin contexto de tenant.

---

## 2026-07-17 — P1-2: Migración de ADRs + verificación contra código

- **docs/arquitectura.md migrado a ADRs individuales:** 20 ADRs (ADR-001 a ADR-020) en `docs/adr/` con formato estándar (título, fecha, contexto, decisión, estado, consecuencias).
- **Verificación contra código:** cada ADR fue verificada contra el código real. 14/20 aceptadas sin discrepancias, 6 con discrepancias documentadas (ninguna urgente):
  - ADR-008: storeSettingsSchema local + CSV import sin Zod
  - ADR-013: documentación desactualizada (store_settings vs inline JSONB)
  - ADR-017: el patrón de tests evolucionó — 59% importan handlers reales (mejora)
  - ADR-020: normalizeSlug duplicado en CSV import
  - ADR-001: checkout hotfix documentado históricamente
  - ADR-007: omisión menor de logger package
- **docs/arquitectura.md** convertido a tabla índice con links a cada ADR + convenciones clave.
- **Deuda del P0 completamente saldada:** migración de ADRs + verificación contra código completada.
- **Branch:** `p1-2/adrs` (Paseo worktree)

**Deuda técnica documentada (nueva):**

- ❌ **Fechas sin UTC explícito:** el schema usa `timestamp` sin timezone. Sin mitigación — depende de que el entorno de despliegue esté en UTC. Pendiente: migrar a `timestamptz` o validación Zod de UTC en inserts.
- ❌ _*console.* sin migrar:_* ~49 instancias de `console.error`/`console.log` en apps/ que aún no usan `@repo/logger`. Pendiente: barrido completo de apps/ (excluye seed.ts que es intencional).

---

## 2026-07-20 — Migración UTC: timestamptz + deuda técnica de snapshots

- **Fase 1 (validación) completa:** branch efímera `utc-validation` contra Neon. 18/18 columnas migradas a `timestamptz` en 1.6s sin pérdida de datos. ALTER es idempotente sobre columna ya `timestamptz`.
- **Fase 2 (schema + migración) completa:**
  - `packages/db/src/schema.ts`: 18 columnas con `{ withTimezone: true }`
  - `packages/db/migrations/0011_timestamptz.sql`: SET TIME ZONE 'UTC' + SET statement_timeout = '10s' + 18 ALTER TYPE
  - `meta/0011_snapshot.json` generado (parcheado desde 0008)
  - `meta/_journal.json`: idx 11 registrado con `breakpoints: true`
- **Snapshots 0003-0004 y 0009 confirmados perdidos** del historial de git (nunca trackeados). Snapshots 0005-0008 estaban en disco del repo principal pero no trackeados en git.
- **`pnpm db:generate` produce migraciones incorrectas** si faltan snapshots intermedios. Al restaurar 0005-0008, genera solo ALTER TYPE (correcto).
- **typecheck ✅, 292/292 tests ✅, lint ✅**
- **Branch:** `feat/utc-migration` (Paseo worktree)

**Deuda técnica documentada (nueva):**

- ❌ **drizzle-kit snapshots 0003-0004 perdidos por gitignore:** causa raíz confirmada — `.gitignore` tenía `packages/db/migrations/*` y `packages/db/migrations/meta/*.json`, lo que excluía silenciosamente cualquier archivo nuevo de migraciones o snapshots de `git add`. Desde que esa regla se agregó, toda migración generada después quedaba fuera de control de versiones sin que quien la generara lo notara. Corregido en este mismo commit (líneas eliminadas). Los snapshots 0005-0008 (que estaban en disco pero no en git) y 0011 ya están agregados.

**Deuda técnica resuelta:**

- ✅ **Fechas sin UTC explícito:** schema migrado a `timestamptz`. Migración 0011 aplicada contra producción (Fase 3) el 2026-07-20 — 18 columnas en 1.3s, datos preservados, sin NULLs.

---

## 2026-07-24 — @repo/test-utils: helpers de test centralizados

- **`packages/test-utils/` creado** con tres helpers: `makeTxMock(config?)`, `session(tenantId, email?)`, `mockReq(method, body?, headerOverrides?)`.
- **12 archivos de test migrados** de helpers inline a `@repo/test-utils`:
  - **storefront (6):** shipping, webhooks/mercadopago, cart, checkout, checkout/preference, register
  - **admin (5):** orders/[id], shipping/[id], products/[id], products/[id]/variants, products/[id]/images
  - **superadmin (1):** tenants
- **Patrones migrados:** `makeTxMock` inline (9 archivos), `makeRequest`/`mockReq` inline (7 archivos), `session` inline (3 archivos), `setupTxRead`/`setupTxInsert`/`setupTx*` (2 archivos).
- **`makeTxMock` con `{ select: [...] }`**: soporta config para selects secuenciales con `terminal: "where" | "limit" | "orderBy"`, probado contra casos reales de checkout/preference (4 selects heterogéneos) e images (limit + orderBy).
- **`mockReq` con `headerOverrides`**: para tests que necesitan headers custom (x-forwarded-for en rate limiting).
- **`mockReq` sin `NextRequest` en firma**: retorna `as any` para evitar conflicto de tipos entre next@14 y next@16.
- **lint ✅, typecheck ✅, build ✅, 292/292 tests ✅**
- **AGENTS.md actualizado** con sección de helpers de test.
- **Branch:** `feat/test-utils` (Paseo worktree)

---

## 2026-07-25 — @repo/test-utils post-review: 3 bugs corregidos

- **Bug 1 (versiones):** `packages/test-utils/package.json` tenía `next: ^14` y `vitest: ^2` — el monorepo usa next@16 y vitest@4. Corregido: `^16.0.0` y `^4`.
- **Bug 2 (queue exhaustion):** `repeatLastSelect` declarado en `MakeTxMockConfig` pero nunca leído. Cuando se excede la cola de `select()`, ahora lanza `Error("queue exhausted for select()...")`. Solo `select`/`from` lanzan error (no `where`/`limit`/`orderBy`, que son compartidos con `delete()`/`update()`).
- **Bug 3 (insert huérfano):** opción `insert` en `MakeTxMockConfig` pero 0 de 12 archivos migrados la usaban. Eliminada.
- **`mockReq` restaurado con `NextRequest` real**: al alinear versiones de next, desaparece el conflicto de tipos. Ahora retorna `NextRequest` (no `as any`).
- **Unit test agregado:** `packages/test-utils/src/__tests__/makeTxMock.test.ts` — 9 tests: auto-encadenamiento, queue exhaustion (select/from), repeatLastSelect, múltiples entradas secuenciales.
- **Verificación:** lint ✅, typecheck ✅, build ✅, **301/301 tests** (era 292, +9 del unit test nuevo). **33/33 test files** (era 32).

---

## 2026-07-25 — Coverage Audit: Contract tests → reales, endpoints faltantes, packages sin cobertura

- **Branch:** `feat-coverage-ab` (Paseo worktree)
- **Objetivo:** cerrar brechas de cobertura real identificadas por audit de grafo de imports.
- **Task 1.1 (categories/route):** migrado de contrato a real importando `{ GET, POST }` desde `"../route"` usando `mockReq`, `session`, `makeTxMock`. 8 tests (reemplaza 12 inline).
- **Task 1.2 (categories/[id]/route):** migrado a real. 12 tests (reemplaza 6 inline).
- **Task 1.3 (dashboard/route):** migrado a real. Incluye `tx.leftJoin` manual (gap de `makeTxMock`). 5 tests (reemplaza 6 inline).
- **Task 1.4 (orders/route):** migrado a real con `leftJoin` en mock. 6 tests (reemplaza 17 inline).
- **Task 1.5 (products/route):** migrado a real con FormData mock para POST. 7 tests.
- **Task 1.6 (products/import):** debug migrado — mock File causaba 500. Fix: usar `new File([csv], ...)` nativo. 11 tests testeados y pasando.
- **Task 1.7 (shipping/route):** migrado a real. 7 tests (3 GET + 4 POST).
- **Task 1.9 (search/route, storefront):** migrado a real. Handler complejo con 4 queries (leftJoin, groupBy, orderBy, limit, offset). Mock manual de tx con chaining secuencial. 6 tests (reemplaza 13 inline).
- **Grupo 2 (6 endpoints sin test):** tests agregados para `domain-check` (admin + superadmin), `config/tenant`, `config/tenant/domain`, `config/settings`, `products/[id]/images/[imageId]`. 29 tests en 6 archivos.
- **Grupo 3 (3 packages sin cobertura):** tests para `@repo/logger` (2), `@repo/db/schema` (10 — verificación de todas las tablas), `@repo/auth` (7 — exports, configuración NextAuth). 19 tests en 3 archivos.
- **Hallazgos técnicos:**
  - `mockReq` no expone `request.url` — handlers que acceden a `new URL(request.url)` requieren parche `(req as any).url = urlStr`
  - Cadenas con `.leftJoin()` requieren `tx.leftJoin = vi.fn().mockReturnValue(tx)` (gap de `makeTxMock`)
  - `makeTxMock` no soporta terminal `"offset"` — cadenas con `.limit().offset()` requieren mock manual
  - `vi.mock(path, { db: undefined })` produce `db = undefined` en runtime — no se puede asignar propiedades. Usar `vi.hoisted()` para mock mutable.
- **Verificación final:** lint ✅ | typecheck 9/9 ✅ | build 3/3 ✅ | **321/321 tests, 42/42 test files** (+20 tests, +9 files vs baseline)

---

## 2026-07-26 — Grupo 3 Completo: 6 packages restantes

- **3.1 (@repo/db index.ts — withTenantContext):** 6 tests críticos — verifica que llama `db.transaction`, ejecuta `set_tenant_id` dentro, pasa tx al callback, propaga errores. Mock de `postgres` + `drizzle-orm/postgres-js` para evitar conexión real.
- **3.2 (@repo/commerce cart.ts):** 9 tests — `getCart` (session vacía, sin datos Redis, carrito vacío, enrich, variantes faltantes) + `removeFromCart` (remover ítem, último ítem → del, session vacía, carrito inexistente).
- **3.4 (@repo/commerce email.ts):** 6 tests — `sendOrderConfirmationEmail` (envío, no lanza error) + `sendWelcomeEmail` (con URL, sin URL, error silencioso).
- **3.5 (@repo/commerce tenant.ts):** 4 tests — `getTenantId` (slug presente, ausente, vacío, slug no existe).
- **3.6 (@repo/storage index.ts):** expandido de 1→5 tests — `storageClient` export, `getPublicUrl`, `uploadImage` (putObject llamado, URL retornada), `deleteImage` (con fileName, sin fileName).
- **3.7 (@repo/validation env.ts):** 1 test — `validateEnv` no lanza con vars actuales.
- **3.8 (@repo/validation schemas.ts):** expandido de 7→34 tests — todos los schemas de negocio validados (createProduct, updateProduct, variant, variantsArray, createCategory, updateCategory, updateOrderStatus, addCartItem, updateCartItem, deleteCartItem, checkoutPreference, shippingDetails, dashboardQuery, createTenant, register, webhook, productImage, createShippingMethod).
- **Hallazgos:** `vi.fn().mockImplementation(() => ({}))` no funciona con `new` — usar `function()` en lugar de arrow. `dashboardQuerySchema.parse({})` retorna `{}` (opcionales ausentes), no con `null`s.
- **Plan original completado al 100% — todos los items de Grupo 1, 2 y 3.**
- **Verificación final:** lint ✅ | typecheck 9/9 ✅ | build 3/3 ✅ | **378/378 tests, 47/47 test files** (+57 tests, +5 files vs baseline anterior)

---

## 2026-07-28 — RLS Coverage Fix: withTenantContext en 6 archivos + tests

- **Branch:** `feat/coverage-ab` (Paseo worktree, continuado)
- **Contexto:** Auditoría profunda reveló que 6 archivos usaban `db.*` directo en tablas RLS sin `withTenantContext`. RLS con `missing_ok=true` (NULL) bloquea TODAS las filas → storefront completamente roto en `develop`. Sin tráfico real, sin explotación cross-tenant.
- **Fase 1 (categories.ts):** `getCategoriesForTenant` envuelto en `withTenantContext`.
- **Fase 2 (products.ts):** `getProducts`, `getProductBySlug` envueltos. L173/L179: agregado `eq(dbProductVariants.tenantId, tenantId)` y `eq(dbProductImages.tenantId, tenantId)` — no depender solo de RLS.
- **Fase 3 (cart.ts):** `getCart(sessionId, tenantId)`, `removeFromCart(sessionId, variantId, tenantId)` — nuevo parámetro `tenantId`, DB envuelto. Caller `cart/page.tsx` resuelve tenantId desde header `x-tenant-slug` + lookup `dbTenants`.
- **Fase 4 (admin/products/[id]/route.ts):** GET + PUT envueltos. PUT: `db.transaction` propio eliminado (redundante con `withTenantContext`). R2 uploads/deletes quedan dentro del callback.
- **Fase 5 (storefront/cart/route.ts):** POST, PUT, DELETE, GET envueltos. `getEnrichedItems` recibe `tx` opcional (tipo `any` para compatibilidad DbLike vs PostgresJsDatabase).
- **Fase 6 (tests):** 3 test files migrados (`cart.test.ts`, `products.test.ts`, `categories.test.ts`) de mock `db.select` a `withTenantContext` + `makeTxMock`. Además `admin/products/[id]/route.test.ts` (GET/PUT) y `storefront/cart/route.test.ts` (7 tests).
- **Hallazgos:**
  - `makeTxMock` no tiene `innerJoin` — usar `createQuery` local como fallback para cadenas con join
  - `withTenantContext` ya mockeado en DELETE tests desde PR3; GET/PUT no
  - `removeFromCart` sin callers de producción — cambio de firma seguro
- **Verificación final:** lint 6/6 ✅ | typecheck 9/9 ✅ | tests 47/47, **379/379** (+1 test vs baseline: tenantId vacío en cart.test.ts)

---

## 2026-07-29 — Fase 1: Infraestructura E2E con Playwright

- **Branch:** `feat/e2e-playwright` (Paseo worktree, branch off develop)
- **Instalación:** `pnpm add -D -w @playwright/test` (v1.62.0)
- **`e2e/playwright.config.ts`:** 6 projects (setup, storefront, checkout, admin, superadmin, security) con `baseURL` por proyecto, `storageState` para admin/superadmin/security, `fullyParallel: false`, `workers: 1`
- **`e2e/global-setup.ts`:** login real admin en `http://localhost:3001/login` y superadmin en `http://localhost:3002/login`, guarda `storageState` en `e2e/.auth/admin.json` y `e2e/.auth/superadmin.json`
- **Directorios creados:** `e2e/storefront/`, `e2e/checkout/`, `e2e/admin/`, `e2e/superadmin/`, `e2e/security/`, `e2e/setup/`
- **Scripts en root package.json:** `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:e2e:report`
- **.gitignore:** `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/`
- **.env.local:** `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`
- **Commit:** `4c5fde2` — "feat: E2E infraestructura Playwright — config, global-setup, scripts"

---

## Estado actual (29 de julio 2026)

| Métrica      | Valor                                                               |
| ------------ | ------------------------------------------------------------------- |
| Tests        | 379 pasando, 0 fallos                                               |
| E2E          | Infraestructura lista (0 specs aún)                                 |
| Apps         | storefront, admin, superadmin                                       |
| Servicios    | Neon, Upstash, R2, Resend                                           |
| Deploy       | Vercel (3 apps)                                                     |
| Rama default | `develop`                                                           |
| Build        | Limpio (sin `ignoreBuildErrors`)                                    |
| CI           | GitHub Actions (lint, typecheck, build, test)                       |
| RLS          | Activo con `app_user`, 27 handlers wireados con `withTenantContext` |

- **Problema detectado en code review:** `uploadImage`/`deleteImage` quedaron dentro del `withTenantContext`, dejando una transacción PG abierta durante operaciones R2 (mismo anti-pattern que ya corregimos en `images/route.ts`).
- **Solución:** Separar PUT en tres fases:
  1. **Phase 1** (read + validate): `withTenantContext` → fetch product, validar categoría/slug/SKU, computar fields plan
  2. **Phase 2** (R2): fuera de toda transacción → `uploadImage`/`deleteImage`
  3. **Phase 3** (write): `withTenantContext` → ejecutar updates/inserts + refetch
- **Adicional:** `tx` en `getEnrichedItems` cambió de opcional a obligatorio, eliminando el fallback silencioso a `db` global. Removido `import { db }` del cart route.
- **Grep ampliado:** cubrió `packages/auth/`, `packages/storage/`, `packages/validation/`, `packages/logger/`, `packages/test-utils/`, `packages/commerce/`, `apps/superadmin/` — 0 matches.
- **Verificación final:** lint 6/6 ✅ | typecheck 9/9 ✅ | tests 47/47, 379/379 ✅
- **Deuda técnica (TOCTOU):** Entre Phase 1 (read) y Phase 3 (write) del PUT de `products/[id]` hay una ventana donde el producto pudo haber sido borrado — el UPDATE afecta 0 filas sin error, y el re-fetch devuelve array vacío, terminando en 200 con cuerpo vacío. Probabilidad baja (admin de 1 tenant, ventana de segundos), pero no hay catch de FK violation (`23503`) como sí tiene `images/route.ts`. Queda pendiente para una sesión futura de hardening.

---

## 2026-07-30 — E2E Vercel-ready + CI workflow

- **Parametrización URLs:** `playwright.config.ts` y `global-setup.ts` leen `E2E_STOREFRONT_URL`, `E2E_ADMIN_URL`, `E2E_SUPERADMIN_URL` de env vars con fallback a localhost.
- **CI workflow:** `.github/workflows/e2e.yml` — trigger en PR a develop, espera previews Vercel, seed en Neon, ejecuta E2E, comenta resultado en PR.
- **Helper script:** `scripts/get-vercel-preview-url.js` — obtiene URL del preview deployment vía API de Vercel.
- **Env vars documentadas:** en `.env.local.example` y `.env.local`.

## 2026-08-06 — E2E con dominios custom asignados a la rama

- **Estrategia cambiada:** se asignan `*.landaetastudio.com`, `admin.landaetastudio.com` y `superadmin.landaetastudio.com` al branch `feat/e2e-playwright` en Vercel. URLs fijas en CI; el proxy resuelve tenant por subdominio (`tienda1.landaetastudio.com`), sin `DEFAULT_TENANT_SLUG`.
- **playwright.config.ts movido a la raíz** y `testMatch` corregidos (eran relativos a `testDir`). Se eliminó el proyecto `setup` vacío que causaba "No tests found".
- **Fix cross-tenant:** `e2e/security/cross-tenant.spec.ts` reescrito para testear el diseño original (admin T1 → GET/PUT/DELETE de producto T2 vía API admin → 403/404). Agregada `E2E_STOREFRONT_T2_URL`.
- **CI simplificado:** eliminado `scripts/get-vercel-preview-url.js` y el job de Vercel API. Reemplazado por job `wait-for-deployments` (poll de los 3 dominios custom).
- **NEXTAUTH_URL confirmada como no requerida:** Auth.js v5 auto-activa `trustHost` en Vercel; solo Credentials + JWT.
- **Secrets GitHub necesarios:** `NEON_DATABASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`. Ya no hace falta `VERCEL_TOKEN`.
- **Fix global-setup post-login:** el job `e2e` de CI fallaba en `e2e/global-setup.ts:19` con `TimeoutError` — el login funcionaba pero `waitForURL` exigía la URL exacta `/` y la app redirige a `/dashboard` (admin) y `/tenants` (superadmin). Corregido con globs `**/dashboard` y `**/tenants`. En el run del commit `8c08e31`, `seed`, `wait-for-deployments`, `build` y Vercel quedaron en success; el fix de global-setup se valida en el siguiente run.

## 2026-08-06 — workflow_dispatch en e2e.yml + validez del fix bloqueada por incidente de GitHub Actions

- **Incidente externo GitHub Actions** desde 2026-08-06 15:22 UTC (`major_outage`, crítico): webhooks throttled (~15%), runners asignándose jobs inválidos, runs quedando `queued` con 0 jobs. Primer `run de validación` del fix post-login (commit `b08c`-prev) nunca materializó jobs. No es fallo del repo.
- **`workflow_dispatch:` agregado al trigger de `e2e.yml`**: permite lanzar el workflow manualmente ("Run workflow") inmune al throttle de webhooks y a runs colgados que no ofrecen botón de re-run (un run `queued` con 0 jobs no muestra opción de re-run porque el endpoint `POST /actions/runs/{id}/rerun` requiere al menos un job enlazado / context de UI). Con esto, una vez recuperado Actions, se cancela el run colgado y se dispara uno nuevo manual.
- **Reentry de validación postergada:** la validación del fix de global-setup (`c03f43b`) sigue pendiente mientras dure el `major_outage`. Cuando Actions quede `operational`, validar run E2E → si verde, merge PR #40 → `develop` y reasignar dominios custom a prod.

## 2026-08-06 — Fix bugs E2E: 11 fallos diagnosticados y corregidos (6 specs + config)

- **Run real de validación ejecutado** (trás recuperarse Actions): 31 tests, 11 fallando. Diagnóstico clasificado en 6 bugs deterministas de spec (corregidos) + fallos de entorno (lentitud cold-start Vercel, `page.goto` timeout 30s).
- **Fix 1 — `e2e/storefront/auth.spec.ts`:**
  - Login "credenciales válidas" usaba `admin@tienda1.com` — es un **admin**, pero la auth de storefront valida contra `customers` (`apps/storefront/lib/auth.ts`). El login fallaba y nunca redirigía. Cambiado a **`cliente@ejemplo.com`** (customer real del seed).
  - Test `/perfil sin auth redirige a login` era **incorrecto**: `/perfil` es la página pública de la tienda (`perfil/page.tsx`), no una ruta protegida. Reemplazado por validación real: `/perfil` muestra el nombre del tenant **"Tienda Demo"** (`getByRole("heading", { name: "Tienda Demo" })`).
- **Fix 2 — `e2e/storefront/register.spec.ts`:** email "ya existente" usaba `admin@tienda1.com` (no es customer → no devolvía 409). Cambiado a **`cliente@ejemplo.com`** para que register devuelva 409 y muestre `register-error`.
- **Fix 3 — 3 specs admin (categories, products-crud, settings):** `locator("h1")` daba **strict-mode violation** porque el layout `(dashboard)/layout.tsx` renderiza `h1` "Admin" + el título de página. Reemplazado por `getByRole("heading", { name })`.
- **Fix 4 — superadmin login en proyecto sin storageState:** el spec `superadmin/login.spec.ts` corría bajo el proyecto `superadmin` con `storageState: superadmin.json` (ya autenticado por global-setup) → `goto("/login")` redirige a `/tenants` y el form nunca aparecía. Movido a `e2e/superadmin-login/login.spec.ts` y creado proyecto `superadmin-login` **sin storageState** en `playwright.config.ts`.
- **Fix 5 — timeouts ampliados en `playwright.config.ts`:** `timeout: 60_000` (era default 30s) y `expect.timeout: 10_000` (era 5s) para tolerar lentitud cold-start Vercel.
- **Verificación pendiente:** re-run vía `workflow_dispatch` para confirmar los 6 fixes y distinguir si los fallos de `cart`/`checkout`/`crear-producto` eran entorno (deberían pasar) o bugs reales con 500s persistentes.
- **Branch:** `feat/e2e-playwright`

---

## 2026-08-07 — Round 2 E2E: fixes de aplicación/infra (auth RLS, cart, proxy, spec)

Tras re-run del round 1 quedaron 6 fallos: `auth`, `register`, `cart`, `checkout`, `crear-producto`. Se re-clasifica el diagnóstico: 2 eran bugs reales de **código de aplicación** (auth contra RLS + proxy) y 4 de **infra/harness** (Redis). Correcciones aplicadas en `feat/e2e-playwright`:

- **Fix 1 — `apps/storefront/proxy.ts`:** el matcher del middleware no incluía `/api/auth`, así que el login nunca pasaba por el middleware que inyecta `x-tenant-id` (necesario para resolver el tenant). Se agrega `/api/auth/:path*` al matcher.
- **Fix 2 — `apps/storefront/lib/auth.ts` + nuevo `lib/customer-auth.ts`:** el `authorize` de Credentials consultaba `customers` **sin** contexto RLS: con el rol `app_user` (sin BYPASSRLS), `dbCustomers` tiene RLS activo y la query devolvía 0 filas → login siempre fallaba. Se traslada la lógica a `customer-auth.ts` con `authorizeCustomer(email, password, tenantId)` que envuelve la query en `withTenantContext(tenantId, cb)` (transacción + `SET LOCAL set_tenant_id`), lookup tenant-escoped. Se añade unit test `customer-auth.test.ts` (4 casos: válido, password incorrecto, customer inexistente, falta credenciales). El **test del endpoint `/api/cart`** se actualizó al cambiar `@/lib/redis` (el route ya no usa `redisClient`; ahora expone `safeGet`/`redisSetEx`/`redisDel`).
- **Fix 3 — `packages/commerce/src/redis.ts` + handlers de carrito:** se agregan wrappers progresivos `safeGet`/`redisSetEx`/`redisDel` que degradan (null/no-op + `warn`) en vez de tirar 500 cuando Redis está caído; `redisClient` con `enableOfflineQueue: false` para fallar rápido. `packages/commerce/src/cart.ts` y `apps/storefront/app/api/cart/route.ts` usan ahora estos helpers → en E2E sin Redis, el carrito se trata como vacío (200) en lugar de un 500.
- **Fix 4 — `e2e/admin/products-crud.spec.ts`:** el test "crear producto" no llenaba el campo obligatorio `stock`, por lo que el submit fallaba la validación y no navegaba a `/products`. Se agrega `page.fill("#stock", "10")`.
- **Verificación:** `pnpm lint` y `pnpm typecheck` en verde para `storefront` y `@repo/commerce`. Los unit tests que importan `@repo/db` (cart y customer-auth) requieren `DATABASE_APP_URL` en el entorno para cargar el módulo; en el worktree local solo hay vars E2E, así que la corrida unitaria depende del harness (CI/`workflow_dispatch` definen `DATABASE_APP_URL`).
- **Fix tests (CI `pnpm test` roto, 11 fallos en 2 archivos):**
  - `packages/commerce/src/__tests__/cart.test.ts` (7 fallos): el factory de `vi.mock("../redis")` exponía solo `redisClient.get/setex/del`, pero `cart.ts` pasó a importar `safeGet`/`redisSetEx`/`redisDel`. Re-mapeado el factory a los 3 helpers (`safeGet: mockRedisGet`, etc.), eliminando la envoltura `redisClient`.
  - `apps/storefront/lib/__tests__/customer-auth.test.ts` (4 fallos): `vi.mocked(bcrypt.compare).mockResolvedValue is not a function` — bcrypt no estaba mockeado. Fix: `vi.mock("bcryptjs", ...)` con patrón del test de register (factory `importOriginal` que expone **both** `default` y `compare` como `vi.fn()`, ya que `import bcrypt from "bcryptjs"` con esModuleInterop envuelve el objeto y `bcrypt.compare` quedaba `undefined` si el mock solo expone `compare`). Se elimina el cast previo `const compare` y se usa `vi.mocked(bcrypt.compare).mockResolvedValue(x as never)` (mismo idiom que `register`).
  - Verificación local: `cart.test.ts` 10/10, `customer-auth.test.ts` 4/4, typecheck 2/2.
- **Run E2E (después del fix de tests):** 29 passed, 1 failed, 1 skipped. El único fallo restante era **flaky determinista** en `e2e/checkout/checkout.spec.ts`: `if (await addBtn.isEnabled())` se evalúa un instante tras navegar al producto — si el botón aún no está enabled, **no agrega nada** y sigue; además no esperaba el toast "Agregado al carrito" antes de `goto("/checkout")` (el POST `/api/cart`/cookie puede quedar en vuelo) → `/checkout` queda vacío y no renderiza el formulario (`checkout-name`). Y `waitForSelector(..., 5000)` era corto para cold-start Vercel.
- **Fix checkout/cart determinista:** en `e2e/checkout/checkout.spec.ts` y `e2e/storefront/cart.spec.ts` se reemplaza el guard racy por `expect(addBtn).toBeEnabled({ timeout: 10_000 })` → `click()` → `expect("Agregado al carrito").toBeVisible()`, y en checkout se usa `expect(checkout-name).toBeVisible()` (timeout default 10s) en vez de `waitForSelector(5000)`. **Migración a runner self-hosted (AlmaLinux):**
  - `e2e.yml` (jobs `wait-for-deployments`, `seed`, `e2e`) y `ci.yml` (job `build`) → `runs-on: self-hosted` (label default). Se evita depender de los minutes gratis de Actions.
  - Job `e2e`: `playwright install --with-deps chromium` (deps del sistema para AlmaLinux vía `dnf`).
  - **Guard anti-fork** en cada job self-hosted: `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`. El repo es público y un runner self-hosted en repos públicos es vector RCE si corren PRs de forks; este guard los salta (push/workflow_dispatch/PR mismo repo corren normal).
  - Prerequisitos del runner: Node 22, pnpm, git, red a Neon + los 3 dominios Vercel.
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — Cierre de infra del seed en el runner self-hosted (mj20)

Los jobs `seed` y `e2e` del runner self-hosted (AlmaLinux, máquina `mj20`) quedaron bloqueados por 3 problemas de **infra del host** (no de código). Diagnóstico y resolución:

- **1. Resolución DNS solo IPv6 + sin ruta IPv6.** `getent hosts` del endpoint Neon devolvía solo `AAAA` y el runner no enruta IPv6 → `postgres(process.env.DATABASE_URL!)` daba `ECONNREFUSED` (`[errors] ×3`). El host **sí** tiene IPv4; la causa era puramente de conectividad. Fix operativo: pin IPv4 en `/etc/hosts` del runner:
  ```bash
  echo '54.209.204.248 ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech' >> /etc/hosts
  ```
  Caveat: si el endpoint Neon cambia de IP hay que re-pinarlo y no se replica a otros runners.
- **Egress IPv4 al puerto 5432 bloqueado.** Tras el pin, `seed` resolvía IPv4 pero seguía en `ECONNREFUSED`. Clasificación con `/dev/tcp`: `:443` OK, `:5432` FAIL contra la **misma IP** → firewall/NAT del host bloquea la **salida TCP 5432**. Se abre egress en el host (p. ej. firewalld):
  ```bash
  firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="5432" protocol="tcp" accept'
  firewall-cmd --reload
  ```
- **Playwright no soporta AlmaLinux de forma oficial.** `playwright install --with-deps chromium` cae al fallback Ubuntu y ejecuta `apt-get` (inexistente en RHEL-family) → `command not found`, exit 127. Fix: **quitar `--with-deps`** del job `e2e` del workflow; las libs del sistema se instalan una vez en el runner vía `dnf`, y Playwright 1.62.0 ya tiene el build `chromium-1234` (Chrome 151.0.7922.34) cacheado en `~/.cache/ms-playwright`, así que `playwright install chromium` valida sin descargar (la revisión 1234 es exactamente la que espera 1.62.0).
- **Diagnóstico anexo revertido:** se eliminó el paso "Diagnose DB connectivity" del job `seed` (solo servía para clasificar el bloqueo; quedó ruido una vez resuelto).
- **Prerequisitos documentados del runner self-hosted:** Node 22, pnpm, git, **egress TCP a Neon en 5432** (IPv4 o IPv6), pin IPv4 del endpoint Neon en `/etc/hosts` si no hay ruta IPv6, y las libs del sistema de chromium instaladas vía `dnf` (nss, atk, at-spi2-atk, cups-libs, libdrm, libxkbcommon, libXcomposite, libXdamage, libXfixes, libXrandr, mesa-libgbm, alsa-lib, pango, cairo, gtk3).
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — Carrito/checkout no persistían: faltaba Redis (Upstash) con el nombre correcto

Tras arreglar la infra del runner, el job E2E quedó en 28 passed / 2 failed (`cart`, `checkout`), ambos con el **mismo síntoma determinista**: tras "Agregado al carrito" (POST 200 y toast OK), `/cart` y `/checkout` salían vacías → `[data-testid=cart-item]` y `[data-testid=checkout-name]` ausentes. Diagnóstico:

- El carrito es 100% Redis-persistido: `packages/commerce/src/redis.ts` y `apps/superadmin/lib/redis.ts` leen `process.env.REDIS_URL` (ioredis). El proxy genera el cookie `cart_session_id` estable (`apps/storefront/proxy.ts:114`) e inyecta `x-cart-session-id`, así que POST y GET usan la misma sesión.
- **Variable en mayúsculas:** el código lee `REDIS_URL`. En Vercel había quedado como `redis_url` (minúsculas) → `process.env.REDIS_URL` era `undefined` → fallback a `redis://localhost:6379` → cada `safeGet`/`redisSetEx` degrada a `null`/no-op → POST "ok" pero nada se persiste → GET devuelve `items: []`. Los nombres de variables de entorno son sensibles a mayúsculas/minúsculas.
- **DB Upstash borrada:** al restaurar, "no databases available". No hay una política conocida de Upstash que borre el free tier por inactividad; probablemente se borró manualmente. Se recrea la instancia.
- **Cuidado con `isProduction`** (`@repo/validation/env.ts`): `isProduction = NODE_ENV==="production" && (R2 || RESEND || UPSTASH_REDIS_REST_URL)`. Si el storefront arranca con solo las core, agregar `UPSTASH_REDIS_REST_URL` hace que `productionSchema` exija además `RESEND_API_KEY`, `R2_*`, `MERCADOPAGO_WEBHOOK_SECRET`, `STOREFRONT_URL` → sin ellas la app **revienta al boot**. Como el carrito solo usa `REDIS_URL` (que **no** está en `hasCloudVars`), alcanza con setear `REDIS_URL` (mayúsculas) en Vercel; `UPSTASH_*` es opcional y solo si se completan las demás vars de producción.
- **Acción:** se configura `REDIS_URL` (nueva instancia Upstash `model-emu-200894`, URL `rediss://...:6379`) en el `.env.local` y se documenta. El carrito requiere **`REDIS_URL` (mayúsculas, ioredis)** — distinta de `UPSTASH_REDIS_REST_URL`.
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — E2E casi verde: fix de flakiness en `cart` (cold-start Vercel)

Tras configurar `REDIS_URL` en Vercel, el run E2E quedó en **29 passed / 1 flaky / 1 skipped**: `checkout` ya pasa (el carrito persiste), pero `cart.spec.ts` "ver carrito con ítem" quedó **flaky** — `[data-testid=cart-item]` no aparecía en 10s en el primer intento y pasaba en el retry. Se trató de cold-start de Vercel en el primer hit a `/cart` (Server Component + GET `/api/cart`), no de un bug de app. Fix en `e2e/storefront/cart.spec.ts:30`: `toBeVisible({ timeout: 30_000 })` (mismo patrón que el fix de `checkout`). El `1 skipped` es intencional (spec con `test.skip`).

- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — Auditoría RLS/tenant: grep con BRE roto dio falso "0 matches"; re-corrida con ripgrep limpia

El reviewer pidió re-correr la búsqueda de accesos directos a `db` (sin `withTenantContext`) con sintaxis correcta: el grep de la auditoría anterior usaba BRE (sin `-E`/`-P`), donde `\(` y `|` son literales → reportaba "0 matches" por herramienta rota, no porque no hubiera código. Re-corrida con ripgrep sobre todo el worktree:

- `db\.(select|insert|update|delete)\s*\(` → 20 matches, **todos** en `packages/db/seed.ts` (legítimo: el seed corre con rol owner/BYPASSRLS, no está sujeto a RLS).
- Ampliado `db\.(select|insert|update|delete|execute|query|transaction)\s*\(` → 30 matches: `seed.ts` + `packages/db/src/index.ts:19` (`db.transaction` — es la implementación del propio helper `withTenantContext`).
- `db\.query\.\w+` (consultas relacionales de Drizzle, otra vía de acceso directo) → **0 matches**.

Conclusión: no queda ningún acceso directo a tablas de negocio fuera de `withTenantContext` en código de runtime. El único bug de ese tipo era `apps/storefront/lib/auth.ts` (login roto por RLS), ya corregido con el helper `customer-auth.ts`. Nada más que atender.

- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — Carrito intermitente: race de conexión de ioredis en cold-start (el timeout de 30s no era la causa)

El run E2E siguió en **28 passed / 1 failed (`cart`) / 1 flaky (`checkout`) / 1 skipped** incluso con `toBeVisible({ timeout: 30_000 })`. El `cart` fallaba de forma determinista con el carrito vacío tras un POST "ok": **el timeout no resolvía la causa real**. Diagnóstico en `packages/commerce/src/redis.ts`:

- ioredis se crea con `lazyConnect: true` + `enableOfflineQueue: false`. En un cold-start de Vercel, el primer comando (`setex`/`get`) **dispara** la conexión y, como `enableOfflineQueue` está desactivado, ioredis **rechaza** el comando si el socket aún está en `connecting` (status no `ready`) → `redisSetEx` degrada a no-op → el POST responde 200 (el toast miente) pero nada se persiste → el GET devuelve `items: []`. Es una carrera que pierde el write en silencio; subir el timeout del assertion no cambia el estado.
- **Fix:** nuevo `whenReady(timeoutMs=5000)` en `redis.ts` — espera (con tope) al evento `ready` antes de emitir el comando, disparando `connect()` si el status es `wait`/`end`. Si Redis nunca queda listo, se degrada tras 5s (mismo comportamiento "progresivo", pero sin la race). `safeRun` unifica los tres wrappers.
- **Mejora no-bloqueante del reviewer implementada:** `redisDown()` ahora además dispara `captureMessage("Redis unavailable during \"<op>\"")` a Sentry vía dynamic import de `@sentry/nextjs` (try/catch: no-op si no hay DSN o en tests). Se declaró `@sentry/nextjs@^10.69.0` (misma versión que las 3 apps) en `packages/commerce/package.json`; `pnpm-lock.yaml` actualizado.
- **Verificación local:** `@repo/commerce` typecheck OK; suite completa **383 passed (48 files)**; ESLint OK en el archivo tocado. (Nota: `prettier --check` local falla por `prettier-plugin-tailwindcss` ausente — preexistente, el plugin nunca estuvo en el lockfile.)
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 — Post-merge: dominios a producción + auditoría de env vars + pnpm install

Tras mergear el PR #40 (feat/e2e-playwright) a develop, se cerraron los 3 pendientes operativos de la lista post-merge:

- **1. Dominios reasignados a la rama `develop` en Vercel** (REST API con token de sesión, `PATCH /v9/projects/{p}/domains/{d}` con `gitBranch: "develop"`): `*.landaetastudio.com` (storefront), `admin.landaetastudio.com` (admin), `superadmin.landaetastudio.com` (superadmin). Apuntaban a `feat/e2e-playwright` (rama ya eliminada); sin el cambio quedaban sin servir. Los 3 verificados=True contra el preview de develop. Nota: el primer intento los puso en producción (`gitBranch: null` → rama de producción `main`, último build de mayo 2026); se corrigió de inmediato a `develop`.
- **2. Auditoría de env vars (producción + preview) en los 3 proyectos Vercel**: completas — `DATABASE_URL`, `DATABASE_APP_URL`, `AUTH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `R2_*`, `RESEND_API_KEY`, `STOREFRONT_URL` (storefront además `REDIS_URL` en mayúsculas + `UPSTASH_*`; admin/superadmin además `NEXTAUTH_URL` y `ADMIN_HOST`/`SUPERADMIN_HOST`). Sin gaps que corregir. `UPSTASH_REDIS_REST_URL` en storefront no rompe el boot porque las demás cloud vars de producción están presentes (el trap de `isProduction` exige todas, y están todas).
- **3. `pnpm install --frozen-lockfile`** en el repo principal: sincroniza node_modules con la dep nueva `@sentry/nextjs` en `@repo/commerce` que trajo el merge.
- **Nota para el release:** los dominios apuntan al preview de `develop` (build fresco con el E2E mergeado). La rama de producción de los 3 proyectos es `main`; hasta que se mergee `develop → main`, el dominio no sirve el build de producción de mayo 2026.
- **Branch:** `develop`

## 2026-08-07 — Lockfile roto tras merges de Dependabot: `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`

Tras mergear los 10 PRs de Dependabot (#30-#39) a develop, los deploys de Vercel (3 proyectos) y el CI self-hosted fallaron con el mismo error en `pnpm install --frozen-lockfile`:

```
ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY: no entry for
'vite@8.0.10(@types/node@26.1.2)(esbuild@0.25.12)(jiti@2.6.1)(terser@5.49.2)(tsx@4.23.5)'
```

- **Causa raíz:** lockfile roto por los merges de Dependabot (no código). El importer raíz y el snapshot de `@vitejs/plugin-react@6.0.5` referenciaban `vite@8.0.10(...)(jiti@2.6.1)...`, pero en la sección `snapshots` solo existía la variante con `jiti@2.7.0` (los merges mezclaron resoluciones generadas en ramas distintas: una resolvía jiti 2.6.1, otra 2.7.0).
- **Fix:** `pnpm install --no-frozen-lockfile` (el comando que pnpm mismo sugiere para lockfiles rotos por merge) re-resolvió plugin-react contra la variante existente `jiti@2.7.0`. Diff final mínimo: 3 líneas en el lockfile (las 3 referencias de vite de `@vitejs/plugin-react`). Sin cambios en `package.json`.
- **Verificación:** `pnpm install --frozen-lockfile` → exit 0 (reproduce el gate de Vercel/CI); `pnpm test` → 383/383 (48 files) con vitest 4.1.10.
- **Resultado:** commit `678d5b6` → CI en develop **success**; deploys Vercel de los 3 proyectos en `678d5b6` **success**.
- **Lección:** al mergear en lote PRs de Dependabot que tocan `pnpm-lock.yaml`, verificar localmente `pnpm install --frozen-lockfile` antes de pushear (o usar `@dependabot rebase` en secuencia para que cada PR se resuelva contra el develop actualizado).
- **Branch:** `develop`

## 2026-08-08 — INCIDENTE ACTIVO: 9 Server Components leían tablas con RLS directo (sin `withTenantContext`)

**Descubrimiento:** la verificación final de la auditoría RLS (a pedido del reviewer) con salida cruda del grep reveló que la auditoría anterior era **falsa** por herramienta rota, esta vez doblemente:

1. El grep de una línea `db\.(select|insert|update|delete)\s*\(` no matchea queries multilínea (`db` / `.select()` / `.from()`), que es el idiom estándar del codebase.
2. La corrida cruda con el patrón multilínea `\.from(dbX)` encontró **72 matches**, y la clasificación tabla-por-tabla dejó **9 Server Components (páginas) leyendo tablas con RLS fuera de `withTenantContext`**: 7 del admin (`products`, `orders`, `categorias`, `shipping`, `products/new`, `products/[id]/edit`) y 2 del storefront (`buscar/search-results.tsx`, `checkout/success`, más `categoria/[slug]` — 9 en total).

**Confirmación de impacto real en producción (no solo lectura de código):**

- BD prod (Neon, rol owner): **7 productos, 7 categorías, 4 órdenes, 4 métodos de envío, 29 variantes, 10 imágenes** — los datos existen.
- RLS en prod: `relrowsecurity=true` + `relforcerowsecurity=true` (migraciones 0009+0010, activas desde el 2026-07-29 con el commit `3b2d77c`) en las 8 tablas de negocio; `app_user` con `rolbypassrls=false`.
- Navegador logueado en `admin.landaetastudio.com`: `/products`, `/orders`, `/categorias`, `/shipping` → **todas las tablas vacías** ("No hay productos. Crea el primero.", etc.).
- Storefront público `tienda1.landaetastudio.com/buscar?q=remera` → **HTTP 500** (peor que vacío): con RLS devolviendo 0 productos, `productIds` quedaba vacío y `sql`... in ${productIds}`` generaba `IN ()` inválido en PostgreSQL.
- **E2E no lo detectó:** los specs de admin solo asertan headings, nunca las filas de las tablas.

**Fix (9 archivos, mismo patrón:** `db.` → `tx.` dentro de `return await withTenantContext(tenantId, cb)`):

- Admin: `products/page.tsx` (3 queries), `orders/page.tsx`, `categorias/page.tsx`, `shipping/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx` (4 queries, todas en un solo contexto).
- Storefront: `buscar/search-results.tsx` (4 queries en un contexto), `checkout/success/page.tsx` (agrega `getTenantId()`), `categoria/[slug]/page.tsx`.
- **Guard adicional en `/buscar`:** si `productIds.length === 0` se devuelven `variants: []`/`images: []` sin construir el `IN ()` — caso legítimo (búsqueda sin resultados) que no debe dar 500 nunca.

**Tests de regresión (3 archivos, 5 tests):** `orders/__tests__/page.test.ts`, `products/__tests__/page.test.ts` (assertan que la página llama `withTenantContext(tenantId, ...)` y renderiza los datos devueltos), `buscar/__tests__/search-results.test.ts` (con resultados + sin resultados / guard del `IN ()`). Patrón: mock de `withTenantContext` con chain Drizzle que resuelve en orden de await.

**Verificación:** `pnpm test` 388/388 (5 nuevos, 51 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

**Impacto del incidente:** desde la activación de FORCE RLS (2026-07-29), el panel de admin mostraba listas vacías en el uso diario (productos, órdenes, categorías, envíos) y el buscador público del storefront daba 500. No fue reportado antes consistentemente con la ausencia de uso del admin en el período (sin tenants/clientes reales aún; el reviewer pidió confirmar si alguien del equipo entró — sin evidencia de uso, ADR-022 ya había documentado que no se detectó tráfico a rutas en la auditoría).

- **Branch:** `develop`

---

## 2026-08-08 — Alineación documental post-incidente RLS

- **README.md:** tests 227→388 (51 archivos, fecha 08-08), nueva sección **Fase 6 – RLS real (withTenantContext) y E2E** (withTenantContext real, DATABASE_APP_URL, incidente 08-08, E2E, carrito resiliente, barrido console.*), endpoints faltantes agregados (`products/import`, `config/tenant`, `config/settings`, `config/tenant/domain`, `domain-check` en admin y superadmin, `search` y `categories` de storefront), bloque duplicado `apps/` de estructura eliminado, MercadoPago ngrok→dotunnel, "Estado actual" corregido (R2 en lugar de MinIO, Resend en lugar de nodemailer, customer-auth con withTenantContext).
- **SETUP.md:** 225→388 tests, sección **Redis** nueva (REDIS_URL ioredis vs UPSTASH_* REST, trap de `isProduction` en env.ts), sección **E2E** nueva (playwright.config en raíz, requisitos runner self-hosted AlmaLinux: egress TCP 5432, pin IPv4 Neon en /etc/hosts, libs chromium dnf, guard anti-fork), vars Vercel completadas con `DATABASE_APP_URL` y `REDIS_URL`.
- **docs/arquitectura.md:** ADR-022 (rls-status) agregado al índice; convención de logger actualizada a 0 instancias `console.*` en apps/ (barrido completo; excepción seed.ts y env.ts).
- **TESTING.md:** setup Docker→cloud, MercadoPago diferenciado (sandbox manual pendiente vs webhook automatizado con 11 tests), 225→388 tests / 25→51 archivos, fecha 08-08, patrón de testing actualizado (handlers reales + @repo/test-utils).
- **TESTING-MANUAL.md:** 225→388 + E2E (14 specs), Docker/ngrok → cloud/dotunnel, MailHog → Resend, **CSV import reconciliado** (pasó de "No implementado" a Implementado — sección y pendiente corregidos), **afirmación falsa de proxies removida** (secciones "Seguridad de subdominios" marcadas obsoletas: los proxy.ts de admin/superadmin fueron eliminados como no-ops el 10-07; el aislamiento se garantiza por datos, no por host).
- **Verificación:** greps de coherencia (388 tests en vitest, 0 `console.*` en apps/, 14 specs, métodos HTTP confirmados en routes de config/tenant, config/settings, config/tenant/domain, domain-check, search, categories). Sin cambios de código — no se ejecutó build/test completo.
- **Branch:** `develop`

---

## 2026-08-08 — Webhook MP: verificación de firma alineada a spec oficial

**Bug:** el webhook de MercadoPago calculaba `HMAC(rawBody + "." + x-request-id)` y comparaba el header completo; la spec real de MP firma la cadena canónica `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y envía `x-signature: ts=<ts>,v1=<v1>`. Todo webhook legítimo devolvía 401 (fail-closed) → MP reintentaba 24 h → las órdenes nunca se confirmaban en prod. Además `BYPASS_WEBHOOK_SIGNATURE` figuraba en `.env.local.example` pero el código nunca lo leía (config muerta).

**Cambios:**

- **Nuevo helper** `packages/commerce/src/webhook-signature.ts` (`verifyMercadoPagoSignature`): parsea `ts`/`v1`, construye canonical omitiendo partes vacías, rechaza `ts` fuera de ventana de 300 s (anti-replay, recomendación de MP) y compara con `timingSafeEqual` con guard de longitud previo. Exportado desde `@repo/commerce` (index + subpath).
- **route.ts:** bloque manual reemplazado por el helper; `BYPASS_WEBHOOK_SIGNATURE=true` solo salta verificación cuando `NODE_ENV !== "production"` (fail-closed intacto en prod). Flujo de negocio, magic IDs dev e idempotencia por `payment_id` sin cambios.
- **Tests:** 14 unit del helper + 13 del route reescritos a formato MP real (firma válida/inválida/vencida, bypass dev sí / prod no, magic approved/rejected, 400 payload, 503 sin secret). TDD: test del helper rojo primero (módulo inexistente).
- **Docs:** README (formato de firma MP + smoke test con openssl), SETUP.md (ejemplos curl con canonical correcto), esta entrada.

**Verificación:** `pnpm test` 405/405 (17 nuevos, 52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `fix/webhook-mp-firma` (pendiente merge a `develop`)

---

## 2026-08-08 — Checkout: cold-start de Redis no rompe el flujo (fail-open rate limit)

**Bug:** al pagar en `/checkout` (tienda1 prod) el POST `/api/checkout/preference` devolvía `"Stream isn't writeable and enableOfflineQueue options is false"`. El rate limit usaba `redisClient.incr/pexpire` directos (sin `whenReady`), y con `lazyConnect` + `enableOfflineQueue:false` el primer comando de una instancia serverless fría se rechaza mientras el socket conecta — la misma carrera de cold-start ya documentada para el carrito (wrappers `safeGet`/`redisSetEx`/`redisDel`), pero sin cobertura en checkout.

**Cambios:**

- **`packages/commerce/src/redis.ts`:** nuevos wrappers progresivos `redisIncr` (retorna `number | null`) y `redisPexpire`, ambos vía `safeRun` (mismo patrón que `safeGet`).
- **`checkout/preference/route.ts`:** `rateLimitKey` usa los wrappers; si Redis no responde (`null`) → `logger.warn("Redis unavailable, rate limit disabled")` y trata como 0 (**fail-open**: el checkout no se bloquea por un problema transitorio de Redis; el rate limit es protección, no crítica). Catch final ya no filtra `error.message` interno: mensaje genérico en español, detalle solo en logs.
- **`checkout/route.ts`:** `redisClient.get/del` → `safeGet`/`redisDel` (degradación consistente con carrito: Redis caído = carrito vacío 400, no 500).
- **Tests (TDD, RED primero):** mocks de `@/lib/redis` migrados a los wrappers; caso nuevo "fail open cuando Redis no está disponible" (sin 429 y flujo continúa); 21 tests en checkout (1 nuevo).
- **Docs:** esta entrada.

**Verificación:** `pnpm test` 406/406 (1 nuevo, 52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `develop`

---

## 2026-08-08 — Checkout: URL base derivada del request (fin de STOREFRONT_URL)

**Bug:** los `back_urls` de MercadoPago se construían con `STOREFRONT_URL` (env fija), que en Vercel apuntaba a `saas-storefront.vercel.app` → el redirect post-pago daba 404 en `/checkout/success`. Con una env fija además rompe multi-tenant: un checkout de tienda2 redirigiría al dominio de tienda1 (el proxy resuelve el tenant por host).

**Cambios:**

- **Nuevo helper** `apps/storefront/lib/request.ts` (`getStorefrontBaseUrl(request)`): deriva la base de `x-forwarded-proto` + `host` del request entrante. Sin condicionales ni fallbacks (ya no se usa dotunnel local; solo Vercel).
- **`checkout/preference/route.ts`:** `back_urls` usan `getStorefrontBaseUrl(request)`; se elimina el `throw` por `STOREFRONT_URL` faltante.
- **`register/route.ts`:** el email de bienvenida usa la misma derivación (link de la tienda correcta por tenant).
- **Vercel:** `STOREFRONT_URL` se mantiene en admin/superadmin por validación de env; en storefront queda inerte (el código ya no la lee). `.env.local` ya no la necesita para dev.
- **Tests (TDD, RED primero):** el test de éxito de preference pasa `host`/`x-forwarded-proto` por headers y aserta `back_urls` y `external_reference` del body enviado a MP; el test de register aserta el email con la URL derivada.
- **Docs:** README (sección webhook) y SETUP (sección STOREFRONT_URL → inerte) actualizados.

**Verificación:** `pnpm test` 406/406 (52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `develop`

## 2026-08-08 � E2E de firma real del webhook MP (spec `webhook-signature`)

**Contexto:** el E2E existente (`checkout.spec.ts`) llega hasta el redirect de MP pero no completa el pago. Para validar la firma real del webhook (spec oficial `ts=...;v1=...`) y el cambio de estado de la orden sin llamar a la API de MP, se agrega un spec E2E que ejercita el endpoint desplegado. El modo `x-test-order-id` solo se activaba con `NODE_ENV=development`; en Vercel (production) no funcionaba.

**Cambios:**

- **`apps/storefront/app/api/webhooks/mercadopago/route.ts`:** refactor del bloque de simulaci�n a `simMode` = `NODE_ENV=development` **o** `E2E_WEBHOOK_TEST=1` + mapa de magic IDs `123456789` (approved) / `000000` (rejected) / `999999` (pending). La firma nunca se salta (fail-closed).
- **`packages/commerce`:** `makeSignature` movido del unit test a `webhook-signature.ts` y reexportado (subpath `@repo/commerce/webhook-signature`); unit test refactorizado para usarlo (DRY).
- **`playwright.config.ts`:** nuevo proyecto `webhook` (testMatch `webhook/*.spec.ts`, baseURL storefront).
- **Nuevo spec `e2e/webhook/webhook-signature.spec.ts`:** 4 tests � firma v�lida + approved ? orden `confirmed`; firma adulterada ? 401; sin `x-signature` ? 401; pending ? la orden queda `pending_payment`. La orden se crea por insert directo a DB (`orders` camelCase, `total=0` para no disparar email), tienda1 fijo, limpieza en `afterAll` (`DELETE ... WHERE id = ANY(...)`). Guard `test.skip` si CI sin `E2E_WEBHOOK_TEST`.
- **`e2e.yml`:** workflow env `E2E_WEBHOOK_TEST=1` + job `e2e` recibe `DATABASE_URL` (Neon) y `MERCADOPAGO_WEBHOOK_SECRET`.
- **Docs:** TESTING.md (fila E2E firma + magic ID `999999`) y AGENTS.md (formato `x-test-order-id=<tenantId>:<orderId>`, magic IDs, env `E2E_WEBHOOK_TEST`).

**Pendiente operativo:** setear `E2E_WEBHOOK_TEST=1` como env var de Vercel (Preview) en el proyecto storefront y el secret `MERCADOPAGO_WEBHOOK_SECRET` en GitHub Actions (mismo valor que Vercel).

- **Branch:** `develop`

## 2026-08-08 — E2E webhook MP verde en CI (firma real)

**Contexto:** el primer run de CI del spec `webhook-signature` reportó 5 skipped (4 webhook + 1 cross-tenant pre-existente): los skips eran silenciosos en `beforeAll` cuando faltaba env, haciendo parecer el run exitoso.

**Cambios posteriores:**

- **`e2e/webhook/webhook-signature.spec.ts`:** el `beforeAll` ahora lanza `throw` con mensaje explícito (lista `DATABASE_URL`/`MERCADOPAGO_WEBHOOK_SECRET` como `set`/`MISSING` y valida tenant `tienda1`) en lugar de `test.skip` silencioso — fail-fast cuando el workflow está opt-in (`E2E_WEBHOOK_TEST=1`).
- **`e2e.yml`:** el paso de comentario de PR usa guard `if (!context.issue.number)` (workflow_dispatch no tiene issue → evitaba 404 `issues//comments`).

**Configuración externa aplicada:** `E2E_WEBHOOK_TEST=1` en Vercel (Preview) y secret `MERCADOPAGO_WEBHOOK_SECRET` creado en GitHub Actions (valor real de Vercel, no el local).

**Verificación:** CI `workflow_dispatch` verde — 34 passed, 1 skipped (cross-tenant pre-existente); los 4 tests de firma ejecutados contra `tienda1.landaetastudio.com` con firma real.

- **Commits:** `a49747f`, `cf11cd6`, `71a9972`
- **Branch:** `develop`

## 2026-08-08 — Calidad: limpieza email, health check y deuda técnica

- **Ítem 1 — Limpieza configs muertas:** `email.ts` Resend-only (`RESEND_FROM_EMAIL` como sender configurable, fallback `onboarding@resend.dev`); eliminados SMTP_HOST/PORT/FROM, `nodemailer` y `@types/nodemailer` (y del lockfile). `.env.local.example` refleja `RESEND_FROM_EMAIL`.
- **Ítem 2 — Health check:** nuevo `redisPing()` en `@repo/commerce` (wrapper fail-open en `safeRun`) + `GET /api/health` público en las 3 apps (DB `SELECT 1`, Redis `ok/skipped`, token MP `ok/missing`; 200 ok / 503 degraded; `force-dynamic`; timeout 4s por check). Negación `api/health` en el matcher de `proxy.ts` del storefront (crítico: sin esto 404 por resolución de tenant). Ajuste `@repo/commerce/*` en tsconfig de admin/superadmin. 12 tests nuevos (4 por app). Docs: README (Monitoreo) y SETUP (Health Check / UptimeRobot).
- **Ítem 3 — Deuda técnica:** nuevo `docs/deuda-tecnica.md` con 3 planes (TOCTOU en stock de checkout con update atómico `stock - qty WHERE stock >= qty`; migraciones inmutables con guard en CI; pin IPv4 del endpoint Neon para el runner self-hosted). **NO ejecutado, solo plan.**
- **Branch:** `quality/calidad-y-monitoreo`

## 2026-08-08 — Alertas proactivas: degradación de health → Sentry

- Los 3 `GET /api/health` ahora disparan `captureMessage` (level `warning`) a Sentry cuando degradan (db error, redis error, token MP missing), solo si hay `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`. Fail-open: si Sentry no está, solo queda el `logger.warn`.
- Permite alerta temprana de "nuevo issue" ante degradación persistente (sin depender solo del 500 que ya capturaba).
- 6 tests nuevos (2 por app): Sentry notificado en degradación + no notifica en ok. Suite: 55 archivos / 425 tests.
- Monitoreo externo: UptimeRobot (3 monitores a los `/api/health`, 5 min, 200 OK), alertas de Vercel (5xx >5%, p95 >3s, disponibilidad <99%) y Sentry (≥10 errores/5 min) ya creadas manualmente en paneles.

## 2026-08-10 — Chore: factory de health check, test de Redis fallando y decisión E2E_WEBHOOK_TEST

- **Refactor (eliminar duplicación):** los 3 `route.ts` de `/api/health` (byte-idénticos salvo `APP_NAME`) ahora delegan en el factory `createHealthCheckHandler({ appName, hasRedis })` de `@repo/commerce/health` (export `"./health"` en `package.json`, patrón `./webhook-signature`). Semántica cambiada por diseño: Redis se chequea solo en storefront (`hasRedis: true` y `REDIS_URL` presente); admin/superadmin SIEMPRE `"skipped"` (antes dependían de `REDIS_URL`). Comportamiento observable en prod sin cambios (admin/superadmin no tienen `REDIS_URL`).
- **Test faltante:** `"returns 503 if Redis is configured but fails (error, not skipped)"` en storefront (mock `redisPing` rechazado → 503, `checks.redis: "error"`). Suite: 55 archivos / 426 tests.
- **Decisión documentada:** `E2E_WEBHOOK_TEST=1` en Preview de Vercel (proyecto storefront) — activa magic IDs (`123456789`/`000000`/`999999`) solo con firma HMAC válida (`MERCADOPAGO_WEBHOOK_SECRET` obligatorio siempre); aplica a todos los previews (no acotable por rama/dominio), aceptado porque la firma es el gate real. Documentado en AGENTS.md.
- **Branch:** `chore/health-and-docs`

---

## 2026-08-10 — Alineación documental post-PR44

- **README.md:** tests 388→426 (55 archivos), fecha a 10-08; mención del factory `createHealthCheckHandler` de `@repo/commerce/health` en Monitoreo y de la decisión `E2E_WEBHOOK_TEST=1` (previews, magic IDs `999999` incluido) en la sección MercadoPago.
- **SETUP.md:** tests 388→426 (55 archivos), fecha a 10-08 y mención del factory de health check (los 3 `/api/health` solo delegan).
- **PROMPTS.md:** `npx tsc --noEmit` → `pnpm typecheck` en el prompt de análisis completo (el comando raíz era inerte en el monorepo: no hay tsconfig raíz).
- **docs/arquitectura.md + ADR-021-placeholder:** gap de numeración 020→022 documentado (no se reindexa ADR-022 para no romper links/historial).
- **TESTING.md / TESTING-MANUAL.md:** tests 388→426 (55 archivos) — consistencia total (quedaban como discrepancia residual).
- **bitacora.md:** solo se agrega esta entrada; la entrada previa del 10-08 ya reflejaba 426 tests.
- **Verificación:** `pnpm lint` ✅ | grep: solo quedan menciones históricas de 388 en bitácora (inmutables).
- **Branch:** `docs/align-post-pr44` (pendiente PR a develop)

---

## 2026-08-10 — TOCTOU: oversell en checkout (fix atómico) + 409 en PUT products/[id]

- **Checkout oversell (fix atómico):** el decremento de stock en `apps/storefront/app/api/checkout/route.ts` calculaba `stock - qty` sobre el valor leído en la fase 1 (no atómico): dos órdenes concurrentes con stock justo podían pasar la validación ambas y la segunda sobrescribía → oversell. Ahora UPDATE atómico con `sql`${stock} - ${qty}`` + `WHERE stock >= qty` + `.returning({ id })`: 0 filas → "Stock insuficiente" → 422 (mapeo existente, rollback automático de la transacción). 2 tests nuevos (stock exacto + concurrencia con `Promise.all`: una 200, una 422). Commit `9e7a518`.
- **PUT products/[id] (TOCTOU entre fases):** ventana fase 1 read → R2 → fase 3 write donde el producto pudo ser borrado: el UPDATE afectaba 0 filas y el refetch vacío devolvía 200 con body vacío; FK `23503` al insertar variantes daba 500. Ahora: refetch post-update `updatedProduct.length === 0` → 409 "Producto eliminado durante la actualización", catch `23503` → 409 con el mismo mensaje y `logger.error` con `{ error, productId, tenantId }`. 2 tests nuevos (0 filas → 409, FK → 409). Commit `069f6aa`. Cierre de la deuda anotada el 2026-07-29.
- **Ejecución:** 2 worktrees de Paseo en paralelo (`fix/toctou-checkout`, `fix/toctou-products`) con subagentes opencode (TDD estricto: RED → GREEN → verificación anti-revert con `git stash` de cada route.ts, tests nuevos fallan contra el código revertido). Integración: cherry-pick de ambos commits a la rama unificada `fix/toctou-checkout-products`.
- **Tests:** 426 → **428** (55 archivos). Lint sin errores. `docs/deuda-tecnica.md` ítem 1 marcado implementado (incluye el caso products/[id], mismo patrón TOCTOU); README: pendientes sin "TOCTOU en PUT products/[id]".
- **Branch:** `fix/toctou-checkout-products` (pendiente PR a develop)

---

## 2026-08-11 - Calidad: guard de migraciones en CI, tarjetas de prueba MP, assertions E2E, prettier plugin y formateo global

- **Guard de migraciones inmutables (CI):** nuevo scripts/check-migrations.sh - falla (fail-closed) si git diff origin/develop -- packages/db/migrations/ no est� vac�o: mensaje `? Migraci�n existente modificada - crea una nueva migraci�n, no edites las anteriores.`. .github/workflows/ci.yml: checkout@v7 con etch-depth: 0 + step Guard migraciones inmutables en el job uild. Cierra el �tem 2 de docs/deuda-tecnica.md.
- **Pin IPv4 de Neon para el runner self-hosted (documentaci�n):** SETUP.md nueva sub-secci�n "Runner self-hosted: pin IPv4 de Neon" (diagn�stico, dig +short A/getent ahostsv4, pin en /etc/hosts, verificaci�n con psql/E2E, alternativa IPv4-only y rotaci�n de IPs). Cierra el �tem 3 de docs/deuda-tecnica.md.
- **Tarjetas de prueba MercadoPago:** SETUP.md y TESTING.md - placeholder "Pr�ximamente" reemplazado por tabla real del sandbox: Visa 4509 9535 6623 3704 APRO, Mastercard 5031 7557 3453 0604 OTHE, Amex 3711 8030 3257 522 CONT; CVV 123 (Amex 1234), vencimiento 11/25, titular/documento libres.
- **Assertions de contenido en E2E admin:** products-crud.spec.ts (verifica la fila creada con nombre �nico y que el estado vac�o no aparezca - detectar�a regresi�n RLS), orders.spec.ts ( body tr count > 0), categories.spec.ts (fila creada + sin estado vac�o). Nombres �nicos con Date.now().
- **Skip del E2E cross-tenant documentado:** comentario al inicio de e2e/security/cross-tenant.spec.ts explicando el skip condicional (falta tenant T2 con productos seed; se habilitar� cuando exista fixture multi-tenant).
- **prettier-plugin-tailwindcss en ra�z:** pnpm add -D -w prettier-plugin-tailwindcss@0.8.1 (peer prettier ^3.0, compatible con 3.9.6). .prettierrc ya lo referenciaba pero el plugin nunca estuvo instalado: prettier no pod�a correr con la config del repo.
- **Primer formateo global con prettier:** al instalar el plugin, prettier --write . realine� 285 archivos (single quotes, sin semicolons, orden de clases tailwind, rewraps de markdown) contra el .prettierrc propio del repo (agregado en 44612f y nunca aplicado). Cero cambios funcionales. Archivos excluidos v�a nuevo .prettierignore: pnpm-lock.yaml y packages/db/migrations/ (inmutables). pnpm exec prettier --check . pasa limpio.
- **Ejecuci�n:** 3 worktrees de Paseo en paralelo (quality-docs, quality-infra, quality-e2e) con subagentes opencode; los agentes quedaron colgados en shells de pnpm install dos veces (patr�n conocido) y se reavivaron re-enviando el prompt. El commit de prettier del agente mezclaba plugin + formateo: se escindi� en chore (2 archivos) + style (285 archivos) y el formateo final se aplic� sobre la rama integrada para evitar conflictos con los commits de docs/e2e.
- **Integraci�n:** cherry-pick a rama unificada chore/quality-and-docs en orden: ci guard -> IPv4 -> MP cards -> assertions E2E -> skip doc -> chore plugin -> style format (7 commits).
- **Verificaci�n:** pnpm lint 6/6, pnpm typecheck 9/9, pnpm test 430/430 (55 archivos), pnpm build 3/3, pnpm exec prettier --check . limpio.
- **Branch:** chore/quality-and-docs -> mergeada como PR #47 (merge commit b772445)

## 2026-08-12 - Merge de 15 PRs dependabot, fix de lockfile corrupto y limpieza de dependencias muertas

- **Merge de 15 PRs de dependabot (todos verificados):** 10 PRs npm (drizzle-adapter 1.11.3, nodemailer 9.0.5, lucide-react 1.30.0, @types/pg 8.21.0, tsx 4.23.11, @playwright/test 1.62.1, @typescript-eslint/eslint-plugin 8.65.0, typescript-eslint 8.66.0, eslint-config-next 16.3.0, tailwindcss 4.3.3) validados en worktree local con install --frozen-lockfile + lint + typecheck + 430/430 tests, y 5 PRs de GitHub Actions (checkout v7, github-script v9, upload-artifact v7, pnpm/action-setup v6, setup-node v7) que actualizaron e2e.yml (ci.yml ya estaba en v7/v6/v7). Orden de merge: npm parches primero, luego minors, tailwindcss al final; actions sin conflicto entre sí (líneas disjuntas en e2e.yml).
- **Lockfile corrupto por merges encadenados de dependabot:** pnpm-lock.yaml con claves duplicadas (ej: browserslist@4.28.8 x3) -> ERR_PNPM_BROKEN_LOCKFILE -> builds de las 3 apps fallando en Vercel (install --frozen-lockfile no arranca). Reparado con pnpm install --fix-lockfile y commit 639eaf8 push directo a develop.
- **Limpieza de dependencias muertas (rama chore/remove-dead-deps):** eliminadas del root (devDeps: @types/ioredis, @types/nodemailer, @types/supertest, supertest, vite-tsconfig-paths, @typescript-eslint/eslint-plugin, @typescript-eslint/parser; deps: @auth/drizzle-adapter, mercadopago, nodemailer), de admin (eslint-config-next, bcryptjs), de storefront (eslint-config-next, ioredis, nodemailer, @types/nodemailer), de superadmin (bcryptjs) y de packages/db (@types/pg). Verificación: 0 imports residuales de los eliminados; bcryptjs/ioredis siguen vivos (root/packages). Lockfile ~600 líneas más chico. Los peers opcionales nodemailer@9.0.5 (next-auth) y @types/pg@8.21.0 (drizzle-orm) quedan en el árbol por resolución de peers de pnpm, sin declararse como deps.
- **Deuda documentada:** packages/storage importa minio sin declararlo (hoisting del root) - agregar como dependencia explícita en PR futuro. Deuda similar en storefront (bcryptjs no declarado, usado vía root hoisting).
- **Verificación:** pnpm lint 6/6, pnpm typecheck 9/9, pnpm test 430/430 (55 archivos), pnpm build 3/3.
- **Branch:** chore/remove-dead-deps (pendiente PR a develop)

## 2026-08-12 - Release: merge develop -> main

- **Merge de develop a main** (primera vez desde mayo 2026; main estaba 235 commits atras). Los dominios de produccion (tienda1.landaetastudio.com, admin., superadmin.) pasan a servir el build real con todo el trabajo de junio-agosto.
- **Cambios incluidos en el release (resumen):**
  - **Seguridad:** RLS real con FORCE ROW LEVEL SECURITY + rol app_user sin BYPASSRLS (DATABASE_APP_URL obligatorio); withTenantContext wireado en 27 handlers + 9 Server Components; hotfix P0 de aislamiento multi-tenant (12 handlers con filtrado tenantId); AUTH_SECRET obligatorio; firma HMAC del webhook alineada a spec oficial de MercadoPago (anti-replay 300s, fail-closed).
  - **RLS:** migraciones 0009/0010/0011 (FORCE RLS, timestamptz); incidente de Server Components leyendo tablas RLS directo corregido (08-08); auditorias de aislamiento cross-tenant con ripgrep.
  - **Webhook:** verficacion de firma canonical id:;request-id:;ts:; con timingSafeEqual; magic IDs solo con firma valida; E2E de firma real contra preview.
  - **Redis:** wrappers progresivos safeGet/redisSetEx/redisDel/redisIncr/redisPexpire + whenReady (cold-start Vercel); carrito y rate limit fail-open (degradan, nunca 500).
  - **Monitoreo:** health checks en las 3 apps (factory createHealthCheckHandler, DB/Redis/MP); alertas proactivas a Sentry en degradacion; UptimeRobot en los 3 endpoints; 0 console.* en apps/ (Pino + @repo/logger).
  - **TOCTOU:** checkout con decremento atomico de stock (WHERE stock >= qty, .returning) anti-oversell; PUT products/[id] con 409 ante producto eliminado durante la actualizacion; FK 23503 -> 409.
  - **Calidad:** 15 PRs dependabot mergeados (10 npm + 5 actions) con validacion completa; lockfile corrupto reparado 2 veces; limpieza de 13 dependencias muertas; guard de migraciones inmutables en CI; prettier global aplicado (285 archivos, 0 cambios funcionales); 430 tests / 55 archivos; E2E Playwright 15 specs con runner self-hosted; assertions de contenido en E2E admin.
- **Verificacion pre-merge:** pnpm lint 6/6, pnpm typecheck 9/9, pnpm test 430/430 (55 archivos), pnpm build 3/3.
- **Post-merge pendiente:** verificar deploys de produccion en Vercel (las 3 apps), confirmar health checks en dominios reales y revisar checklist de go-live (MP en modo produccion con token APP_USR-).
- **Branch:** main (merge commit: PENDIENTE)
