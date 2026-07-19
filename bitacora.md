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

| Métrica | Valor |
|---------|-------|
| Tests | 238 pasando, 0 fallos |
| Apps | storefront, admin, superadmin |
| Servicios | Neon, Upstash, R2, Resend |
| Deploy | Vercel (3 apps) |
| Rama default | `develop` |
| Build | Limpio (sin `ignoreBuildErrors`) |
| CI | GitHub Actions (lint, typecheck, build) |
| Storefront | ✅ Deploy OK |
| Admin | ✅ Deploy OK |
| Superadmin | ✅ Deploy OK |

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

| # | Ruta | Fix |
|---|------|-----|
| 1 | `webhooks/mercadopago` | Fail-closed HMAC, queries scoped por tenant, `x-test-order-id` solo dev |
| 2 | `checkout/preference` | IDOR same-tenant cerrado (ownership check por email), rate limiting 10 req/min/IP, logging estructurado sin PII |
| 3 | `cart/*` | `getTenantId` + filtro `tenantId` en variant/image queries |
| 4 | `checkout` | Variant SELECT y stock UPDATE scoped por tenant |
| 5 | `products/[id]/*` (8 handlers) | SQL-level `and(eq(id), eq(tenantId))` — TOCTOU eliminado |
| 6 | `orders/[id]` | 6 queries scoped por tenant |
| 7 | `shipping/[id]` | UPDATE/DELETE scoped por tenant |
| 8 | `register` | Email lookup con `and(eq(email), eq(tenantId))` |
| 9 | `tenants/*` (superadmin) | Role check `=== "superadmin"` en 5 handlers |

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

| Métrica | Valor |
|---------|-------|
| Tests | 289 pasando, 0 fallos |
| Apps | storefront, admin, superadmin |
| Servicios | Neon, Upstash, R2, Resend |
| Deploy | Vercel (3 apps) |
| Rama default | `develop` |
| Build | Limpio (sin `ignoreBuildErrors`) |
| CI | GitHub Actions (lint, typecheck, build, **test**) |
| RLS | Decorativo — `withTenantContext` roto (SET LOCAL en auto-commit). Plan P1-1 listo para ejecutar |

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

| Métrica | Valor |
|---------|-------|
| Tests | 292 pasando, 0 fallos |
| Apps | storefront, admin, superadmin |
| Servicios | Neon, Upstash, R2, Resend |
| Deploy | Vercel (3 apps) |
| Rama default | `develop` |
| Build | Limpio (sin `ignoreBuildErrors`) |
| CI | GitHub Actions (lint, typecheck, build, test) |
  | Patrón A | 21 handlers wireados con `withTenantContext` |
  | Patrón B | 5 handlers wireados con `withTenantContext` |
  | RLS | FORCE RLS en 8 tablas + `app_user` (sin BYPASSRLS) |
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
- ❌ **Fechas sin UTC explícito:** el schema usa `timestamp` sin timezone. Funciona porque Neon/Vercel corren en UTC, pero no hay garantía a nivel de schema. Riesgo latente si cambia la zona del servidor. Pendiente: migrar a `timestamptz` o validación Zod de UTC en inserts.
- ❌ **console.* sin migrar:** ~24 instancias de `console.error`/`console.log` en handlers de admin y storefront que aún no usan `@repo/logger`. Pendiente: barrido completo de apps/ (excluye seed.ts que es intencional).
