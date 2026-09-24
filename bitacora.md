# BitÃ¡cora â€” saas-ecommerce

> SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.
> Monorepo Turborepo (pnpm) â€” Next.js 16, Drizzle ORM, PostgreSQL, NextAuth v5.

---

## 2026-04-22 â€” FundaciÃ³n del proyecto

- Commit inicial desde `create-turbo`.
- ConfiguraciÃ³n monorepo: 3 apps (`storefront`, `admin`, `superadmin`), paquetes iniciales.
- Docker Compose con PostgreSQL 16, Redis 7, MinIO, MailHog.
- Variables de entorno con dotenv, scripts base en `package.json`, Turbo repo config.

---

## 2026-04-22 al 2026-04-25 â€” Fase 1: Auth y Ã“rdenes

- NextAuth v5 con Credentials provider para admin y superadmin.
- Middleware multi-tenant con resoluciÃ³n de subdominios.
- CRUD de tenants en superadmin.
- CRUD de productos en admin (variante Ãºnica).
- ValidaciÃ³n backend con Zod (price > 0, stock >= 0).
- Subida de imÃ¡genes a MinIO con `@repo/storage`.
- Carrito funcional: Redis + cookie session, 7 dÃ­as TTL, usuarios anÃ³nimos.
- Checkout con MercadoPago (Checkout Pro, binary_mode).
- Webhook con verificaciÃ³n de firma y prevenciÃ³n de duplicados.
- Email de confirmaciÃ³n con nodemailer.
- Seed de datos de prueba.
- Customer auth (registro y login en storefront).
- Panel de Ã³rdenes en admin (lista, detalle, cambio de estado).

---

## 2026-04-26 al 2026-04-29 â€” Fase 2: Dashboard y Stock

- Dashboard con mÃ©tricas reales (ventas del mes, Ã³rdenes pendientes, stock bajo).
- EdiciÃ³n rÃ¡pida de stock en tabla de admin.
- Badge "Agotado" en storefront y product-card.
- Lista de productos con stock bajo en dashboard.

---

## 2026-04-29 al 2026-05-03 â€” Fase 3: Experiencia de Tienda

- CategorÃ­as de productos (CRUD completo).
- BÃºsqueda server-side con ILIKE en storefront.
- MÃºltiples imÃ¡genes por producto (tabla `product_images`, orden por position).
- Variantes reales con JSONB (talle, color, SKU, stock independiente).
- ValidaciÃ³n Zod en todos los endpoints.
- Seed actualizado con categorÃ­as, variantes, Ã³rdenes de ejemplo.
- 165 tests.

---

## 2026-05-03 al 2026-05-15 â€” Fase 3.5: Bug Fixes y Refactor

- CorrecciÃ³n de bugs en carrito, variantes, imÃ¡genes, logout redirects.
- Refactor de `proxy.ts` â†’ `middleware.ts` (convenciÃ³n Next.js).
- Refactor de `new Response()` â†’ `NextResponse` en todas las rutas.
- Tests de categorÃ­as reescritos con patrÃ³n de lÃ³gica pura (compatibilidad vitest).
- SoluciÃ³n de problemas con Turbopack y proxy.
- 195 tests.

---

## 2026-05-15 al 2026-06-01 â€” Fase 4: Autoservicio del Tenant

- ConfiguraciÃ³n visual del tenant (logo, colores, variables CSS).
- Dominio personalizado con verificaciÃ³n (API + UI).
- Perfil de tienda pÃºblica con SEO.
- MÃ©todos de envÃ­o configurables por tenant (CRUD completo).
- Checkout con selector visual de envÃ­o y cÃ¡lculo dinÃ¡mico.
- Refactor: consolidaciÃ³n de auth en `@repo/auth`, lÃ³gica de negocio en `@repo/commerce`.
- NormalizaciÃ³n de slugs en `@repo/validation`.
- ImportaciÃ³n de productos por CSV.
- Seguridad: proxy de validaciÃ³n de host en admin y superadmin.
- 225 tests.

---

## 2026-06-01 al 2026-06-15 â€” Fase 5: ProducciÃ³n y Seguridad

- **RLS (Row Level Security):** polÃ­ticas `tenant_isolation` en todas las tablas de negocio. Helper `withTenantContext`.
- **AUTH_SECRET obligatorio:** sin fallback hardcoded. ValidaciÃ³n al arrancar.
- **CSRF protection:** activado automÃ¡ticamente por NextAuth v5 en producciÃ³n.
- **ValidaciÃ³n Zod de entorno:** schema `env.ts` que valida variables crÃ­ticas al arrancar.
- **Logs estructurados:** Pino en `@repo/logger`, `pino-pretty` en dev, JSON en prod.
- **Sentry:** integrado en las 3 apps, condicional vÃ­a `SENTRY_DSN`.
- **NEXTAUTH_URL dinÃ¡mica:** opcional; NextAuth v5 la infiere del Host header.
- **Errores 409** con campo especÃ­fico + UI inline con highlight visual.
- **Build config:** `ignoreBuildErrors: false` en `next.config.mjs`.
- **Deploy a Vercel:** las 3 apps desplegadas con URLs reales.
- **Fix de dominios:** proxy permitiendo subdominios vercel.app, `DEFAULT_TENANT_SLUG` como fallback.

---

## 2026-07-10 â€” Post-ProducciÃ³n: AlineaciÃ³n y Cloud

- Rama `production` renombrada a `develop` (local y remoto).
- ConfiguraciÃ³n del repo alineada con bienesraicesVe: `.prettierrc`, `opencode.json`, `dependabot.yml`, PR template, CI workflow.
- **MigraciÃ³n a servicios cloud:**
  - PostgreSQL local â†’ **Neon**
  - Redis local â†’ **Upstash**
  - MinIO local â†’ **Cloudflare R2**
  - MailHog local â†’ **Resend**
- DocumentaciÃ³n actualizada (README, SETUP, sin Docker).
- Fix: nombre de variable `MERCADOPAGO_WEBHOOK_SECRET` alineado entre validaciÃ³n Zod y cÃ³digo.
- 225 tests, build limpio en las 3 apps.

---

---

## 2026-07-10 â€” SesiÃ³n 2: CI/CD, Vercel, DocumentaciÃ³n

- AGENTS.md unificado con mejores prÃ¡cticas de bienesraicesVe (checklists, inyecciÃ³n de prompts, permission boundaries, progresividad).
- PROMPTS.md actualizado con templates base (API Route, Client Component, Server Component, Zod Schema).
- bitacora.md creada con historial completo del proyecto.
- **CI fix:** error de `pnpm/action-setup` por version duplicada eliminado. Node 20â†’22.
- **CI fix:** env vars movidas a job level y luego a `.env.local` en CI para que Turbo las herede.
- **turbo.json:** declaradas todas las env vars en `tasks.build.env` (Turbo 2 no las expone sin esto).
- **Vercel:** creados `apps/admin/vercel.json` y `apps/superadmin/vercel.json` con filtro monorepo.
- **DocumentaciÃ³n:** actualizadas todas las referencias de `MP_WEBHOOK_SECRET` â†’ `MERCADOPAGO_WEBHOOK_SECRET`.
- **Problemas conocidos (resueltos):**
  - âœ… Admin en Vercel: renombrado `MP_WEBHOOK_SECRET` â†’ `MERCADOPAGO_WEBHOOK_SECRET`.
  - âœ… Superadmin en Vercel: env vars cloud agregadas.

**Deuda tÃ©cnica pendiente:**

- âŒ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migraciÃ³n a `docs/adr/` con verificaciÃ³n individual por ADR.
- âŒ `withTenantContext` nunca se llama en runtime. RLS es decorativo. Pendiente wiring completo post-hotfixes.

## 2026-07-10 â€” Categories centralization

- Migrada `getCategoriesForTenant` de `apps/storefront/lib/categories.ts` a `packages/commerce/src/categories.ts`
- Creado `packages/commerce/src/__tests__/categories.test.ts` con 2 tests (TDD)
- Actualizado `packages/commerce/src/index.ts` y `package.json` exports
- `apps/storefront/lib/categories.ts` ahora re-exporta desde `@repo/commerce/categories`
- Comportamiento mejorado: sin try/catch silencioso (el original devolvÃ­a [] en error)
- test: 227/227, typecheck: 8/8, lint: âœ…

## 2026-07-10 â€” Vitest deprecation + PROMPTS.md verification

- Reemplazado plugin `vite-tsconfig-paths` por opciÃ³n nativa `resolve.tsconfigPaths: true` en vitest.config.ts
- Warning de deprecaciÃ³n eliminado de la salida de tests
- PROMPTS.md verificado: encoding UTF-8 correcto, sin caracteres corruptos
- Creado .env.local con vars mÃ­nimas para build (necesidad pre-existente)
- test: 225/225, lint: âœ…, typecheck: 8/8, build: 3/3

## 2026-07-10 â€” Proxy cleanup (admin/superadmin)

- Eliminados `apps/admin/proxy.ts` y `apps/superadmin/proxy.ts` (no-ops con params sin usar)
- Storefront conserva su proxy multi-tenant real
- lint, typecheck y tests pasan; build fallo pre-existente por AUTH_SECRET

---

## Estado actual (10 de julio 2026)

| MÃ©trica      | Valor                                   |
| ------------ | --------------------------------------- |
| Tests        | 238 pasando, 0 fallos                   |
| Apps         | storefront, admin, superadmin           |
| Servicios    | Neon, Upstash, R2, Resend               |
| Deploy       | Vercel (3 apps)                         |
| Rama default | `develop`                               |
| Build        | Limpio (sin `ignoreBuildErrors`)        |
| CI           | GitHub Actions (lint, typecheck, build) |
| Storefront   | âœ… Deploy OK                            |
| Admin        | âœ… Deploy OK                            |
| Superadmin   | âœ… Deploy OK                            |

**Deuda tÃ©cnica resuelta:**

- âœ… Proxy placeholders (`apps/admin/proxy.ts`, `apps/superadmin/proxy.ts`) eliminados
- âœ… Vitest deprecation warning (`vite-tsconfig-paths` â†’ `resolve.tsconfigPaths`) corregido
- âœ… PROMPTS.md verificado: encoding UTF-8 correcto
- âœ… Categories centralizadas en `@repo/commerce` (+2 tests, ahora 227)
- âœ… P0 Security Hotfix: tenant isolation gaps cerrados en 12 handlers

**Infraestructura completada (10 de julio 2026):**

- âœ… `MP_WEBHOOK_SECRET` â†’ `MERCADOPAGO_WEBHOOK_SECRET` renombrado en Vercel admin
- âœ… Env vars faltantes agregadas al proyecto superadmin en Vercel
- âœ… `default_branch` cambiado a `develop` en GitHub
- âœ… Monorepo Change Detection configurado en Vercel (deploys selectivos)

---

## 2026-07-10 â€” P0 Security Hotfix: Tenant Isolation

- **AuditorÃ­a de seguridad completa:** 31 rutas API analizadas por verbo HTTP. 12 handlers con gaps de aislamiento multi-tenant confirmados.
- **Estado de RLS documentado:** `withTenantContext` definido en migraciÃ³n DB pero nunca llamado en handlers. ConexiÃ³n DB usa `neondb_owner` (owner de tabla) que bypasses RLS. RLS es decorativo â€” la app depende 100% de filtrado manual `tenantId`.
- **VerificaciÃ³n de logs en Vercel:** sin evidencia de trÃ¡fico a las rutas vulnerables, consistente con no tener aÃºn tenants/usuarios reales en producciÃ³n. No se detectaron accesos cross-tenant ni intentos de explotaciÃ³n.
- **227 tests pasando**, lint âœ…, typecheck âœ…
- **PR mergeado a `develop`.**

### Hotfixes aplicados

| #   | Ruta                           | Fix                                                                                                             |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | `webhooks/mercadopago`         | Fail-closed HMAC, queries scoped por tenant, `x-test-order-id` solo dev                                         |
| 2   | `checkout/preference`          | IDOR same-tenant cerrado (ownership check por email), rate limiting 10 req/min/IP, logging estructurado sin PII |
| 3   | `cart/*`                       | `getTenantId` + filtro `tenantId` en variant/image queries                                                      |
| 4   | `checkout`                     | Variant SELECT y stock UPDATE scoped por tenant                                                                 |
| 5   | `products/[id]/*` (8 handlers) | SQL-level `and(eq(id), eq(tenantId))` â€” TOCTOU eliminado                                                        |
| 6   | `orders/[id]`                  | 6 queries scoped por tenant                                                                                     |
| 7   | `shipping/[id]`                | UPDATE/DELETE scoped por tenant                                                                                 |
| 8   | `register`                     | Email lookup con `and(eq(email), eq(tenantId))`                                                                 |
| 9   | `tenants/*` (superadmin)       | Role check `=== "superadmin"` en 5 handlers                                                                     |

#### ADR-022 creado

- `docs/adr/ADR-022-rls-status.md` documenta el hallazgo de RLS decorativo + verificaciÃ³n de logs.

### Deuda tÃ©cnica documentada

- âŒ `withTenantContext` nunca se llama en runtime. RLS es decorativo. Pendiente wiring completo.
- âŒ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migraciÃ³n a `docs/adr/`.
- âŒ Faltan 14 tests de integraciÃ³n de tenant isolation (27 planeados - 13 escritos en hotfixes 1, 2 y 9).

---

## 2026-07-10 â€” P0 Hotfix v2: IDOR same-tenant + rate limiting + tests

- **Fix IDOR same-tenant en checkout/preference:** se agregÃ³ `customerEmail` al schema de validaciÃ³n y ownership check: si `order.customerEmail !== callerEmail`, devuelve 403. Antes solo habÃ­a tenant-scoping cross-tenant, pero cualquier visitante del mismo tenant podÃ­a crear preferencias para Ã³rdenes ajenas. `packages/validation/src/schemas.ts` y `apps/storefront/app/api/checkout/preference/route.ts`
- **Rate limiting:** 10 req/min/IP con Redis (`INCR` + `PEXPIRE`), devuelve 429 al exceder. `apps/storefront/app/api/checkout/preference/route.ts`
- **Frontend actualizado:** `apps/storefront/app/checkout/page.tsx` ahora envÃ­a `customerEmail` en el body de la preferencia.
- **Pruebas de regresiÃ³n reales (no inline handlers):** Los tests iniciales de checkout/preference, webhook y superadmin usaban handlers inline que nunca ejercitaban el cÃ³digo de producciÃ³n. En esta sesiÃ³n se reescribieron los 3 archivos para importar los handlers reales (`POST`, `GET` desde `../route`), con mocks de dependencias (`db`, `redisClient`, `getTenantId`, `auth`) que devuelven datos crudos (fila de orden, sesiÃ³n, etc.), no respuestas HTTP armadas. 238 tests pasando.
- **Tests reescritos (3 archivos, 11â†’32 tests efectivos):**
  - `checkout/preference/__tests__/route.test.ts`: 12 tests (rate limiting, token, validaciÃ³n Zod, tenant resolution, IDOR 404/403/200, shipping). Importa `POST` real.
  - `webhooks/mercadopago/__tests__/route.test.ts`: 11 tests (HMAC 503/401/200, dev mode approved/rejected, validation payload). Importa `POST` real. Reemplaza ~18 tests inline preexistentes (desde `daa9845`, nunca modificados en P0).
  - `tenants/__tests__/route.test.ts`: 9 tests (GET role 401/403/200, POST role 403/201/409/400/400/401). Importa `GET`/`POST` reales. Reemplaza ~8 tests inline.
- **VerificaciÃ³n:** lint âœ… | typecheck 8/8 âœ… | tests 238/238 âœ…
- **Branch:** `fix/p0-idor-rate-limit-tests`

---

## 2026-07-13 â€” Refuerzo de aserciones en tests de magic ID del webhook

- Los dos tests de dev mode (magic ID 123456789 y 000000) solo verificaban `res.status === 200`, que el handler devuelve en mÃºltiples caminos (procesado, order no encontrado, sin external_reference). Se agregaron aserciones de body (`expect(data).toEqual({ received: true })`) y confirmaciÃ³n de que `db.update` fue efectivamente llamado, distinguiendo el procesamiento exitoso del early exit.
- `webhooks/mercadopago/__tests__/route.test.ts`: +4 aserciones (2 body + 2 db.update).
- **No cambia el conteo de tests (sigue 238/238).

---

## 2026-07-14 â€” Tests de regresiÃ³n para 6 hotfixes P0 sin cobertura + bug en cart PUT/DELETE

- **7 archivos de test creados** en branch `p1/tenant-isolation-tests` (Paseo worktree), cubriendo los 6 hotfixes P0 que no tenÃ­an test de regresiÃ³n:
  - Storefront: `cart/__tests__/route.test.ts` (22 tests, reemplaza stubs inline), `checkout/__tests__/route.test.ts` (9 tests, reemplaza stubs), `register/__tests__/route.test.ts` (5 tests, nuevo)
  - Admin: `products/[id]/__tests__/route.test.ts` (12 tests), `products/[id]/variants/__tests__/route.test.ts` (8 tests), `orders/[id]/__tests__/route.test.ts` (8 tests), `shipping/[id]/__tests__/route.test.ts` (10 tests)
- **Bug descubierto y corregido:** `getEnrichedItems` era `async function` pero se llamaba sin `await` en `cart/route.ts` PUT (line 259) y DELETE (line 347). El handler serializaba la Promise como `{}`, produciendo `{"items":{}}` en producciÃ³n. Se agregÃ³ `await` en ambos handlers.
- **12 fallos resueltos en storefront:** register (5 â€” mock bcryptjs), cart (4 â€” await faltante + mock images), checkout (1 â€” total esperado), webhooks (2 â€” mock contamination).
- **Bug de contaminaciÃ³n de mocks en webhooks:** los HMAC tests `"should return 200 when signature is valid"` y `"should verify signature when x-request-id is present"` usan `RAW_BODY` con `paymentId: "123456789"`. En dev mode, el handler entra al path magic ID y retorna antes de consumir `db.select` (porque `external_reference` es null). El `mockReturnValueOnce` no consumido persistÃ­a al siguiente test, haciendo que `db.select` devolviera `[]` y el handler no encontrara la orden. Fix: eliminar los `db.select.mockReturnValueOnce` innecesarios de esos dos tests. Las aserciones `expect(db.update).toHaveBeenCalled()` se restauraron en ambos tests de magic ID (approved + rejected).
- **VerificaciÃ³n:** storefront 90/90 âœ… | admin 140/140 âœ… | lint âœ… | typecheck âœ…
- **Branch:** `p1/tenant-isolation-tests`

---

## 2026-07-14 â€” P1-1 Plan: withTenantContext real + FORCE RLS

- **PR #6 mergeado a develop:** P1-3 (tests de regresiÃ³n P0 + bug await cart + bug contaminaciÃ³n webhooks). branch `p1/tenant-isolation-tests`
- **Bug crÃ­tico descubierto en `withTenantContext`:** la implementaciÃ³n actual usa `set_config('app.tenant_id', ..., true)` (SET LOCAL) dentro de `db.execute()`, que es auto-commit. El setting se pierde antes de las queries del callback. RLS es 0% efectivo â€” ninguna query evalÃºa las polÃ­ticas en runtime.
- **SoluciÃ³n:** `withTenantContext` debe usar `db.transaction` internamente, pasando `tx` al callback. SET LOCAL + todas las queries viven en la misma transacciÃ³n.
- **Plan P1-1 diseÃ±ado** con 7 fases (Aâ†’G) y validaciÃ³n contra Neon branch real.
- **3 correcciones del usuario aplicadas al plan:**
  1. Webhook: email de confirmaciÃ³n movido fuera del `return withTenantContext(...)` â€” antes quedaba como cÃ³digo muerto
  2. `checkout/preference`: ejemplo corregido (solo lee, no inserta Ã³rdenes)
  3. CI (`pnpm test`) como Fase 0 â€” PR independiente antes del refactor
- **Plan de ejecuciÃ³n en 4 PRs:**
  - **PR1:** Fase 0 â€” `pnpm test` en CI workflow
  - **PR2:** PatrÃ³n A (18 handlers sin I/O externo) + tests
  - **PR3:** PatrÃ³n B (5 handlers con I/O externo) + tests â€” revisiÃ³n aislada
  - (validaciÃ³n manual: Neon branch + concurrencia)
  - **PR4:** FORCE ROW LEVEL SECURITY â€” solo despuÃ©s de validaciÃ³n
- **Deuda tÃ©cnica:** 229 tests (90 storefront + 139 admin). Tras reescritura de tests de Fase B, subirÃ¡ ~11 archivos

---

---

## 2026-07-14 â€” Fase 0: pnpm test en CI workflow

- **Branch:** `ci-add-pnpm-test`
- **Cambio:** una lÃ­nea agregada en `.github/workflows/ci.yml` â€” `- run: pnpm test` despuÃ©s de `pnpm build`, reusando el `.env.local` del paso anterior.
- **VerificaciÃ³n:** 289/289 tests pasan en CI local. `turbo.json` ya tenÃ­a el task `test` definido.
- **PR:** https://github.com/luisavilaland/landaetastudio-saas/pull/new/ci-add-pnpm-test

---

## Estado actual (14 de julio 2026)

| MÃ©trica      | Valor                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Tests        | 289 pasando, 0 fallos                                                                           |
| Apps         | storefront, admin, superadmin                                                                   |
| Servicios    | Neon, Upstash, R2, Resend                                                                       |
| Deploy       | Vercel (3 apps)                                                                                 |
| Rama default | `develop`                                                                                       |
| Build        | Limpio (sin `ignoreBuildErrors`)                                                                |
| CI           | GitHub Actions (lint, typecheck, build, **test**)                                               |
| RLS          | Decorativo â€” `withTenantContext` roto (SET LOCAL en auto-commit). Plan P1-1 listo para ejecutar |

**Deuda tÃ©cnica resuelta:**

- âœ… P0 Security Hotfix: 12 handlers con filtrado manual `tenantId`
- âœ… P1-3: 7 archivos de test de regresiÃ³n para 6 hotfixes P0
- âœ… Bug `getEnrichedItems` sin `await` en cart PUT/DELETE (raÃ­z de bug productivo)
- âœ… Bug contaminaciÃ³n mocks webhooks (mockReturnValueOnce no consumido)
- âœ… Plan P1-1 diseÃ±ado con 4-PR execution plan, transacciones angostas, validaciÃ³n contra DB real
- âœ… Fase 0: `pnpm test` agregado al CI workflow

---

## 2026-07-14 â€” PR2: Wire withTenantContext en handlers PatrÃ³n A + tests

- **Branch:** `feat-p1-1-patron-a`
- **withTenantContext corregido:** ahora usa `db.transaction(async (tx) => { tx.execute(SET LOCAL); return cb(tx); })` en lugar de `db.execute()` auto-commit. SET LOCAL + queries en misma transacciÃ³n.
- **21 handlers wireados con PatrÃ³n A** (sin I/O externo) â€” todos envueltos en `withTenantContext(tenantId, async (tx) => {...})`.
- **products/import:** transacciÃ³n POR FILA (cada fila su propio `withTenantContext`), preservando Ã©xito parcial en CSV bulk import.
- **Bug descubierto:** `return withTenantContext(...)` sin `await` hace que rejections de la transacciÃ³n bypassean el `try/catch` del handler. En handlers con catch block (variants 409 FK, Ã³rdenes, etc.), las excepciones no se capturaban correctamente. Fix: `return await withTenantContext(...)` en los 21 handlers.
- **Test fixes:** el approach original de mockear `db.transaction` no funciona porque `withTenantContext` cierra sobre el `db` real del mÃ³dulo. Todos los tests ahora mockean `withTenantContext` directamente con `makeTxMock()`.
- **MakeTxMock centralizado:** patrÃ³n con `select`, `insert`, `update`, `delete`, `execute` mockeados, casteado `as any` para compatibilidad con `DbLike`.
- **Storefront shipping test fix:** el mock de `drizzle-orm` reemplazaba TODO el mÃ³dulo solo con `eq` y `asc`, rompiendo la importaciÃ³n de `relations` en `@repo/db/schema`. Fix: `vi.mock("drizzle-orm", async () => ({ ...actual, eq: vi.fn(), asc: vi.fn() }))`.
- **Assertions `toHaveBeenCalledWith`:** agregadas en tests cross-tenant de 3 archivos (orders `[id]`, shipping `[id]`, variants â€” 6 tests) para verificar que `withTenantContext` se llama con el tenant correcto. Ãšnica excepciÃ³n: el test "400 validaciÃ³n falla" de variants, donde Zod rechaza el body antes de llegar a `withTenantContext`.
- **VerificaciÃ³n:** lint âœ… | typecheck 8/8 âœ… | tests 289/289 âœ… (22 fix, 0 regresiones)
- **22 tests resueltos** que antes fallaban por `ECONNREFUSED` o mock contamination.

**Deuda tÃ©cnica resuelta:**

- âœ… `withTenantContext` wiring completo en 21 handlers PatrÃ³n A
- âœ… Bug `return withTenantContext` sin `await` (bypass de try/catch en todos los handlers)
- âœ… Storefront shipping test suite roto por mock de `drizzle-orm`
- âœ… Tests de shipping/[id], orders/[id], variants, products/[id] DELETE con mock de `withTenantContext`

---

## 2026-07-15 â€” PR3: Wire withTenantContext en handlers PatrÃ³n B (I/O externo) + tests

- **Branch:** `feat-p1-1-patron-b`
- **5 handlers PatrÃ³n B wireados** â€” los que tienen I/O externo intercalado entre DB ops, requiriendo mÃºltiples `withTenantContext`:
  - **Webhook:** `external_reference` compuesto `${tenantId}:${orderId}`, email fuera del contexto, dev mode magic IDs preservados
  - **Checkout/preference:** `external_reference` compuesto, single context para 4 lecturas, guard `orderId` (const) para TS closure
  - **Images POST:** dos contextos (read â†’ upload â†’ read+insert), FK violation 23503 â†’ 409 (TOCTOU entre contextos)
  - **Images GET:** single context (PatrÃ³n A â€” se cayÃ³ entre PR2 y PR3, ahora incluido)
  - **Images DELETE:** dos contextos (read â†’ delete S3 â†’ delete DB)
  - **Register:** dos contextos (check email + tenant â†’ hash â†’ insert), `console.error` â†’ `logger.error`, UK 23505 â†’ 409
- **`withTenantContext` assertions:** agregadas en checkout (5 tests), register (1 test), images (GET 1 test)
- **Images test file reescrito completamente:** 11 tests (GET 3, POST 3, DELETE 5) â€” reemplaza 8 tests inline que nunca ejercitaban los handlers reales
- **Tests checkout y register migrados** a mock de `withTenantContext` (11 + 5 tests)
- **VerificaciÃ³n:** lint âœ… | typecheck âœ… | tests **290/290** âœ… (+1 vs baseline)
- **Review de aprobaciÃ³n:** 4 hallazgos corregidos post-review:
  1. `console.error` â†’ `logger.error` en `images/[imageId]/route.ts` (bloqueante)
  2. Magic ID por `withTenantContext` con `external_reference` compuesto â€” confirmado como desviaciÃ³n intencional (mÃ¡s seguro que bypass total)
  3. Test FK 23503 â†’ 409 agregado en images POST
  4. Test UK 23505 â†’ 409 agregado en register
- **292 tests finales** (290 originales + FK + UK)

**Deuda tÃ©cnica pendiente:**

- âŒ FORCE ROW LEVEL SECURITY â€” PR4 (validaciÃ³n manual en Neon branch + concurrencia)
- âŒ `docs/arquitectura.md` tiene 2 inexactitudes (AUTH_SECRET fallback, RLS). Pendiente migraciÃ³n a `docs/adr/`.

## Estado actual (15 de julio 2026)

| MÃ©trica          | Valor                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Tests            | 292 pasando, 0 fallos                                                               |
| Apps             | storefront, admin, superadmin                                                       |
| Servicios        | Neon, Upstash, R2, Resend                                                           |
| Deploy           | Vercel (3 apps)                                                                     |
| Rama default     | `develop`                                                                           |
| Build            | Limpio (sin `ignoreBuildErrors`)                                                    |
| CI               | GitHub Actions (lint, typecheck, build, test)                                       |
| PatrÃ³n A         | 21 handlers wireados con `withTenantContext`                                        |
| PatrÃ³n B         | 5 handlers wireados con `withTenantContext`                                         |
| RLS              | FORCE RLS en 8 tablas + `app_user` (sin BYPASSRLS)                                  |
| ConexiÃ³n runtime | `DATABASE_APP_URL` (app_user), `DATABASE_URL` (neondb_owner solo build/migraciones) |

---

## 2026-07-15 â€” Fase B: Seed con dos tenants para validaciÃ³n RLS cross-tenant

- **MotivaciÃ³n:** La Fase C (validaciÃ³n RLS en Neon branch) requiere al menos 2 tenants con datos para probar que `set_tenant_id` dentro de transacciÃ³n filtra correctamente.
- **Seed modificado:** se agregÃ³ un segundo tenant (`tienda2` / "Tienda Premium") con productos distintos (Campera Premium, Zapatillas Runner, Mochila Urbana), su propio admin, categorÃ­as, variantes, imÃ¡genes, cliente, Ã³rdenes y mÃ©todos de envÃ­o.
- **SKUs de tenant 2 diferenciados:** `CAMP-*`, `ZAPA-*`, `MOCH-*` â€” sin conflicto con tenant 1.
- **VerificaciÃ³n:** lint âœ… | typecheck âœ… | build 3/3 âœ… | commit `2000107`
- **PrÃ³ximos pasos:**
  - Fase C: correr `pnpm db:seed` contra Neon branch y re-ejecutar batches de verificaciÃ³n RLS
  - Fase D: pruebas de concurrencia contra la branch
  - PR4: `ALTER TABLE ... FORCE ROW LEVEL SECURITY`

---

## 2026-07-15 â€” Fase C + R1: App User Role y FORCE RLS validados

- **Hallazgo crÃ­tico:** `neondb_owner` tiene `rolbypassrls=true` â€” ni `ENABLE RLS` ni `FORCE ROW LEVEL SECURITY` tienen efecto porque el rol de conexiÃ³n bypassea las polÃ­ticas a nivel de rol, no de tabla. RLS era completamente decorativo.
- **SoluciÃ³n documentada por Neon:** usar un rol de aplicaciÃ³n dedicado sin `BYPASSRLS`, manteniendo `neondb_owner` solo para tareas administrativas (migraciones, seed).
- **Fase C (branch `fase-c-verificacion`):**
  - Creado `app_user` con grants explÃ­citos (tabla por tabla: 10 tablas de negocio) + `EXECUTE` sobre `set_tenant_id(UUID)`
  - Verificado: `rolbypassrls=false`, `rolsuper=false` en el nuevo rol
  - Aplicado `0010_force_rls.sql` (FORCE RLS en 8 tablas de negocio)
  - **B2:** tenant 1 â†’ 3 productos (Gorra, PantalÃ³n Jeans, Remera BÃ¡sica) âœ…
  - **B3:** tenant 2 â†’ 3 productos distintos (Campera Premium, Mochila Urbana, Zapatillas Runner) âœ…
  - **B4:** app_user sin context â†’ **0 productos** (el owner ya no bypassea) âœ…
  - **B5:** UUID inexistente â†’ **0 productos** âœ…
- **R1 (rama `feat/app-user-role`):** 4 cambios preparatorios para usar `app_user` en runtime:
  1. `packages/db/src/index.ts`: `DATABASE_APP_URL` requerida (sin fallback â€” `throw` si falta)
  2. `packages/validation/src/env.ts`: `DATABASE_APP_URL: z.string().url()` requerida
  3. `apps/superadmin/app/api/tenants/[id]/route.ts`: DELETE envuelto en `withTenantContext(params.id, ...)` â€” necesario porque al usar `app_user` con FORCE RLS, las queries sobre tablas protegidas necesitan el `tenantId` seteado para matchear las filas del tenant a eliminar. El callback usa `ctxTx` (alias consistente con el resto del codebase).
  4. `.github/workflows/ci.yml`: agregado `echo "DATABASE_APP_URL=..."` al bloque de variables dummy para build
- **`admin_users` sin RLS confirmado como intencional:** el `authorize()` de NextAuth busca por email global (sin tenant) porque no sabe a quÃ© tenant pertenece el usuario hasta despuÃ©s de encontrarlo. Agregarle RLS crearÃ­a un huevo y la gallina.
- **Superadmin GET/PUT confirmados sin tocar tablas RLS:** grep verifica que las 23 referencias a `dbProducts`, `dbProductVariants`, etc. estÃ¡n todas dentro del DELETE handler.
- **Fase D (16 jul):** pruebas concurrentes contra preview Vercel con `app_user`@`fase-c-verificacion`. Todos los escenarios verificados:
  - 10 GET concurrentes alternando tienda1/tienda2 â†’ 200 âœ… ~330ms avg
  - 10 search concurrentes alternando â†’ 200 âœ… producto correcto por tenant
  - POST imagen (dos contextos: readâ†’uploadâ†’read+insert) + GET â†’ 201 âœ…, tenantId correcto
  - Register POST (dos contextos: readâ†’insert) â†’ 201 âœ…
  - Aislamiento cross-tenant verificado sin data leak âœ…
- **R3 (16 jul):** `app_user` creado en Neon producciÃ³n con password fuerte, `rolbypassrls=false`
- **R4 (16 jul):** `DATABASE_APP_URL` seteada en Vercel (3 projects, Production+Preview+Development)
- **Hallazgo de PowerShell:** el register devolvÃ­a 500 por JSON malformado al pasar strings inline desde PowerShell. Usar `-d @archivo.json` o `--data-raw` como workaround.
- **VerificaciÃ³n:** lint âœ… | typecheck 8/8 âœ… | tests 291/292 âœ… (1 pre-existing failure en register â€” store URL)
- **Pendiente:** mergear `feat/app-user-role` â†’ `develop` (R1), aplicar migraciÃ³n 0010 FORCE RLS en producciÃ³n (R2), re-seed (R5)

---

## 2026-07-16 â€” Register test fix + DoD housekeeping

- **Register test arreglado:** el 4to argumento de `sendWelcomeEmail` esperaba `undefined` pero recibÃ­a `process.env.STOREFRONT_URL` en CI. Se seteÃ³ `process.env.STOREFRONT_URL` en el test y se actualizÃ³ la expectativa.
- **VerificaciÃ³n:** lint âœ… | typecheck 8/8 âœ… | build storefront âœ… | tests 292/292 âœ…
- **State:** develop â€” limpio, pasando todos los checks

---

## 2026-07-16 â€” Hotfix: checkout/route.ts sin withTenantContext (incidente en producciÃ³n)

- **Incidente confirmado:** `checkout/route.ts` usaba `db.select()` y `db.transaction()` sin `withTenantContext`. Con FORCE RLS + app_user (sin BYPASSRLS), `current_setting('app.tenant_id', true)` devuelve NULL, la polÃ­tica RLS evalÃºa `tenantId = NULL` para todas las filas, y cada query retorna 0 filas â€” todo intento de compra fallaba con "Stock insuficiente".
- **Causa raÃ­z:** el handler nunca apareciÃ³ en los inventarios de PR2 (PatrÃ³n A) ni PR3 (PatrÃ³n B). QuedÃ³ fuera del wiring de `withTenantContext` desde el inicio de P1-1.
- **Fix:** reemplazado `db.select().from()` + `db.transaction()` por un Ãºnico `withTenantContext(tenantId, async (tx) => {...})` que envuelve todas las DB ops (lectura de variantes, lectura de shipping, stock update, inserciÃ³n de orden + items). Dentro del callback, errores de negocio (stock, shipping) se retornan como objetos y se traducen afuera a `NextResponse.json()`.
- **Tests migrados:** el test mockea `withTenantContext` en vez de `db.transaction`, con mock chain completa (`.select().from().where()` para variantes, `.select().from().where().limit()` para shipping, `.update().set().where()`, `.insert().values().returning()`).
- **9 tests en checkout**, assertions de `withTenantContext` en happy paths.
- **VerificaciÃ³n:** lint âœ… | typecheck 8/8 âœ… | build storefront âœ… | tests 292/292 âœ…
- **27 handlers wireados con withTenantContext** (21 PatrÃ³n A + 5 PatrÃ³n B + checkout). NingÃºn handler de storefront queda sin contexto de tenant.

---

## 2026-07-17 â€” P1-2: MigraciÃ³n de ADRs + verificaciÃ³n contra cÃ³digo

- **docs/arquitectura.md migrado a ADRs individuales:** 20 ADRs (ADR-001 a ADR-020) en `docs/adr/` con formato estÃ¡ndar (tÃ­tulo, fecha, contexto, decisiÃ³n, estado, consecuencias).
- **VerificaciÃ³n contra cÃ³digo:** cada ADR fue verificada contra el cÃ³digo real. 14/20 aceptadas sin discrepancias, 6 con discrepancias documentadas (ninguna urgente):
  - ADR-008: storeSettingsSchema local + CSV import sin Zod
  - ADR-013: documentaciÃ³n desactualizada (store_settings vs inline JSONB)
  - ADR-017: el patrÃ³n de tests evolucionÃ³ â€” 59% importan handlers reales (mejora)
  - ADR-020: normalizeSlug duplicado en CSV import
  - ADR-001: checkout hotfix documentado histÃ³ricamente
  - ADR-007: omisiÃ³n menor de logger package
- **docs/arquitectura.md** convertido a tabla Ã­ndice con links a cada ADR + convenciones clave.
- **Deuda del P0 completamente saldada:** migraciÃ³n de ADRs + verificaciÃ³n contra cÃ³digo completada.
- **Branch:** `p1-2/adrs` (Paseo worktree)

**Deuda tÃ©cnica documentada (nueva):**

- âŒ **Fechas sin UTC explÃ­cito:** el schema usa `timestamp` sin timezone. Sin mitigaciÃ³n â€” depende de que el entorno de despliegue estÃ© en UTC. Pendiente: migrar a `timestamptz` o validaciÃ³n Zod de UTC en inserts.
- âŒ _*console.* sin migrar:_* ~49 instancias de `console.error`/`console.log` en apps/ que aÃºn no usan `@repo/logger`. Pendiente: barrido completo de apps/ (excluye seed.ts que es intencional).

---

## 2026-07-20 â€” MigraciÃ³n UTC: timestamptz + deuda tÃ©cnica de snapshots

- **Fase 1 (validaciÃ³n) completa:** branch efÃ­mera `utc-validation` contra Neon. 18/18 columnas migradas a `timestamptz` en 1.6s sin pÃ©rdida de datos. ALTER es idempotente sobre columna ya `timestamptz`.
- **Fase 2 (schema + migraciÃ³n) completa:**
  - `packages/db/src/schema.ts`: 18 columnas con `{ withTimezone: true }`
  - `packages/db/migrations/0011_timestamptz.sql`: SET TIME ZONE 'UTC' + SET statement_timeout = '10s' + 18 ALTER TYPE
  - `meta/0011_snapshot.json` generado (parcheado desde 0008)
  - `meta/_journal.json`: idx 11 registrado con `breakpoints: true`
- **Snapshots 0003-0004 y 0009 confirmados perdidos** del historial de git (nunca trackeados). Snapshots 0005-0008 estaban en disco del repo principal pero no trackeados en git.
- **`pnpm db:generate` produce migraciones incorrectas** si faltan snapshots intermedios. Al restaurar 0005-0008, genera solo ALTER TYPE (correcto).
- **typecheck âœ…, 292/292 tests âœ…, lint âœ…**
- **Branch:** `feat/utc-migration` (Paseo worktree)

**Deuda tÃ©cnica documentada (nueva):**

- âŒ **drizzle-kit snapshots 0003-0004 perdidos por gitignore:** causa raÃ­z confirmada â€” `.gitignore` tenÃ­a `packages/db/migrations/*` y `packages/db/migrations/meta/*.json`, lo que excluÃ­a silenciosamente cualquier archivo nuevo de migraciones o snapshots de `git add`. Desde que esa regla se agregÃ³, toda migraciÃ³n generada despuÃ©s quedaba fuera de control de versiones sin que quien la generara lo notara. Corregido en este mismo commit (lÃ­neas eliminadas). Los snapshots 0005-0008 (que estaban en disco pero no en git) y 0011 ya estÃ¡n agregados.

**Deuda tÃ©cnica resuelta:**

- âœ… **Fechas sin UTC explÃ­cito:** schema migrado a `timestamptz`. MigraciÃ³n 0011 aplicada contra producciÃ³n (Fase 3) el 2026-07-20 â€” 18 columnas en 1.3s, datos preservados, sin NULLs.

---

## 2026-07-24 â€” @repo/test-utils: helpers de test centralizados

- **`packages/test-utils/` creado** con tres helpers: `makeTxMock(config?)`, `session(tenantId, email?)`, `mockReq(method, body?, headerOverrides?)`.
- **12 archivos de test migrados** de helpers inline a `@repo/test-utils`:
  - **storefront (6):** shipping, webhooks/mercadopago, cart, checkout, checkout/preference, register
  - **admin (5):** orders/[id], shipping/[id], products/[id], products/[id]/variants, products/[id]/images
  - **superadmin (1):** tenants
- **Patrones migrados:** `makeTxMock` inline (9 archivos), `makeRequest`/`mockReq` inline (7 archivos), `session` inline (3 archivos), `setupTxRead`/`setupTxInsert`/`setupTx*` (2 archivos).
- **`makeTxMock` con `{ select: [...] }`**: soporta config para selects secuenciales con `terminal: "where" | "limit" | "orderBy"`, probado contra casos reales de checkout/preference (4 selects heterogÃ©neos) e images (limit + orderBy).
- **`mockReq` con `headerOverrides`**: para tests que necesitan headers custom (x-forwarded-for en rate limiting).
- **`mockReq` sin `NextRequest` en firma**: retorna `as any` para evitar conflicto de tipos entre next@14 y next@16.
- **lint âœ…, typecheck âœ…, build âœ…, 292/292 tests âœ…**
- **AGENTS.md actualizado** con secciÃ³n de helpers de test.
- **Branch:** `feat/test-utils` (Paseo worktree)

---

## 2026-07-25 â€” @repo/test-utils post-review: 3 bugs corregidos

- **Bug 1 (versiones):** `packages/test-utils/package.json` tenÃ­a `next: ^14` y `vitest: ^2` â€” el monorepo usa next@16 y vitest@4. Corregido: `^16.0.0` y `^4`.
- **Bug 2 (queue exhaustion):** `repeatLastSelect` declarado en `MakeTxMockConfig` pero nunca leÃ­do. Cuando se excede la cola de `select()`, ahora lanza `Error("queue exhausted for select()...")`. Solo `select`/`from` lanzan error (no `where`/`limit`/`orderBy`, que son compartidos con `delete()`/`update()`).
- **Bug 3 (insert huÃ©rfano):** opciÃ³n `insert` en `MakeTxMockConfig` pero 0 de 12 archivos migrados la usaban. Eliminada.
- **`mockReq` restaurado con `NextRequest` real**: al alinear versiones de next, desaparece el conflicto de tipos. Ahora retorna `NextRequest` (no `as any`).
- **Unit test agregado:** `packages/test-utils/src/__tests__/makeTxMock.test.ts` â€” 9 tests: auto-encadenamiento, queue exhaustion (select/from), repeatLastSelect, mÃºltiples entradas secuenciales.
- **VerificaciÃ³n:** lint âœ…, typecheck âœ…, build âœ…, **301/301 tests** (era 292, +9 del unit test nuevo). **33/33 test files** (era 32).

---

## 2026-07-25 â€” Coverage Audit: Contract tests â†’ reales, endpoints faltantes, packages sin cobertura

- **Branch:** `feat-coverage-ab` (Paseo worktree)
- **Objetivo:** cerrar brechas de cobertura real identificadas por audit de grafo de imports.
- **Task 1.1 (categories/route):** migrado de contrato a real importando `{ GET, POST }` desde `"../route"` usando `mockReq`, `session`, `makeTxMock`. 8 tests (reemplaza 12 inline).
- **Task 1.2 (categories/[id]/route):** migrado a real. 12 tests (reemplaza 6 inline).
- **Task 1.3 (dashboard/route):** migrado a real. Incluye `tx.leftJoin` manual (gap de `makeTxMock`). 5 tests (reemplaza 6 inline).
- **Task 1.4 (orders/route):** migrado a real con `leftJoin` en mock. 6 tests (reemplaza 17 inline).
- **Task 1.5 (products/route):** migrado a real con FormData mock para POST. 7 tests.
- **Task 1.6 (products/import):** debug migrado â€” mock File causaba 500. Fix: usar `new File([csv], ...)` nativo. 11 tests testeados y pasando.
- **Task 1.7 (shipping/route):** migrado a real. 7 tests (3 GET + 4 POST).
- **Task 1.9 (search/route, storefront):** migrado a real. Handler complejo con 4 queries (leftJoin, groupBy, orderBy, limit, offset). Mock manual de tx con chaining secuencial. 6 tests (reemplaza 13 inline).
- **Grupo 2 (6 endpoints sin test):** tests agregados para `domain-check` (admin + superadmin), `config/tenant`, `config/tenant/domain`, `config/settings`, `products/[id]/images/[imageId]`. 29 tests en 6 archivos.
- **Grupo 3 (3 packages sin cobertura):** tests para `@repo/logger` (2), `@repo/db/schema` (10 â€” verificaciÃ³n de todas las tablas), `@repo/auth` (7 â€” exports, configuraciÃ³n NextAuth). 19 tests en 3 archivos.
- **Hallazgos tÃ©cnicos:**
  - `mockReq` no expone `request.url` â€” handlers que acceden a `new URL(request.url)` requieren parche `(req as any).url = urlStr`
  - Cadenas con `.leftJoin()` requieren `tx.leftJoin = vi.fn().mockReturnValue(tx)` (gap de `makeTxMock`)
  - `makeTxMock` no soporta terminal `"offset"` â€” cadenas con `.limit().offset()` requieren mock manual
  - `vi.mock(path, { db: undefined })` produce `db = undefined` en runtime â€” no se puede asignar propiedades. Usar `vi.hoisted()` para mock mutable.
- **VerificaciÃ³n final:** lint âœ… | typecheck 9/9 âœ… | build 3/3 âœ… | **321/321 tests, 42/42 test files** (+20 tests, +9 files vs baseline)

---

## 2026-07-26 â€” Grupo 3 Completo: 6 packages restantes

- **3.1 (@repo/db index.ts â€” withTenantContext):** 6 tests crÃ­ticos â€” verifica que llama `db.transaction`, ejecuta `set_tenant_id` dentro, pasa tx al callback, propaga errores. Mock de `postgres` + `drizzle-orm/postgres-js` para evitar conexiÃ³n real.
- **3.2 (@repo/commerce cart.ts):** 9 tests â€” `getCart` (session vacÃ­a, sin datos Redis, carrito vacÃ­o, enrich, variantes faltantes) + `removeFromCart` (remover Ã­tem, Ãºltimo Ã­tem â†’ del, session vacÃ­a, carrito inexistente).
- **3.4 (@repo/commerce email.ts):** 6 tests â€” `sendOrderConfirmationEmail` (envÃ­o, no lanza error) + `sendWelcomeEmail` (con URL, sin URL, error silencioso).
- **3.5 (@repo/commerce tenant.ts):** 4 tests â€” `getTenantId` (slug presente, ausente, vacÃ­o, slug no existe).
- **3.6 (@repo/storage index.ts):** expandido de 1â†’5 tests â€” `storageClient` export, `getPublicUrl`, `uploadImage` (putObject llamado, URL retornada), `deleteImage` (con fileName, sin fileName).
- **3.7 (@repo/validation env.ts):** 1 test â€” `validateEnv` no lanza con vars actuales.
- **3.8 (@repo/validation schemas.ts):** expandido de 7â†’34 tests â€” todos los schemas de negocio validados (createProduct, updateProduct, variant, variantsArray, createCategory, updateCategory, updateOrderStatus, addCartItem, updateCartItem, deleteCartItem, checkoutPreference, shippingDetails, dashboardQuery, createTenant, register, webhook, productImage, createShippingMethod).
- **Hallazgos:** `vi.fn().mockImplementation(() => ({}))` no funciona con `new` â€” usar `function()` en lugar de arrow. `dashboardQuerySchema.parse({})` retorna `{}` (opcionales ausentes), no con `null`s.
- **Plan original completado al 100% â€” todos los items de Grupo 1, 2 y 3.**
- **VerificaciÃ³n final:** lint âœ… | typecheck 9/9 âœ… | build 3/3 âœ… | **378/378 tests, 47/47 test files** (+57 tests, +5 files vs baseline anterior)

---

## 2026-07-28 â€” RLS Coverage Fix: withTenantContext en 6 archivos + tests

- **Branch:** `feat/coverage-ab` (Paseo worktree, continuado)
- **Contexto:** AuditorÃ­a profunda revelÃ³ que 6 archivos usaban `db.*` directo en tablas RLS sin `withTenantContext`. RLS con `missing_ok=true` (NULL) bloquea TODAS las filas â†’ storefront completamente roto en `develop`. Sin trÃ¡fico real, sin explotaciÃ³n cross-tenant.
- **Fase 1 (categories.ts):** `getCategoriesForTenant` envuelto en `withTenantContext`.
- **Fase 2 (products.ts):** `getProducts`, `getProductBySlug` envueltos. L173/L179: agregado `eq(dbProductVariants.tenantId, tenantId)` y `eq(dbProductImages.tenantId, tenantId)` â€” no depender solo de RLS.
- **Fase 3 (cart.ts):** `getCart(sessionId, tenantId)`, `removeFromCart(sessionId, variantId, tenantId)` â€” nuevo parÃ¡metro `tenantId`, DB envuelto. Caller `cart/page.tsx` resuelve tenantId desde header `x-tenant-slug` + lookup `dbTenants`.
- **Fase 4 (admin/products/[id]/route.ts):** GET + PUT envueltos. PUT: `db.transaction` propio eliminado (redundante con `withTenantContext`). R2 uploads/deletes quedan dentro del callback.
- **Fase 5 (storefront/cart/route.ts):** POST, PUT, DELETE, GET envueltos. `getEnrichedItems` recibe `tx` opcional (tipo `any` para compatibilidad DbLike vs PostgresJsDatabase).
- **Fase 6 (tests):** 3 test files migrados (`cart.test.ts`, `products.test.ts`, `categories.test.ts`) de mock `db.select` a `withTenantContext` + `makeTxMock`. AdemÃ¡s `admin/products/[id]/route.test.ts` (GET/PUT) y `storefront/cart/route.test.ts` (7 tests).
- **Hallazgos:**
  - `makeTxMock` no tiene `innerJoin` â€” usar `createQuery` local como fallback para cadenas con join
  - `withTenantContext` ya mockeado en DELETE tests desde PR3; GET/PUT no
  - `removeFromCart` sin callers de producciÃ³n â€” cambio de firma seguro
- **VerificaciÃ³n final:** lint 6/6 âœ… | typecheck 9/9 âœ… | tests 47/47, **379/379** (+1 test vs baseline: tenantId vacÃ­o en cart.test.ts)

---

## 2026-07-29 â€” Fase 1: Infraestructura E2E con Playwright

- **Branch:** `feat/e2e-playwright` (Paseo worktree, branch off develop)
- **InstalaciÃ³n:** `pnpm add -D -w @playwright/test` (v1.62.0)
- **`e2e/playwright.config.ts`:** 6 projects (setup, storefront, checkout, admin, superadmin, security) con `baseURL` por proyecto, `storageState` para admin/superadmin/security, `fullyParallel: false`, `workers: 1`
- **`e2e/global-setup.ts`:** login real admin en `http://localhost:3001/login` y superadmin en `http://localhost:3002/login`, guarda `storageState` en `e2e/.auth/admin.json` y `e2e/.auth/superadmin.json`
- **Directorios creados:** `e2e/storefront/`, `e2e/checkout/`, `e2e/admin/`, `e2e/superadmin/`, `e2e/security/`, `e2e/setup/`
- **Scripts en root package.json:** `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:e2e:report`
- **.gitignore:** `e2e/.auth/`, `e2e/test-results/`, `e2e/playwright-report/`
- **.env.local:** `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`
- **Commit:** `4c5fde2` â€” "feat: E2E infraestructura Playwright â€” config, global-setup, scripts"

---

## Estado actual (29 de julio 2026)

| MÃ©trica      | Valor                                                               |
| ------------ | ------------------------------------------------------------------- |
| Tests        | 379 pasando, 0 fallos                                               |
| E2E          | Infraestructura lista (0 specs aÃºn)                                 |
| Apps         | storefront, admin, superadmin                                       |
| Servicios    | Neon, Upstash, R2, Resend                                           |
| Deploy       | Vercel (3 apps)                                                     |
| Rama default | `develop`                                                           |
| Build        | Limpio (sin `ignoreBuildErrors`)                                    |
| CI           | GitHub Actions (lint, typecheck, build, test)                       |
| RLS          | Activo con `app_user`, 27 handlers wireados con `withTenantContext` |

- **Problema detectado en code review:** `uploadImage`/`deleteImage` quedaron dentro del `withTenantContext`, dejando una transacciÃ³n PG abierta durante operaciones R2 (mismo anti-pattern que ya corregimos en `images/route.ts`).
- **SoluciÃ³n:** Separar PUT en tres fases:
  1. **Phase 1** (read + validate): `withTenantContext` â†’ fetch product, validar categorÃ­a/slug/SKU, computar fields plan
  2. **Phase 2** (R2): fuera de toda transacciÃ³n â†’ `uploadImage`/`deleteImage`
  3. **Phase 3** (write): `withTenantContext` â†’ ejecutar updates/inserts + refetch
- **Adicional:** `tx` en `getEnrichedItems` cambiÃ³ de opcional a obligatorio, eliminando el fallback silencioso a `db` global. Removido `import { db }` del cart route.
- **Grep ampliado:** cubriÃ³ `packages/auth/`, `packages/storage/`, `packages/validation/`, `packages/logger/`, `packages/test-utils/`, `packages/commerce/`, `apps/superadmin/` â€” 0 matches.
- **VerificaciÃ³n final:** lint 6/6 âœ… | typecheck 9/9 âœ… | tests 47/47, 379/379 âœ…
- **Deuda tÃ©cnica (TOCTOU):** Entre Phase 1 (read) y Phase 3 (write) del PUT de `products/[id]` hay una ventana donde el producto pudo haber sido borrado â€” el UPDATE afecta 0 filas sin error, y el re-fetch devuelve array vacÃ­o, terminando en 200 con cuerpo vacÃ­o. Probabilidad baja (admin de 1 tenant, ventana de segundos), pero no hay catch de FK violation (`23503`) como sÃ­ tiene `images/route.ts`. Queda pendiente para una sesiÃ³n futura de hardening.

---

## 2026-07-30 â€” E2E Vercel-ready + CI workflow

- **ParametrizaciÃ³n URLs:** `playwright.config.ts` y `global-setup.ts` leen `E2E_STOREFRONT_URL`, `E2E_ADMIN_URL`, `E2E_SUPERADMIN_URL` de env vars con fallback a localhost.
- **CI workflow:** `.github/workflows/e2e.yml` â€” trigger en PR a develop, espera previews Vercel, seed en Neon, ejecuta E2E, comenta resultado en PR.
- **Helper script:** `scripts/get-vercel-preview-url.js` â€” obtiene URL del preview deployment vÃ­a API de Vercel.
- **Env vars documentadas:** en `.env.local.example` y `.env.local`.

## 2026-08-06 â€” E2E con dominios custom asignados a la rama

- **Estrategia cambiada:** se asignan `*.landaetastudio.com`, `admin.landaetastudio.com` y `superadmin.landaetastudio.com` al branch `feat/e2e-playwright` en Vercel. URLs fijas en CI; el proxy resuelve tenant por subdominio (`tienda1.landaetastudio.com`), sin `DEFAULT_TENANT_SLUG`.
- **playwright.config.ts movido a la raÃ­z** y `testMatch` corregidos (eran relativos a `testDir`). Se eliminÃ³ el proyecto `setup` vacÃ­o que causaba "No tests found".
- **Fix cross-tenant:** `e2e/security/cross-tenant.spec.ts` reescrito para testear el diseÃ±o original (admin T1 â†’ GET/PUT/DELETE de producto T2 vÃ­a API admin â†’ 403/404). Agregada `E2E_STOREFRONT_T2_URL`.
- **CI simplificado:** eliminado `scripts/get-vercel-preview-url.js` y el job de Vercel API. Reemplazado por job `wait-for-deployments` (poll de los 3 dominios custom).
- **NEXTAUTH_URL confirmada como no requerida:** Auth.js v5 auto-activa `trustHost` en Vercel; solo Credentials + JWT.
- **Secrets GitHub necesarios:** `NEON_DATABASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`. Ya no hace falta `VERCEL_TOKEN`.
- **Fix global-setup post-login:** el job `e2e` de CI fallaba en `e2e/global-setup.ts:19` con `TimeoutError` â€” el login funcionaba pero `waitForURL` exigÃ­a la URL exacta `/` y la app redirige a `/dashboard` (admin) y `/tenants` (superadmin). Corregido con globs `**/dashboard` y `**/tenants`. En el run del commit `8c08e31`, `seed`, `wait-for-deployments`, `build` y Vercel quedaron en success; el fix de global-setup se valida en el siguiente run.

## 2026-08-06 â€” workflow_dispatch en e2e.yml + validez del fix bloqueada por incidente de GitHub Actions

- **Incidente externo GitHub Actions** desde 2026-08-06 15:22 UTC (`major_outage`, crÃ­tico): webhooks throttled (~15%), runners asignÃ¡ndose jobs invÃ¡lidos, runs quedando `queued` con 0 jobs. Primer `run de validaciÃ³n` del fix post-login (commit `b08c`-prev) nunca materializÃ³ jobs. No es fallo del repo.
- **`workflow_dispatch:` agregado al trigger de `e2e.yml`**: permite lanzar el workflow manualmente ("Run workflow") inmune al throttle de webhooks y a runs colgados que no ofrecen botÃ³n de re-run (un run `queued` con 0 jobs no muestra opciÃ³n de re-run porque el endpoint `POST /actions/runs/{id}/rerun` requiere al menos un job enlazado / context de UI). Con esto, una vez recuperado Actions, se cancela el run colgado y se dispara uno nuevo manual.
- **Reentry de validaciÃ³n postergada:** la validaciÃ³n del fix de global-setup (`c03f43b`) sigue pendiente mientras dure el `major_outage`. Cuando Actions quede `operational`, validar run E2E â†’ si verde, merge PR #40 â†’ `develop` y reasignar dominios custom a prod.

## 2026-08-06 â€” Fix bugs E2E: 11 fallos diagnosticados y corregidos (6 specs + config)

- **Run real de validaciÃ³n ejecutado** (trÃ¡s recuperarse Actions): 31 tests, 11 fallando. DiagnÃ³stico clasificado en 6 bugs deterministas de spec (corregidos) + fallos de entorno (lentitud cold-start Vercel, `page.goto` timeout 30s).
- **Fix 1 â€” `e2e/storefront/auth.spec.ts`:**
  - Login "credenciales vÃ¡lidas" usaba `admin@tienda1.com` â€” es un **admin**, pero la auth de storefront valida contra `customers` (`apps/storefront/lib/auth.ts`). El login fallaba y nunca redirigÃ­a. Cambiado a **`cliente@ejemplo.com`** (customer real del seed).
  - Test `/perfil sin auth redirige a login` era **incorrecto**: `/perfil` es la pÃ¡gina pÃºblica de la tienda (`perfil/page.tsx`), no una ruta protegida. Reemplazado por validaciÃ³n real: `/perfil` muestra el nombre del tenant **"Tienda Demo"** (`getByRole("heading", { name: "Tienda Demo" })`).
- **Fix 2 â€” `e2e/storefront/register.spec.ts`:** email "ya existente" usaba `admin@tienda1.com` (no es customer â†’ no devolvÃ­a 409). Cambiado a **`cliente@ejemplo.com`** para que register devuelva 409 y muestre `register-error`.
- **Fix 3 â€” 3 specs admin (categories, products-crud, settings):** `locator("h1")` daba **strict-mode violation** porque el layout `(dashboard)/layout.tsx` renderiza `h1` "Admin" + el tÃ­tulo de pÃ¡gina. Reemplazado por `getByRole("heading", { name })`.
- **Fix 4 â€” superadmin login en proyecto sin storageState:** el spec `superadmin/login.spec.ts` corrÃ­a bajo el proyecto `superadmin` con `storageState: superadmin.json` (ya autenticado por global-setup) â†’ `goto("/login")` redirige a `/tenants` y el form nunca aparecÃ­a. Movido a `e2e/superadmin-login/login.spec.ts` y creado proyecto `superadmin-login` **sin storageState** en `playwright.config.ts`.
- **Fix 5 â€” timeouts ampliados en `playwright.config.ts`:** `timeout: 60_000` (era default 30s) y `expect.timeout: 10_000` (era 5s) para tolerar lentitud cold-start Vercel.
- **VerificaciÃ³n pendiente:** re-run vÃ­a `workflow_dispatch` para confirmar los 6 fixes y distinguir si los fallos de `cart`/`checkout`/`crear-producto` eran entorno (deberÃ­an pasar) o bugs reales con 500s persistentes.
- **Branch:** `feat/e2e-playwright`

---

## 2026-08-07 â€” Round 2 E2E: fixes de aplicaciÃ³n/infra (auth RLS, cart, proxy, spec)

Tras re-run del round 1 quedaron 6 fallos: `auth`, `register`, `cart`, `checkout`, `crear-producto`. Se re-clasifica el diagnÃ³stico: 2 eran bugs reales de **cÃ³digo de aplicaciÃ³n** (auth contra RLS + proxy) y 4 de **infra/harness** (Redis). Correcciones aplicadas en `feat/e2e-playwright`:

- **Fix 1 â€” `apps/storefront/proxy.ts`:** el matcher del middleware no incluÃ­a `/api/auth`, asÃ­ que el login nunca pasaba por el middleware que inyecta `x-tenant-id` (necesario para resolver el tenant). Se agrega `/api/auth/:path*` al matcher.
- **Fix 2 â€” `apps/storefront/lib/auth.ts` + nuevo `lib/customer-auth.ts`:** el `authorize` de Credentials consultaba `customers` **sin** contexto RLS: con el rol `app_user` (sin BYPASSRLS), `dbCustomers` tiene RLS activo y la query devolvÃ­a 0 filas â†’ login siempre fallaba. Se traslada la lÃ³gica a `customer-auth.ts` con `authorizeCustomer(email, password, tenantId)` que envuelve la query en `withTenantContext(tenantId, cb)` (transacciÃ³n + `SET LOCAL set_tenant_id`), lookup tenant-escoped. Se aÃ±ade unit test `customer-auth.test.ts` (4 casos: vÃ¡lido, password incorrecto, customer inexistente, falta credenciales). El **test del endpoint `/api/cart`** se actualizÃ³ al cambiar `@/lib/redis` (el route ya no usa `redisClient`; ahora expone `safeGet`/`redisSetEx`/`redisDel`).
- **Fix 3 â€” `packages/commerce/src/redis.ts` + handlers de carrito:** se agregan wrappers progresivos `safeGet`/`redisSetEx`/`redisDel` que degradan (null/no-op + `warn`) en vez de tirar 500 cuando Redis estÃ¡ caÃ­do; `redisClient` con `enableOfflineQueue: false` para fallar rÃ¡pido. `packages/commerce/src/cart.ts` y `apps/storefront/app/api/cart/route.ts` usan ahora estos helpers â†’ en E2E sin Redis, el carrito se trata como vacÃ­o (200) en lugar de un 500.
- **Fix 4 â€” `e2e/admin/products-crud.spec.ts`:** el test "crear producto" no llenaba el campo obligatorio `stock`, por lo que el submit fallaba la validaciÃ³n y no navegaba a `/products`. Se agrega `page.fill("#stock", "10")`.
- **VerificaciÃ³n:** `pnpm lint` y `pnpm typecheck` en verde para `storefront` y `@repo/commerce`. Los unit tests que importan `@repo/db` (cart y customer-auth) requieren `DATABASE_APP_URL` en el entorno para cargar el mÃ³dulo; en el worktree local solo hay vars E2E, asÃ­ que la corrida unitaria depende del harness (CI/`workflow_dispatch` definen `DATABASE_APP_URL`).
- **Fix tests (CI `pnpm test` roto, 11 fallos en 2 archivos):**
  - `packages/commerce/src/__tests__/cart.test.ts` (7 fallos): el factory de `vi.mock("../redis")` exponÃ­a solo `redisClient.get/setex/del`, pero `cart.ts` pasÃ³ a importar `safeGet`/`redisSetEx`/`redisDel`. Re-mapeado el factory a los 3 helpers (`safeGet: mockRedisGet`, etc.), eliminando la envoltura `redisClient`.
  - `apps/storefront/lib/__tests__/customer-auth.test.ts` (4 fallos): `vi.mocked(bcrypt.compare).mockResolvedValue is not a function` â€” bcrypt no estaba mockeado. Fix: `vi.mock("bcryptjs", ...)` con patrÃ³n del test de register (factory `importOriginal` que expone **both** `default` y `compare` como `vi.fn()`, ya que `import bcrypt from "bcryptjs"` con esModuleInterop envuelve el objeto y `bcrypt.compare` quedaba `undefined` si el mock solo expone `compare`). Se elimina el cast previo `const compare` y se usa `vi.mocked(bcrypt.compare).mockResolvedValue(x as never)` (mismo idiom que `register`).
  - VerificaciÃ³n local: `cart.test.ts` 10/10, `customer-auth.test.ts` 4/4, typecheck 2/2.
- **Run E2E (despuÃ©s del fix de tests):** 29 passed, 1 failed, 1 skipped. El Ãºnico fallo restante era **flaky determinista** en `e2e/checkout/checkout.spec.ts`: `if (await addBtn.isEnabled())` se evalÃºa un instante tras navegar al producto â€” si el botÃ³n aÃºn no estÃ¡ enabled, **no agrega nada** y sigue; ademÃ¡s no esperaba el toast "Agregado al carrito" antes de `goto("/checkout")` (el POST `/api/cart`/cookie puede quedar en vuelo) â†’ `/checkout` queda vacÃ­o y no renderiza el formulario (`checkout-name`). Y `waitForSelector(..., 5000)` era corto para cold-start Vercel.
- **Fix checkout/cart determinista:** en `e2e/checkout/checkout.spec.ts` y `e2e/storefront/cart.spec.ts` se reemplaza el guard racy por `expect(addBtn).toBeEnabled({ timeout: 10_000 })` â†’ `click()` â†’ `expect("Agregado al carrito").toBeVisible()`, y en checkout se usa `expect(checkout-name).toBeVisible()` (timeout default 10s) en vez de `waitForSelector(5000)`. **MigraciÃ³n a runner self-hosted (AlmaLinux):**
  - `e2e.yml` (jobs `wait-for-deployments`, `seed`, `e2e`) y `ci.yml` (job `build`) â†’ `runs-on: self-hosted` (label default). Se evita depender de los minutes gratis de Actions.
  - Job `e2e`: `playwright install --with-deps chromium` (deps del sistema para AlmaLinux vÃ­a `dnf`).
  - **Guard anti-fork** en cada job self-hosted: `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`. El repo es pÃºblico y un runner self-hosted en repos pÃºblicos es vector RCE si corren PRs de forks; este guard los salta (push/workflow_dispatch/PR mismo repo corren normal).
  - Prerequisitos del runner: Node 22, pnpm, git, red a Neon + los 3 dominios Vercel.
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” Cierre de infra del seed en el runner self-hosted (mj20)

Los jobs `seed` y `e2e` del runner self-hosted (AlmaLinux, mÃ¡quina `mj20`) quedaron bloqueados por 3 problemas de **infra del host** (no de cÃ³digo). DiagnÃ³stico y resoluciÃ³n:

- **1. ResoluciÃ³n DNS solo IPv6 + sin ruta IPv6.** `getent hosts` del endpoint Neon devolvÃ­a solo `AAAA` y el runner no enruta IPv6 â†’ `postgres(process.env.DATABASE_URL!)` daba `ECONNREFUSED` (`[errors] Ã—3`). El host **sÃ­** tiene IPv4; la causa era puramente de conectividad. Fix operativo: pin IPv4 en `/etc/hosts` del runner:
  ```bash
  echo '54.209.204.248 ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech' >> /etc/hosts
  ```
  Caveat: si el endpoint Neon cambia de IP hay que re-pinarlo y no se replica a otros runners.
- **Egress IPv4 al puerto 5432 bloqueado.** Tras el pin, `seed` resolvÃ­a IPv4 pero seguÃ­a en `ECONNREFUSED`. ClasificaciÃ³n con `/dev/tcp`: `:443` OK, `:5432` FAIL contra la **misma IP** â†’ firewall/NAT del host bloquea la **salida TCP 5432**. Se abre egress en el host (p. ej. firewalld):
  ```bash
  firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="5432" protocol="tcp" accept'
  firewall-cmd --reload
  ```
- **Playwright no soporta AlmaLinux de forma oficial.** `playwright install --with-deps chromium` cae al fallback Ubuntu y ejecuta `apt-get` (inexistente en RHEL-family) â†’ `command not found`, exit 127. Fix: **quitar `--with-deps`** del job `e2e` del workflow; las libs del sistema se instalan una vez en el runner vÃ­a `dnf`, y Playwright 1.62.0 ya tiene el build `chromium-1234` (Chrome 151.0.7922.34) cacheado en `~/.cache/ms-playwright`, asÃ­ que `playwright install chromium` valida sin descargar (la revisiÃ³n 1234 es exactamente la que espera 1.62.0).
- **DiagnÃ³stico anexo revertido:** se eliminÃ³ el paso "Diagnose DB connectivity" del job `seed` (solo servÃ­a para clasificar el bloqueo; quedÃ³ ruido una vez resuelto).
- **Prerequisitos documentados del runner self-hosted:** Node 22, pnpm, git, **egress TCP a Neon en 5432** (IPv4 o IPv6), pin IPv4 del endpoint Neon en `/etc/hosts` si no hay ruta IPv6, y las libs del sistema de chromium instaladas vÃ­a `dnf` (nss, atk, at-spi2-atk, cups-libs, libdrm, libxkbcommon, libXcomposite, libXdamage, libXfixes, libXrandr, mesa-libgbm, alsa-lib, pango, cairo, gtk3).
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” Carrito/checkout no persistÃ­an: faltaba Redis (Upstash) con el nombre correcto

Tras arreglar la infra del runner, el job E2E quedÃ³ en 28 passed / 2 failed (`cart`, `checkout`), ambos con el **mismo sÃ­ntoma determinista**: tras "Agregado al carrito" (POST 200 y toast OK), `/cart` y `/checkout` salÃ­an vacÃ­as â†’ `[data-testid=cart-item]` y `[data-testid=checkout-name]` ausentes. DiagnÃ³stico:

- El carrito es 100% Redis-persistido: `packages/commerce/src/redis.ts` y `apps/superadmin/lib/redis.ts` leen `process.env.REDIS_URL` (ioredis). El proxy genera el cookie `cart_session_id` estable (`apps/storefront/proxy.ts:114`) e inyecta `x-cart-session-id`, asÃ­ que POST y GET usan la misma sesiÃ³n.
- **Variable en mayÃºsculas:** el cÃ³digo lee `REDIS_URL`. En Vercel habÃ­a quedado como `redis_url` (minÃºsculas) â†’ `process.env.REDIS_URL` era `undefined` â†’ fallback a `redis://localhost:6379` â†’ cada `safeGet`/`redisSetEx` degrada a `null`/no-op â†’ POST "ok" pero nada se persiste â†’ GET devuelve `items: []`. Los nombres de variables de entorno son sensibles a mayÃºsculas/minÃºsculas.
- **DB Upstash borrada:** al restaurar, "no databases available". No hay una polÃ­tica conocida de Upstash que borre el free tier por inactividad; probablemente se borrÃ³ manualmente. Se recrea la instancia.
- **Cuidado con `isProduction`** (`@repo/validation/env.ts`): `isProduction = NODE_ENV==="production" && (R2 || RESEND || UPSTASH_REDIS_REST_URL)`. Si el storefront arranca con solo las core, agregar `UPSTASH_REDIS_REST_URL` hace que `productionSchema` exija ademÃ¡s `RESEND_API_KEY`, `R2_*`, `MERCADOPAGO_WEBHOOK_SECRET`, `STOREFRONT_URL` â†’ sin ellas la app **revienta al boot**. Como el carrito solo usa `REDIS_URL` (que **no** estÃ¡ en `hasCloudVars`), alcanza con setear `REDIS_URL` (mayÃºsculas) en Vercel; `UPSTASH_*` es opcional y solo si se completan las demÃ¡s vars de producciÃ³n.
- **AcciÃ³n:** se configura `REDIS_URL` (nueva instancia Upstash `model-emu-200894`, URL `rediss://...:6379`) en el `.env.local` y se documenta. El carrito requiere **`REDIS_URL` (mayÃºsculas, ioredis)** â€” distinta de `UPSTASH_REDIS_REST_URL`.
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” E2E casi verde: fix de flakiness en `cart` (cold-start Vercel)

Tras configurar `REDIS_URL` en Vercel, el run E2E quedÃ³ en **29 passed / 1 flaky / 1 skipped**: `checkout` ya pasa (el carrito persiste), pero `cart.spec.ts` "ver carrito con Ã­tem" quedÃ³ **flaky** â€” `[data-testid=cart-item]` no aparecÃ­a en 10s en el primer intento y pasaba en el retry. Se tratÃ³ de cold-start de Vercel en el primer hit a `/cart` (Server Component + GET `/api/cart`), no de un bug de app. Fix en `e2e/storefront/cart.spec.ts:30`: `toBeVisible({ timeout: 30_000 })` (mismo patrÃ³n que el fix de `checkout`). El `1 skipped` es intencional (spec con `test.skip`).

- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” AuditorÃ­a RLS/tenant: grep con BRE roto dio falso "0 matches"; re-corrida con ripgrep limpia

El reviewer pidiÃ³ re-correr la bÃºsqueda de accesos directos a `db` (sin `withTenantContext`) con sintaxis correcta: el grep de la auditorÃ­a anterior usaba BRE (sin `-E`/`-P`), donde `\(` y `|` son literales â†’ reportaba "0 matches" por herramienta rota, no porque no hubiera cÃ³digo. Re-corrida con ripgrep sobre todo el worktree:

- `db\.(select|insert|update|delete)\s*\(` â†’ 20 matches, **todos** en `packages/db/seed.ts` (legÃ­timo: el seed corre con rol owner/BYPASSRLS, no estÃ¡ sujeto a RLS).
- Ampliado `db\.(select|insert|update|delete|execute|query|transaction)\s*\(` â†’ 30 matches: `seed.ts` + `packages/db/src/index.ts:19` (`db.transaction` â€” es la implementaciÃ³n del propio helper `withTenantContext`).
- `db\.query\.\w+` (consultas relacionales de Drizzle, otra vÃ­a de acceso directo) â†’ **0 matches**.

ConclusiÃ³n: no queda ningÃºn acceso directo a tablas de negocio fuera de `withTenantContext` en cÃ³digo de runtime. El Ãºnico bug de ese tipo era `apps/storefront/lib/auth.ts` (login roto por RLS), ya corregido con el helper `customer-auth.ts`. Nada mÃ¡s que atender.

- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” Carrito intermitente: race de conexiÃ³n de ioredis en cold-start (el timeout de 30s no era la causa)

El run E2E siguiÃ³ en **28 passed / 1 failed (`cart`) / 1 flaky (`checkout`) / 1 skipped** incluso con `toBeVisible({ timeout: 30_000 })`. El `cart` fallaba de forma determinista con el carrito vacÃ­o tras un POST "ok": **el timeout no resolvÃ­a la causa real**. DiagnÃ³stico en `packages/commerce/src/redis.ts`:

- ioredis se crea con `lazyConnect: true` + `enableOfflineQueue: false`. En un cold-start de Vercel, el primer comando (`setex`/`get`) **dispara** la conexiÃ³n y, como `enableOfflineQueue` estÃ¡ desactivado, ioredis **rechaza** el comando si el socket aÃºn estÃ¡ en `connecting` (status no `ready`) â†’ `redisSetEx` degrada a no-op â†’ el POST responde 200 (el toast miente) pero nada se persiste â†’ el GET devuelve `items: []`. Es una carrera que pierde el write en silencio; subir el timeout del assertion no cambia el estado.
- **Fix:** nuevo `whenReady(timeoutMs=5000)` en `redis.ts` â€” espera (con tope) al evento `ready` antes de emitir el comando, disparando `connect()` si el status es `wait`/`end`. Si Redis nunca queda listo, se degrada tras 5s (mismo comportamiento "progresivo", pero sin la race). `safeRun` unifica los tres wrappers.
- **Mejora no-bloqueante del reviewer implementada:** `redisDown()` ahora ademÃ¡s dispara `captureMessage("Redis unavailable during \"<op>\"")` a Sentry vÃ­a dynamic import de `@sentry/nextjs` (try/catch: no-op si no hay DSN o en tests). Se declarÃ³ `@sentry/nextjs@^10.69.0` (misma versiÃ³n que las 3 apps) en `packages/commerce/package.json`; `pnpm-lock.yaml` actualizado.
- **VerificaciÃ³n local:** `@repo/commerce` typecheck OK; suite completa **383 passed (48 files)**; ESLint OK en el archivo tocado. (Nota: `prettier --check` local falla por `prettier-plugin-tailwindcss` ausente â€” preexistente, el plugin nunca estuvo en el lockfile.)
- **Branch:** `feat/e2e-playwright`

## 2026-08-07 â€” Post-merge: dominios a producciÃ³n + auditorÃ­a de env vars + pnpm install

Tras mergear el PR #40 (feat/e2e-playwright) a develop, se cerraron los 3 pendientes operativos de la lista post-merge:

- **1. Dominios reasignados a la rama `develop` en Vercel** (REST API con token de sesiÃ³n, `PATCH /v9/projects/{p}/domains/{d}` con `gitBranch: "develop"`): `*.landaetastudio.com` (storefront), `admin.landaetastudio.com` (admin), `superadmin.landaetastudio.com` (superadmin). Apuntaban a `feat/e2e-playwright` (rama ya eliminada); sin el cambio quedaban sin servir. Los 3 verificados=True contra el preview de develop. Nota: el primer intento los puso en producciÃ³n (`gitBranch: null` â†’ rama de producciÃ³n `main`, Ãºltimo build de mayo 2026); se corrigiÃ³ de inmediato a `develop`.
- **2. AuditorÃ­a de env vars (producciÃ³n + preview) en los 3 proyectos Vercel**: completas â€” `DATABASE_URL`, `DATABASE_APP_URL`, `AUTH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `R2_*`, `RESEND_API_KEY`, `STOREFRONT_URL` (storefront ademÃ¡s `REDIS_URL` en mayÃºsculas + `UPSTASH_*`; admin/superadmin ademÃ¡s `NEXTAUTH_URL` y `ADMIN_HOST`/`SUPERADMIN_HOST`). Sin gaps que corregir. `UPSTASH_REDIS_REST_URL` en storefront no rompe el boot porque las demÃ¡s cloud vars de producciÃ³n estÃ¡n presentes (el trap de `isProduction` exige todas, y estÃ¡n todas).
- **3. `pnpm install --frozen-lockfile`** en el repo principal: sincroniza node_modules con la dep nueva `@sentry/nextjs` en `@repo/commerce` que trajo el merge.
- **Nota para el release:** los dominios apuntan al preview de `develop` (build fresco con el E2E mergeado). La rama de producciÃ³n de los 3 proyectos es `main`; hasta que se mergee `develop â†’ main`, el dominio no sirve el build de producciÃ³n de mayo 2026.
- **Branch:** `develop`

## 2026-08-07 â€” Lockfile roto tras merges de Dependabot: `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`

Tras mergear los 10 PRs de Dependabot (#30-#39) a develop, los deploys de Vercel (3 proyectos) y el CI self-hosted fallaron con el mismo error en `pnpm install --frozen-lockfile`:

```
ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY: no entry for
'vite@8.0.10(@types/node@26.1.2)(esbuild@0.25.12)(jiti@2.6.1)(terser@5.49.2)(tsx@4.23.5)'
```

- **Causa raÃ­z:** lockfile roto por los merges de Dependabot (no cÃ³digo). El importer raÃ­z y el snapshot de `@vitejs/plugin-react@6.0.5` referenciaban `vite@8.0.10(...)(jiti@2.6.1)...`, pero en la secciÃ³n `snapshots` solo existÃ­a la variante con `jiti@2.7.0` (los merges mezclaron resoluciones generadas en ramas distintas: una resolvÃ­a jiti 2.6.1, otra 2.7.0).
- **Fix:** `pnpm install --no-frozen-lockfile` (el comando que pnpm mismo sugiere para lockfiles rotos por merge) re-resolviÃ³ plugin-react contra la variante existente `jiti@2.7.0`. Diff final mÃ­nimo: 3 lÃ­neas en el lockfile (las 3 referencias de vite de `@vitejs/plugin-react`). Sin cambios en `package.json`.
- **VerificaciÃ³n:** `pnpm install --frozen-lockfile` â†’ exit 0 (reproduce el gate de Vercel/CI); `pnpm test` â†’ 383/383 (48 files) con vitest 4.1.10.
- **Resultado:** commit `678d5b6` â†’ CI en develop **success**; deploys Vercel de los 3 proyectos en `678d5b6` **success**.
- **LecciÃ³n:** al mergear en lote PRs de Dependabot que tocan `pnpm-lock.yaml`, verificar localmente `pnpm install --frozen-lockfile` antes de pushear (o usar `@dependabot rebase` en secuencia para que cada PR se resuelva contra el develop actualizado).
- **Branch:** `develop`

## 2026-08-08 â€” INCIDENTE ACTIVO: 9 Server Components leÃ­an tablas con RLS directo (sin `withTenantContext`)

**Descubrimiento:** la verificaciÃ³n final de la auditorÃ­a RLS (a pedido del reviewer) con salida cruda del grep revelÃ³ que la auditorÃ­a anterior era **falsa** por herramienta rota, esta vez doblemente:

1. El grep de una lÃ­nea `db\.(select|insert|update|delete)\s*\(` no matchea queries multilÃ­nea (`db` / `.select()` / `.from()`), que es el idiom estÃ¡ndar del codebase.
2. La corrida cruda con el patrÃ³n multilÃ­nea `\.from(dbX)` encontrÃ³ **72 matches**, y la clasificaciÃ³n tabla-por-tabla dejÃ³ **9 Server Components (pÃ¡ginas) leyendo tablas con RLS fuera de `withTenantContext`**: 7 del admin (`products`, `orders`, `categorias`, `shipping`, `products/new`, `products/[id]/edit`) y 2 del storefront (`buscar/search-results.tsx`, `checkout/success`, mÃ¡s `categoria/[slug]` â€” 9 en total).

**ConfirmaciÃ³n de impacto real en producciÃ³n (no solo lectura de cÃ³digo):**

- BD prod (Neon, rol owner): **7 productos, 7 categorÃ­as, 4 Ã³rdenes, 4 mÃ©todos de envÃ­o, 29 variantes, 10 imÃ¡genes** â€” los datos existen.
- RLS en prod: `relrowsecurity=true` + `relforcerowsecurity=true` (migraciones 0009+0010, activas desde el 2026-07-29 con el commit `3b2d77c`) en las 8 tablas de negocio; `app_user` con `rolbypassrls=false`.
- Navegador logueado en `admin.landaetastudio.com`: `/products`, `/orders`, `/categorias`, `/shipping` â†’ **todas las tablas vacÃ­as** ("No hay productos. Crea el primero.", etc.).
- Storefront pÃºblico `tienda1.landaetastudio.com/buscar?q=remera` â†’ **HTTP 500** (peor que vacÃ­o): con RLS devolviendo 0 productos, `productIds` quedaba vacÃ­o y `sql`... in ${productIds}`` generaba `IN ()` invÃ¡lido en PostgreSQL.
- **E2E no lo detectÃ³:** los specs de admin solo asertan headings, nunca las filas de las tablas.

**Fix (9 archivos, mismo patrÃ³n:** `db.` â†’ `tx.` dentro de `return await withTenantContext(tenantId, cb)`):

- Admin: `products/page.tsx` (3 queries), `orders/page.tsx`, `categorias/page.tsx`, `shipping/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx` (4 queries, todas en un solo contexto).
- Storefront: `buscar/search-results.tsx` (4 queries en un contexto), `checkout/success/page.tsx` (agrega `getTenantId()`), `categoria/[slug]/page.tsx`.
- **Guard adicional en `/buscar`:** si `productIds.length === 0` se devuelven `variants: []`/`images: []` sin construir el `IN ()` â€” caso legÃ­timo (bÃºsqueda sin resultados) que no debe dar 500 nunca.

**Tests de regresiÃ³n (3 archivos, 5 tests):** `orders/__tests__/page.test.ts`, `products/__tests__/page.test.ts` (assertan que la pÃ¡gina llama `withTenantContext(tenantId, ...)` y renderiza los datos devueltos), `buscar/__tests__/search-results.test.ts` (con resultados + sin resultados / guard del `IN ()`). PatrÃ³n: mock de `withTenantContext` con chain Drizzle que resuelve en orden de await.

**VerificaciÃ³n:** `pnpm test` 388/388 (5 nuevos, 51 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

**Impacto del incidente:** desde la activaciÃ³n de FORCE RLS (2026-07-29), el panel de admin mostraba listas vacÃ­as en el uso diario (productos, Ã³rdenes, categorÃ­as, envÃ­os) y el buscador pÃºblico del storefront daba 500. No fue reportado antes consistentemente con la ausencia de uso del admin en el perÃ­odo (sin tenants/clientes reales aÃºn; el reviewer pidiÃ³ confirmar si alguien del equipo entrÃ³ â€” sin evidencia de uso, ADR-022 ya habÃ­a documentado que no se detectÃ³ trÃ¡fico a rutas en la auditorÃ­a).

- **Branch:** `develop`

---

## 2026-08-08 â€” AlineaciÃ³n documental post-incidente RLS

- **README.md:** tests 227â†’388 (51 archivos, fecha 08-08), nueva secciÃ³n **Fase 6 â€“ RLS real (withTenantContext) y E2E** (withTenantContext real, DATABASE_APP_URL, incidente 08-08, E2E, carrito resiliente, barrido console.*), endpoints faltantes agregados (`products/import`, `config/tenant`, `config/settings`, `config/tenant/domain`, `domain-check` en admin y superadmin, `search` y `categories` de storefront), bloque duplicado `apps/` de estructura eliminado, MercadoPago ngrokâ†’dotunnel, "Estado actual" corregido (R2 en lugar de MinIO, Resend en lugar de nodemailer, customer-auth con withTenantContext).
- **SETUP.md:** 225â†’388 tests, secciÃ³n **Redis** nueva (REDIS_URL ioredis vs UPSTASH_* REST, trap de `isProduction` en env.ts), secciÃ³n **E2E** nueva (playwright.config en raÃ­z, requisitos runner self-hosted AlmaLinux: egress TCP 5432, pin IPv4 Neon en /etc/hosts, libs chromium dnf, guard anti-fork), vars Vercel completadas con `DATABASE_APP_URL` y `REDIS_URL`.
- **docs/arquitectura.md:** ADR-022 (rls-status) agregado al Ã­ndice; convenciÃ³n de logger actualizada a 0 instancias `console.*` en apps/ (barrido completo; excepciÃ³n seed.ts y env.ts).
- **TESTING.md:** setup Dockerâ†’cloud, MercadoPago diferenciado (sandbox manual pendiente vs webhook automatizado con 11 tests), 225â†’388 tests / 25â†’51 archivos, fecha 08-08, patrÃ³n de testing actualizado (handlers reales + @repo/test-utils).
- **TESTING-MANUAL.md:** 225â†’388 + E2E (14 specs), Docker/ngrok â†’ cloud/dotunnel, MailHog â†’ Resend, **CSV import reconciliado** (pasÃ³ de "No implementado" a Implementado â€” secciÃ³n y pendiente corregidos), **afirmaciÃ³n falsa de proxies removida** (secciones "Seguridad de subdominios" marcadas obsoletas: los proxy.ts de admin/superadmin fueron eliminados como no-ops el 10-07; el aislamiento se garantiza por datos, no por host).
- **VerificaciÃ³n:** greps de coherencia (388 tests en vitest, 0 `console.*` en apps/, 14 specs, mÃ©todos HTTP confirmados en routes de config/tenant, config/settings, config/tenant/domain, domain-check, search, categories). Sin cambios de cÃ³digo â€” no se ejecutÃ³ build/test completo.
- **Branch:** `develop`

---

## 2026-08-08 â€” Webhook MP: verificaciÃ³n de firma alineada a spec oficial

**Bug:** el webhook de MercadoPago calculaba `HMAC(rawBody + "." + x-request-id)` y comparaba el header completo; la spec real de MP firma la cadena canÃ³nica `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y envÃ­a `x-signature: ts=<ts>,v1=<v1>`. Todo webhook legÃ­timo devolvÃ­a 401 (fail-closed) â†’ MP reintentaba 24 h â†’ las Ã³rdenes nunca se confirmaban en prod. AdemÃ¡s `BYPASS_WEBHOOK_SIGNATURE` figuraba en `.env.local.example` pero el cÃ³digo nunca lo leÃ­a (config muerta).

**Cambios:**

- **Nuevo helper** `packages/commerce/src/webhook-signature.ts` (`verifyMercadoPagoSignature`): parsea `ts`/`v1`, construye canonical omitiendo partes vacÃ­as, rechaza `ts` fuera de ventana de 300 s (anti-replay, recomendaciÃ³n de MP) y compara con `timingSafeEqual` con guard de longitud previo. Exportado desde `@repo/commerce` (index + subpath).
- **route.ts:** bloque manual reemplazado por el helper; `BYPASS_WEBHOOK_SIGNATURE=true` solo salta verificaciÃ³n cuando `NODE_ENV !== "production"` (fail-closed intacto en prod). Flujo de negocio, magic IDs dev e idempotencia por `payment_id` sin cambios.
- **Tests:** 14 unit del helper + 13 del route reescritos a formato MP real (firma vÃ¡lida/invÃ¡lida/vencida, bypass dev sÃ­ / prod no, magic approved/rejected, 400 payload, 503 sin secret). TDD: test del helper rojo primero (mÃ³dulo inexistente).
- **Docs:** README (formato de firma MP + smoke test con openssl), SETUP.md (ejemplos curl con canonical correcto), esta entrada.

**VerificaciÃ³n:** `pnpm test` 405/405 (17 nuevos, 52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `fix/webhook-mp-firma` (pendiente merge a `develop`)

---

## 2026-08-08 â€” Checkout: cold-start de Redis no rompe el flujo (fail-open rate limit)

**Bug:** al pagar en `/checkout` (tienda1 prod) el POST `/api/checkout/preference` devolvÃ­a `"Stream isn't writeable and enableOfflineQueue options is false"`. El rate limit usaba `redisClient.incr/pexpire` directos (sin `whenReady`), y con `lazyConnect` + `enableOfflineQueue:false` el primer comando de una instancia serverless frÃ­a se rechaza mientras el socket conecta â€” la misma carrera de cold-start ya documentada para el carrito (wrappers `safeGet`/`redisSetEx`/`redisDel`), pero sin cobertura en checkout.

**Cambios:**

- **`packages/commerce/src/redis.ts`:** nuevos wrappers progresivos `redisIncr` (retorna `number | null`) y `redisPexpire`, ambos vÃ­a `safeRun` (mismo patrÃ³n que `safeGet`).
- **`checkout/preference/route.ts`:** `rateLimitKey` usa los wrappers; si Redis no responde (`null`) â†’ `logger.warn("Redis unavailable, rate limit disabled")` y trata como 0 (**fail-open**: el checkout no se bloquea por un problema transitorio de Redis; el rate limit es protecciÃ³n, no crÃ­tica). Catch final ya no filtra `error.message` interno: mensaje genÃ©rico en espaÃ±ol, detalle solo en logs.
- **`checkout/route.ts`:** `redisClient.get/del` â†’ `safeGet`/`redisDel` (degradaciÃ³n consistente con carrito: Redis caÃ­do = carrito vacÃ­o 400, no 500).
- **Tests (TDD, RED primero):** mocks de `@/lib/redis` migrados a los wrappers; caso nuevo "fail open cuando Redis no estÃ¡ disponible" (sin 429 y flujo continÃºa); 21 tests en checkout (1 nuevo).
- **Docs:** esta entrada.

**VerificaciÃ³n:** `pnpm test` 406/406 (1 nuevo, 52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `develop`

---

## 2026-08-08 â€” Checkout: URL base derivada del request (fin de STOREFRONT_URL)

**Bug:** los `back_urls` de MercadoPago se construÃ­an con `STOREFRONT_URL` (env fija), que en Vercel apuntaba a `saas-storefront.vercel.app` â†’ el redirect post-pago daba 404 en `/checkout/success`. Con una env fija ademÃ¡s rompe multi-tenant: un checkout de tienda2 redirigirÃ­a al dominio de tienda1 (el proxy resuelve el tenant por host).

**Cambios:**

- **Nuevo helper** `apps/storefront/lib/request.ts` (`getStorefrontBaseUrl(request)`): deriva la base de `x-forwarded-proto` + `host` del request entrante. Sin condicionales ni fallbacks (ya no se usa dotunnel local; solo Vercel).
- **`checkout/preference/route.ts`:** `back_urls` usan `getStorefrontBaseUrl(request)`; se elimina el `throw` por `STOREFRONT_URL` faltante.
- **`register/route.ts`:** el email de bienvenida usa la misma derivaciÃ³n (link de la tienda correcta por tenant).
- **Vercel:** `STOREFRONT_URL` se mantiene en admin/superadmin por validaciÃ³n de env; en storefront queda inerte (el cÃ³digo ya no la lee). `.env.local` ya no la necesita para dev.
- **Tests (TDD, RED primero):** el test de Ã©xito de preference pasa `host`/`x-forwarded-proto` por headers y aserta `back_urls` y `external_reference` del body enviado a MP; el test de register aserta el email con la URL derivada.
- **Docs:** README (secciÃ³n webhook) y SETUP (secciÃ³n STOREFRONT_URL â†’ inerte) actualizados.

**VerificaciÃ³n:** `pnpm test` 406/406 (52 files) | typecheck 9/9 | lint 6/6 | build 3 apps OK.

- **Branch:** `develop`

## 2026-08-08 ï¿½ E2E de firma real del webhook MP (spec `webhook-signature`)

**Contexto:** el E2E existente (`checkout.spec.ts`) llega hasta el redirect de MP pero no completa el pago. Para validar la firma real del webhook (spec oficial `ts=...;v1=...`) y el cambio de estado de la orden sin llamar a la API de MP, se agrega un spec E2E que ejercita el endpoint desplegado. El modo `x-test-order-id` solo se activaba con `NODE_ENV=development`; en Vercel (production) no funcionaba.

**Cambios:**

- **`apps/storefront/app/api/webhooks/mercadopago/route.ts`:** refactor del bloque de simulaciï¿½n a `simMode` = `NODE_ENV=development` **o** `E2E_WEBHOOK_TEST=1` + mapa de magic IDs `123456789` (approved) / `000000` (rejected) / `999999` (pending). La firma nunca se salta (fail-closed).
- **`packages/commerce`:** `makeSignature` movido del unit test a `webhook-signature.ts` y reexportado (subpath `@repo/commerce/webhook-signature`); unit test refactorizado para usarlo (DRY).
- **`playwright.config.ts`:** nuevo proyecto `webhook` (testMatch `webhook/*.spec.ts`, baseURL storefront).
- **Nuevo spec `e2e/webhook/webhook-signature.spec.ts`:** 4 tests ï¿½ firma vï¿½lida + approved ? orden `confirmed`; firma adulterada ? 401; sin `x-signature` ? 401; pending ? la orden queda `pending_payment`. La orden se crea por insert directo a DB (`orders` camelCase, `total=0` para no disparar email), tienda1 fijo, limpieza en `afterAll` (`DELETE ... WHERE id = ANY(...)`). Guard `test.skip` si CI sin `E2E_WEBHOOK_TEST`.
- **`e2e.yml`:** workflow env `E2E_WEBHOOK_TEST=1` + job `e2e` recibe `DATABASE_URL` (Neon) y `MERCADOPAGO_WEBHOOK_SECRET`.
- **Docs:** TESTING.md (fila E2E firma + magic ID `999999`) y AGENTS.md (formato `x-test-order-id=<tenantId>:<orderId>`, magic IDs, env `E2E_WEBHOOK_TEST`).

**Pendiente operativo:** setear `E2E_WEBHOOK_TEST=1` como env var de Vercel (Preview) en el proyecto storefront y el secret `MERCADOPAGO_WEBHOOK_SECRET` en GitHub Actions (mismo valor que Vercel).

- **Branch:** `develop`

## 2026-08-08 â€” E2E webhook MP verde en CI (firma real)

**Contexto:** el primer run de CI del spec `webhook-signature` reportÃ³ 5 skipped (4 webhook + 1 cross-tenant pre-existente): los skips eran silenciosos en `beforeAll` cuando faltaba env, haciendo parecer el run exitoso.

**Cambios posteriores:**

- **`e2e/webhook/webhook-signature.spec.ts`:** el `beforeAll` ahora lanza `throw` con mensaje explÃ­cito (lista `DATABASE_URL`/`MERCADOPAGO_WEBHOOK_SECRET` como `set`/`MISSING` y valida tenant `tienda1`) en lugar de `test.skip` silencioso â€” fail-fast cuando el workflow estÃ¡ opt-in (`E2E_WEBHOOK_TEST=1`).
- **`e2e.yml`:** el paso de comentario de PR usa guard `if (!context.issue.number)` (workflow_dispatch no tiene issue â†’ evitaba 404 `issues//comments`).

**ConfiguraciÃ³n externa aplicada:** `E2E_WEBHOOK_TEST=1` en Vercel (Preview) y secret `MERCADOPAGO_WEBHOOK_SECRET` creado en GitHub Actions (valor real de Vercel, no el local).

**VerificaciÃ³n:** CI `workflow_dispatch` verde â€” 34 passed, 1 skipped (cross-tenant pre-existente); los 4 tests de firma ejecutados contra `tienda1.landaetastudio.com` con firma real.

- **Commits:** `a49747f`, `cf11cd6`, `71a9972`
- **Branch:** `develop`

## 2026-08-08 â€” Calidad: limpieza email, health check y deuda tÃ©cnica

- **Ãtem 1 â€” Limpieza configs muertas:** `email.ts` Resend-only (`RESEND_FROM_EMAIL` como sender configurable, fallback `onboarding@resend.dev`); eliminados SMTP_HOST/PORT/FROM, `nodemailer` y `@types/nodemailer` (y del lockfile). `.env.local.example` refleja `RESEND_FROM_EMAIL`.
- **Ãtem 2 â€” Health check:** nuevo `redisPing()` en `@repo/commerce` (wrapper fail-open en `safeRun`) + `GET /api/health` pÃºblico en las 3 apps (DB `SELECT 1`, Redis `ok/skipped`, token MP `ok/missing`; 200 ok / 503 degraded; `force-dynamic`; timeout 4s por check). NegaciÃ³n `api/health` en el matcher de `proxy.ts` del storefront (crÃ­tico: sin esto 404 por resoluciÃ³n de tenant). Ajuste `@repo/commerce/*` en tsconfig de admin/superadmin. 12 tests nuevos (4 por app). Docs: README (Monitoreo) y SETUP (Health Check / UptimeRobot).
- **Ãtem 3 â€” Deuda tÃ©cnica:** nuevo `docs/deuda-tecnica.md` con 3 planes (TOCTOU en stock de checkout con update atÃ³mico `stock - qty WHERE stock >= qty`; migraciones inmutables con guard en CI; pin IPv4 del endpoint Neon para el runner self-hosted). **NO ejecutado, solo plan.**
- **Branch:** `quality/calidad-y-monitoreo`

## 2026-08-08 â€” Alertas proactivas: degradaciÃ³n de health â†’ Sentry

- Los 3 `GET /api/health` ahora disparan `captureMessage` (level `warning`) a Sentry cuando degradan (db error, redis error, token MP missing), solo si hay `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`. Fail-open: si Sentry no estÃ¡, solo queda el `logger.warn`.
- Permite alerta temprana de "nuevo issue" ante degradaciÃ³n persistente (sin depender solo del 500 que ya capturaba).
- 6 tests nuevos (2 por app): Sentry notificado en degradaciÃ³n + no notifica en ok. Suite: 55 archivos / 425 tests.
- Monitoreo externo: UptimeRobot (3 monitores a los `/api/health`, 5 min, 200 OK), alertas de Vercel (5xx >5%, p95 >3s, disponibilidad <99%) y Sentry (â‰¥10 errores/5 min) ya creadas manualmente en paneles.

## 2026-08-10 â€” Chore: factory de health check, test de Redis fallando y decisiÃ³n E2E_WEBHOOK_TEST

- **Refactor (eliminar duplicaciÃ³n):** los 3 `route.ts` de `/api/health` (byte-idÃ©nticos salvo `APP_NAME`) ahora delegan en el factory `createHealthCheckHandler({ appName, hasRedis })` de `@repo/commerce/health` (export `"./health"` en `package.json`, patrÃ³n `./webhook-signature`). SemÃ¡ntica cambiada por diseÃ±o: Redis se chequea solo en storefront (`hasRedis: true` y `REDIS_URL` presente); admin/superadmin SIEMPRE `"skipped"` (antes dependÃ­an de `REDIS_URL`). Comportamiento observable en prod sin cambios (admin/superadmin no tienen `REDIS_URL`).
- **Test faltante:** `"returns 503 if Redis is configured but fails (error, not skipped)"` en storefront (mock `redisPing` rechazado â†’ 503, `checks.redis: "error"`). Suite: 55 archivos / 426 tests.
- **DecisiÃ³n documentada:** `E2E_WEBHOOK_TEST=1` en Preview de Vercel (proyecto storefront) â€” activa magic IDs (`123456789`/`000000`/`999999`) solo con firma HMAC vÃ¡lida (`MERCADOPAGO_WEBHOOK_SECRET` obligatorio siempre); aplica a todos los previews (no acotable por rama/dominio), aceptado porque la firma es el gate real. Documentado en AGENTS.md.
- **Branch:** `chore/health-and-docs`

---

## 2026-08-10 â€” AlineaciÃ³n documental post-PR44

- **README.md:** tests 388â†’426 (55 archivos), fecha a 10-08; menciÃ³n del factory `createHealthCheckHandler` de `@repo/commerce/health` en Monitoreo y de la decisiÃ³n `E2E_WEBHOOK_TEST=1` (previews, magic IDs `999999` incluido) en la secciÃ³n MercadoPago.
- **SETUP.md:** tests 388â†’426 (55 archivos), fecha a 10-08 y menciÃ³n del factory de health check (los 3 `/api/health` solo delegan).
- **PROMPTS.md:** `npx tsc --noEmit` â†’ `pnpm typecheck` en el prompt de anÃ¡lisis completo (el comando raÃ­z era inerte en el monorepo: no hay tsconfig raÃ­z).
- **docs/arquitectura.md + ADR-021-placeholder:** gap de numeraciÃ³n 020â†’022 documentado (no se reindexa ADR-022 para no romper links/historial).
- **TESTING.md / TESTING-MANUAL.md:** tests 388â†’426 (55 archivos) â€” consistencia total (quedaban como discrepancia residual).
- **bitacora.md:** solo se agrega esta entrada; la entrada previa del 10-08 ya reflejaba 426 tests.
- **VerificaciÃ³n:** `pnpm lint` âœ… | grep: solo quedan menciones histÃ³ricas de 388 en bitÃ¡cora (inmutables).
- **Branch:** `docs/align-post-pr44` (pendiente PR a develop)

---

## 2026-08-10 â€” TOCTOU: oversell en checkout (fix atÃ³mico) + 409 en PUT products/[id]

- **Checkout oversell (fix atÃ³mico):** el decremento de stock en `apps/storefront/app/api/checkout/route.ts` calculaba `stock - qty` sobre el valor leÃ­do en la fase 1 (no atÃ³mico): dos Ã³rdenes concurrentes con stock justo podÃ­an pasar la validaciÃ³n ambas y la segunda sobrescribÃ­a â†’ oversell. Ahora UPDATE atÃ³mico con `sql`${stock} - ${qty}`` + `WHERE stock >= qty` + `.returning({ id })`: 0 filas â†’ "Stock insuficiente" â†’ 422 (mapeo existente, rollback automÃ¡tico de la transacciÃ³n). 2 tests nuevos (stock exacto + concurrencia con `Promise.all`: una 200, una 422). Commit `9e7a518`.
- **PUT products/[id] (TOCTOU entre fases):** ventana fase 1 read â†’ R2 â†’ fase 3 write donde el producto pudo ser borrado: el UPDATE afectaba 0 filas y el refetch vacÃ­o devolvÃ­a 200 con body vacÃ­o; FK `23503` al insertar variantes daba 500. Ahora: refetch post-update `updatedProduct.length === 0` â†’ 409 "Producto eliminado durante la actualizaciÃ³n", catch `23503` â†’ 409 con el mismo mensaje y `logger.error` con `{ error, productId, tenantId }`. 2 tests nuevos (0 filas â†’ 409, FK â†’ 409). Commit `069f6aa`. Cierre de la deuda anotada el 2026-07-29.
- **EjecuciÃ³n:** 2 worktrees de Paseo en paralelo (`fix/toctou-checkout`, `fix/toctou-products`) con subagentes opencode (TDD estricto: RED â†’ GREEN â†’ verificaciÃ³n anti-revert con `git stash` de cada route.ts, tests nuevos fallan contra el cÃ³digo revertido). IntegraciÃ³n: cherry-pick de ambos commits a la rama unificada `fix/toctou-checkout-products`.
- **Tests:** 426 â†’ **428** (55 archivos). Lint sin errores. `docs/deuda-tecnica.md` Ã­tem 1 marcado implementado (incluye el caso products/[id], mismo patrÃ³n TOCTOU); README: pendientes sin "TOCTOU en PUT products/[id]".
- **Branch:** `fix/toctou-checkout-products` (pendiente PR a develop)

---

## 2026-08-11 - Calidad: guard de migraciones en CI, tarjetas de prueba MP, assertions E2E, prettier plugin y formateo global

- **Guard de migraciones inmutables (CI):** nuevo scripts/check-migrations.sh - falla (fail-closed) si git diff origin/develop -- packages/db/migrations/ no estï¿½ vacï¿½o: mensaje `? Migraciï¿½n existente modificada - crea una nueva migraciï¿½n, no edites las anteriores.`. .github/workflows/ci.yml: checkout@v7 con etch-depth: 0 + step Guard migraciones inmutables en el job uild. Cierra el ï¿½tem 2 de docs/deuda-tecnica.md.
- **Pin IPv4 de Neon para el runner self-hosted (documentaciï¿½n):** SETUP.md nueva sub-secciï¿½n "Runner self-hosted: pin IPv4 de Neon" (diagnï¿½stico, dig +short A/getent ahostsv4, pin en /etc/hosts, verificaciï¿½n con psql/E2E, alternativa IPv4-only y rotaciï¿½n de IPs). Cierra el ï¿½tem 3 de docs/deuda-tecnica.md.
- **Tarjetas de prueba MercadoPago:** SETUP.md y TESTING.md - placeholder "Prï¿½ximamente" reemplazado por tabla real del sandbox: Visa 4509 9535 6623 3704 APRO, Mastercard 5031 7557 3453 0604 OTHE, Amex 3711 8030 3257 522 CONT; CVV 123 (Amex 1234), vencimiento 11/25, titular/documento libres.
- **Assertions de contenido en E2E admin:** products-crud.spec.ts (verifica la fila creada con nombre ï¿½nico y que el estado vacï¿½o no aparezca - detectarï¿½a regresiï¿½n RLS), orders.spec.ts ( body tr count > 0), categories.spec.ts (fila creada + sin estado vacï¿½o). Nombres ï¿½nicos con Date.now().
- **Skip del E2E cross-tenant documentado:** comentario al inicio de e2e/security/cross-tenant.spec.ts explicando el skip condicional (falta tenant T2 con productos seed; se habilitarï¿½ cuando exista fixture multi-tenant).
- **prettier-plugin-tailwindcss en raï¿½z:** pnpm add -D -w prettier-plugin-tailwindcss@0.8.1 (peer prettier ^3.0, compatible con 3.9.6). .prettierrc ya lo referenciaba pero el plugin nunca estuvo instalado: prettier no podï¿½a correr con la config del repo.
- **Primer formateo global con prettier:** al instalar el plugin, prettier --write . realineï¿½ 285 archivos (single quotes, sin semicolons, orden de clases tailwind, rewraps de markdown) contra el .prettierrc propio del repo (agregado en 44612f y nunca aplicado). Cero cambios funcionales. Archivos excluidos vï¿½a nuevo .prettierignore: pnpm-lock.yaml y packages/db/migrations/ (inmutables). pnpm exec prettier --check . pasa limpio.
- **Ejecuciï¿½n:** 3 worktrees de Paseo en paralelo (quality-docs, quality-infra, quality-e2e) con subagentes opencode; los agentes quedaron colgados en shells de pnpm install dos veces (patrï¿½n conocido) y se reavivaron re-enviando el prompt. El commit de prettier del agente mezclaba plugin + formateo: se escindiï¿½ en chore (2 archivos) + style (285 archivos) y el formateo final se aplicï¿½ sobre la rama integrada para evitar conflictos con los commits de docs/e2e.
- **Integraciï¿½n:** cherry-pick a rama unificada chore/quality-and-docs en orden: ci guard -> IPv4 -> MP cards -> assertions E2E -> skip doc -> chore plugin -> style format (7 commits).
- **Verificaciï¿½n:** pnpm lint 6/6, pnpm typecheck 9/9, pnpm test 430/430 (55 archivos), pnpm build 3/3, pnpm exec prettier --check . limpio.
- **Branch:** chore/quality-and-docs -> mergeada como PR #47 (merge commit b772445)

## 2026-08-12 - Merge de 15 PRs dependabot, fix de lockfile corrupto y limpieza de dependencias muertas

- **Merge de 15 PRs de dependabot (todos verificados):** 10 PRs npm (drizzle-adapter 1.11.3, nodemailer 9.0.5, lucide-react 1.30.0, @types/pg 8.21.0, tsx 4.23.11, @playwright/test 1.62.1, @typescript-eslint/eslint-plugin 8.65.0, typescript-eslint 8.66.0, eslint-config-next 16.3.0, tailwindcss 4.3.3) validados en worktree local con install --frozen-lockfile + lint + typecheck + 430/430 tests, y 5 PRs de GitHub Actions (checkout v7, github-script v9, upload-artifact v7, pnpm/action-setup v6, setup-node v7) que actualizaron e2e.yml (ci.yml ya estaba en v7/v6/v7). Orden de merge: npm parches primero, luego minors, tailwindcss al final; actions sin conflicto entre sÃ­ (lÃ­neas disjuntas en e2e.yml).
- **Lockfile corrupto por merges encadenados de dependabot:** pnpm-lock.yaml con claves duplicadas (ej: browserslist@4.28.8 x3) -> ERR_PNPM_BROKEN_LOCKFILE -> builds de las 3 apps fallando en Vercel (install --frozen-lockfile no arranca). Reparado con pnpm install --fix-lockfile y commit 639eaf8 push directo a develop.
- **Limpieza de dependencias muertas (rama chore/remove-dead-deps):** eliminadas del root (devDeps: @types/ioredis, @types/nodemailer, @types/supertest, supertest, vite-tsconfig-paths, @typescript-eslint/eslint-plugin, @typescript-eslint/parser; deps: @auth/drizzle-adapter, mercadopago, nodemailer), de admin (eslint-config-next, bcryptjs), de storefront (eslint-config-next, ioredis, nodemailer, @types/nodemailer), de superadmin (bcryptjs) y de packages/db (@types/pg). VerificaciÃ³n: 0 imports residuales de los eliminados; bcryptjs/ioredis siguen vivos (root/packages). Lockfile ~600 lÃ­neas mÃ¡s chico. Los peers opcionales nodemailer@9.0.5 (next-auth) y @types/pg@8.21.0 (drizzle-orm) quedan en el Ã¡rbol por resoluciÃ³n de peers de pnpm, sin declararse como deps.
- **Deuda documentada:** packages/storage importa minio sin declararlo (hoisting del root) - agregar como dependencia explÃ­cita en PR futuro. Deuda similar en storefront (bcryptjs no declarado, usado vÃ­a root hoisting).
- **VerificaciÃ³n:** pnpm lint 6/6, pnpm typecheck 9/9, pnpm test 430/430 (55 archivos), pnpm build 3/3.
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
- **Branch:** main (merge commit: b32cfe9, tag v0.9.0)

---

## 2026-08-15 â€” Fix tipogrÃ¡fico en SECURITY.md

- **SECURITY.md (lÃ­nea 20):** correcciÃ³n de artefacto de copia-pega â€” `å…¶å®ƒé—®é¢˜` (chino, "otros problemas") â†’ `otros problemas` en la polÃ­tica de respuesta ("crÃ­ticas se atienden en la semana, otros problemas en el siguiente release.").
- **Alcance verificado:** la frase solo existÃ­a en `SECURITY.md` (grep `å…¶å®ƒé—®é¢˜`/`é—®é¢˜`/`siguiente release` â†’ 1 match). NingÃºn otro archivo contiene la frase ni referencia `SECURITY.md`, asÃ­ que no hubo otra documentaciÃ³n que actualizar.
- **Branch:** `develop`

---

## 2026-08-15 â€” Fix DoD post-Dependabot: compatibilidad TypeScript 6 + ioredis 6 en @repo/commerce

- **Contexto:** los 11 PRs de Dependabot (TS 6.0.3 #70, ioredis 6.0.0 #71, next 16.3.x #68, next-auth beta.32 #73, turbo 2.10.11 #74, @sentry/nextjs 10.70.0 #76, @types/node 26.2.0 #75, eslint-config-next 16.3.1 #72, resend 6.20.0+ #69, tailwindcss 4.3.3 #67, pnpm/action-setup 4â†’6 #66) se mergearon a develop. Al correr el DoD (`pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test`) fallaba.
- **`pnpm install --frozen-lockfile` roto:** `ERR_PNPM_OUTDATED_LOCKFILE` â€” el root `package.json` declaraba `typescript ^5.8.3` pero el lockfile ya traÃ­a `^6.0.3` (mismatch introducido por los merges). Reparado con `pnpm install --no-frozen-lockfile` (regenera lockfile coherente con TS6).
- **`pnpm lint` OK (6/6).** `pnpm typecheck` fallaba solo en `@repo/commerce` por dos causas:
  1. **DeprecaciÃ³n TS6 de `moduleResolution: node`/`node10`** en el Ãºnico paquete CommonJS del monorepo. Se alineÃ³ `packages/commerce/tsconfig.json` al estÃ¡ndar del resto del repo: `module: "ESNext"` + `moduleResolution: "bundler"` (como `@repo/db`, `@repo/logger`, etc.). Esto eliminÃ³ tambiÃ©n el cascade de errores `shouldInlineParams` de drizzle-orm (identidad de tipos rota por frontera ESM/CJS bajo `node16`) y los `Cannot find module 'next/headers'` en `tenant.ts`.
  2. **No se agregÃ³ `"type": "module"`** a `package.json` (se probÃ³ y revertiÃ³): con bundler resolution basta `module: ESNext` y los imports relativos quedan sin extensiÃ³n `.js` (consistente con el resto de paquetes y con el consumo desde apps Next.js).
- **`pnpm typecheck` 9/9, `pnpm build` 3/3 (apps Next 16.3.2), `pnpm test` 430/430 (55 archivos) â€” todos verdes.**
- **Lecciones:** (a) tras merges de Dependabot que cambian versiones mayores de TS, regenerar el lockfile con `--no-frozen-lockfile` antes del DoD; (b) mantener todos los paquetes @repo/* con la misma config de mÃ³dulo (ESNext/bundler) para evitar incompatibilidades de identidad de tipos de drizzle-orm bajo TS6.
- **Pendiente:** el lockfile ahora declara `typescript ^6` en root y en `@repo/commerce`; conviene dejar `pnpm install --frozen-lockfile` habilitado en CI una vez que el lockfile regenerado se commitee.
- **Branch:** `develop` (commit `2f0e23f` + `12ae2d0` pushed)

---

## 2026-09-09 â€” Merge completo de dependabot PRs #77â€“#86, fix lockfile roto y alineaciÃ³n next-auth

- **Contexto:** tras el merge de Dependabot PRs #78â€“#86 (previo a #77), se completÃ³ el merge de los 10 PRs restantes: #77 (next-auth Î².31â†’Î².32), #79 (typescript-eslint 8.67â†’8.69), #80 (@vitejs/plugin-react 6.0.5â†’6.1.1), #84 (next 16.3.2â†’16.3.4).
- **TS6 typecheck fix:** el lockfile regenerado tras el merge de #81 requerÃ­a `@types/node: ^20` â†’ `^26` en `packages/validation/package.json`, y `"types": ["node"]` tanto en `packages/validation/tsconfig.json` como en `packages/db/tsconfig.json` para que TypeScript 6 resuelva el global `process` (TS6 no lo incluye implÃ­citamente). Commits `d1c5036`, `12ae2d0`, `2f0e23f`.
- **Lockfile desincronizado (post #77):** el merge de #77 (next-auth Î².32) solo modificÃ³ el `pnpm-lock.yaml` pero no actualizÃ³ `apps/admin` ni `apps/superadmin` de Î².31â†’Î².32. El lockfile eliminÃ³ la entrada `@auth/core@0.41.2` (necesaria por Î².31) pero las apps seguÃ­an en Î².31 â†’ `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` en CI. **Fix:** actualizaciÃ³n explÃ­cita de `apps/admin/package.json` y `apps/superadmin/package.json` de `next-auth: 5.0.0-beta.31` a `5.0.0-beta.32`, seguido de `pnpm install --no-frozen-lockfile` para regenerar el lockfile limpio. Ahora todas las apps, root y `packages/auth` usan Î².32 con `@auth/core@0.41.3`.
- **Limpieza de disco:** la mÃ¡quina estaba a 0 GB libres (237 GB usados). El directorio `.turbo` del monorepo ocupaba **~59 GB** (cache de builds incremental). Se limpiÃ³ `.turbo` + los `.next` de las 3 apps, recuperando ~61 GB. **LecciÃ³n:** `.turbo` y `.next` estÃ¡n en `.gitignore` pero el `node_modules/.pnpm` symlink farm los replica dentro de `node_modules`, lo que infla el disco. Agregar `.turbo` al `.gitignore` del workspace raÃ­z y considerar `turbo prune` periÃ³dico en CI.
- **DoD completo verificado:** `pnpm install --frozen-lockfile` âœ“ (lockfile now in sync), `pnpm lint` 6/6 âœ“, `pnpm typecheck` 9/9 âœ“, `pnpm build` 3/3 âœ“, `pnpm test` 430/430 âœ“.
- **Dependabot PRs cerrados/reciÃ©n resueltos:** todos los 10 PRs originales (#66â€“#76) + los 10 PRs nuevos (#77â€“#86) estÃ¡n mergeados a `develop`. Pendiente: merge `develop` â†’ `main` para release.
- **PRs cerrados por el agente:** #80 (@vitejs/plugin-react) se determinÃ³ que SÃ se usa en `vitest.config.ts:3` (React component tests), por lo que se mergiÃ³ en vez de cerrar. Si se prueba que los tests de componentes no se usan en CI, se puede revertir y cerrar el PR.
- **Branch:** `develop` â€” commit `58e11f7` pushed.

---

## 2026-09-17 â€” Merge Dependabot PRs #87â€“#96, fix lockfile corrompido por duplicados YAML

- **Contexto:** 10 PRs Dependabot nuevos (#87â€“#96) se mergearon a develop. El PR #95 (vitest 4â†’5, major) quedÃ³ pendiente por riesgo. El merge de los 9 PRs corrompiÃ³ el `pnpm-lock.yaml` introduciendo **cientos de entradas YAML duplicadas** (el mismo paquete aparecÃ­a mÃºltiples veces con la misma key, violando YAML `mapping key`).
- **Causa raÃ­z de la corrupciÃ³n:** los merges de Dependabot en GitHub resuelven conflictos de texto lÃ­nea-por-lÃ­nea, pero el lockfile de pnpm es una estructura YAML con secciones `packages` y `resolutions` que deben ser Ãºnicas. Cuando mÃºltiples PRs cambian el lockfile simultÃ¡neamente, el merge de GitHub duplica bloques enteros en lugar de fusionarlos correctamente. Esto es un patrÃ³n conocido en monorepos con mÃºltiples PRs de Dependabot simultÃ¡neos.
- **Fix:** `pnpm install --no-frozen-lockfile` regenerÃ³ el lockfile limpio desde cero, eliminando todas las entradas duplicadas. El lockfile pasÃ³ de ~8400+ lÃ­neas corruptas a ~5000 lÃ­neas vÃ¡lidas.
- **DoD completo verificado:** `pnpm install --frozen-lockfile` âœ“, `pnpm lint` 6/6 âœ“, `pnpm typecheck` 9/9 âœ“, `pnpm build` 3/3 âœ“, `pnpm test` 430/430 âœ“.
- **LecciÃ³n:** en monorepos con mÃºltiples PRs Dependabot simultÃ¡neos, merge uno por uno o hacer squash-merge de todos juntos con regeneraciÃ³n de lockfile. El merge de GitHub UI no puede fusionar YAML de lockfile de pnpm correctamente cuando hay cambios en mÃºltiples paquetes.
- **Dependabot PRs mergeados esta ronda:** #87 (tsx 4.23.12â†’4.23.13), #88 (eslint-config-next 16.3.4â†’16.3.5), #89 (resend 6.22â†’6.28), #90 (@types/node 26.2â†’26.5.1), #91 (zod 4.5.4â†’4.6.4), #92 (next 16.3.4â†’16.3.5), #93 (typescript-eslint 8.69â†’8.70), #94 (lucide-react 1.37â†’1.45), #96 (playwright/test 1.62â†’1.63). **Pendiente:** #95 (vitest 4â†’5, major â€” requiere migration guide).
- **Branch:** `develop` â€” pendiente commit + push del lockfile regenerado.

---

## 2026-09-17 â€” Cierre del incidente de seed en CI: el egress 5432 del runner se bloqueÃ³ por la rotaciÃ³n de firewall de mj20 a nftables/iptables-nft

El `seed` (y con Ã©l todo el job e2e) volviÃ³ a caer en el runner self-hosted `mj20` (AlmaLinux) con `ECONNREFUSED 54.209.204.248:5432`. El fix previo del 2026-08-07 (regla rica de egress en **firewalld**) habÃ­a dejado de regir: entre agosto y setiembre el host migrÃ³ su firewall a **nftables con el front-end iptables-nft**, y `firewalld` quedÃ³ `masked`/`inactive`. Como el ruleset de nftables es `policy drop` en OUTPUT con un allowlist de puertos egress fijos (sin 5432), el SYN saliente a Neon morÃ­a en la cadena `LOGDROPOUT` (`reject` â†’ `Connection refused`). DiagnÃ³stico y cierre:

- **DiagnÃ³stico local (PC dev):** la misma IP `54.209.204.248:5432` abrÃ­a sin problema (`Test-NetConnection` OK) â†’ descartado Neon; era un bloqueo originado en el egress del runner, no en el destino.
- **En `mj20`:** `/etc/hosts` seguÃ­a con el pin IPv4 correcto y resolvÃ­a `54.209.204.248`; `:443` abrÃ­a, `:5432` daba "Connection refused"; `firewall-cmd` respondÃ­a "FirewallD is not running". El `nft list ruleset` mostrÃ³ el allowlist de egress sin `5432` y el remate `jump LOGDROPOUT` (handle 534).
- **Fix (operatorio, en el host, no en el repo):**
  ```bash
  iptables -I OUTPUT 1 -p tcp --dport 5432 -j ACCEPT   # abre egress 5432 al instante (iptables-nft = misma tabla nft)
  ```
  Verificado con `timeout 3 bash -c 'echo >/dev/tcp/54.209.204.248/5432'` â†’ `5432 OPEN`. El seed y los tests e2e volvieron a pasar verdes en el rerun. La regla quedÃ³ persistida en `/etc/nftables.conf` (servicio `nftables.service` habilitado la aplica en boot; `nft -c -f` valida el ruleset completo OK).
- **IP actual del runner a considerar en Neon IP allowlist si se activara:** `190.9.40.138` (egress); la dev es `190.142.61.56`.
- **Notas para SETUP.md:** el prerequisito del runner "egress TCP 5432 a Neon" se cumple con la regla de nftables/iptables del host (no firewalld). Si en otro runner el firewall vuelve a ser nftables puro con allowlist, la regla equivalente es `nft insert rule ip filter OUTPUT oifname != "lo" ip protocol tcp ct state new tcp dport 5432 accept`. Mantener el pin IPv4 del endpoint Neon en `/etc/hosts` (o mover el endpoint a un pool estÃ¡tico / IP allowlist) por ausencia de ruta IPv6.
- **Branch:** `develop` (sin cambios de cÃ³digo en el repo para este incidente â€” es infra del runner).

---

## 2026-09-17 â€” DocumentaciÃ³n y deuda tÃ©cnica: actualizaciÃ³n post-Dependabot masivo (PRs #77â€“#96)

- **Contexto:** tras la oleada de ~60 commits de Dependabot (septiembre 2026), se actualizÃ³ la documentaciÃ³n para reflejar el estado real del proyecto:
  - TypeScript 6.0.3, Next.js 16.3.5, ioredis 6.0.0, NextAuth v5 Î².32, vitest 5.0.0, Playwright 1.63.0, Zod 4.6.4, turbo 2.10.12, tailwindcss 4.3.3, resend 6.28.0, lucide-react 1.45.0, typescript-eslint 8.70.0, @types/node 26.5.1.
  - Fixes de lockfile por duplicados YAML (merge #95 vitest 4â†’5 major).
  - DocumentaciÃ³n del fix nftables egress 5432 en SETUP.md.
- **bitacora.md:** entrada consolidada registrando el batch completo de Dependabot y el incidente de infra del runner.
- **docs/brief tecnico fase 5.md:** actualizado a "Fase 6 completada + v0.9.0 en producciÃ³n" con referencia al blueprint v2.6.
- **docs/deuda-tecnica.md Ã­tem 4 RESUELTO:** declaradas dependencias explÃ­citas por hoisting:
  - `minio@^8.0.7` en `packages/storage/package.json` (usado en `src/index.ts`).
  - `bcryptjs@^3.0.3` en `apps/storefront/package.json` (usado en `lib/customer-auth.ts` y `app/api/register/route.ts`).
- **DoD verificado post-cambios:** `pnpm install` + `pnpm lint` 6/6 âœ“ + `pnpm typecheck` 9/9 âœ“ + `pnpm build` 3/3 âœ“ + `pnpm test` 430/430 âœ“.
- **Blueprint v2.6:** aprobado y referenciado (PDF en repo, pendiente conversiÃ³n a markdown para planificaciÃ³n de Fase 1).
- **Branch:** `develop`

---

## 2026-09-18 â€” DecisiÃ³n de infra: Neon single-branch hasta Fase 3

- **Contexto:** verificado Neon: solo hay 1 branch (`production`), compartida por local/preview/producciÃ³n. Sin tenants reales ni trÃ¡fico.
- **DecisiÃ³n consciente:** una sola branch en Neon hasta Fase 3. MitigaciÃ³n de migraciones = backup manual + revisiÃ³n de SQL.
- **Plan de Fase 1 actualizado:** T8 reescrito a estrategia backup-first (`pg_dump` â†’ revisiÃ³n del SQL â†’ `db:migrate` â†’ smoke tests â†’ restauraciÃ³n con `psql` si falla), riesgos R2/R3 y criterio de cierre alineados.
- **Registrado en:** `docs/deuda-tecnica.md` (Ã­tem 5, reevaluar antes de Fase 3).
- **Branch:** `docs/fase1-plan-adr024`

---

## 2026-09-18 â€” T1: pgcrypto habilitado en Neon

- **Secuencia real:**
  1. VerificaciÃ³n inicial en SQL Editor de Neon: `SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'` â†’ **0 filas** (no estaba habilitado).
  2. Edgar ejecutÃ³ manualmente: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
  3. VerificaciÃ³n posterior (desde worktree `chore/fase1-t1-pgcrypto-check`, rol owner vÃ­a `DATABASE_URL`):
     - `pg_extension` â†’ 1 fila (`pgcrypto`)
     - `pgp_sym_encrypt('test', 'clave') IS NOT NULL AS roundtrip_ok` â†’ `true`
     - Re-verificaciÃ³n final â†’ 1 fila
- **AcciÃ³n:** `CREATE EXTENSION` ejecutada manualmente (no-op en script posterior).
- **ConfirmaciÃ³n:** rol `app_user` (runtime vÃ­a `DATABASE_APP_URL`) NO tiene permisos para crear extensiones â€” solo owner `neondb_owner` (vÃ­a `DATABASE_URL`) puede.
- **Evidencia:** queries de verificaciÃ³n ejecutadas desde worktree `chore/fase1-t1-pgcrypto-check`.
- **Issue:** #101

---

## 2026-09-18 â€” T2: tabla `plans` en schema Drizzle + tests

- **Schema:** `dbPlans` agregado a `packages/db/src/schema.ts` con 13 columnas (`id`, `slug` unique, `name`, `displayName`, `priceUyu` integer centavos, `productLimit`, `variantLimitPerProduct`, `adminLimit`, `templateCount`, `subscriberLimit`, `features` jsonb, `isActive` boolean, `createdAt`), tabla global (sin tenantId, sin RLS), Ã­ndice Ãºnico `plans_slug_idx`, y tipos `Plan`/`NewPlan`.
- **Tests:** `describe('plans table')` en `packages/db/src/__tests__/schema.test.ts` verificando 13 columnas, `priceUyu` integer, y ausencia de `tenantId`.
- **DoD verificado:** `pnpm lint` 6/6 âœ“ + `pnpm typecheck` 9/9 âœ“ + `pnpm test` 11/11 âœ“ + `pnpm build` 3/3 âœ“.
- **Branch:** `feature/fase1-t2-plans` (mergeado en PR #116)
- **Issue:** #102

---

## 2026-09-19 â€” T3: tabla `subscriptions` en schema Drizzle + tests

- **Schema:** `dbSubscriptions` agregado a `packages/db/src/schema.ts` con 12 columnas (`id`, `tenantId` FKâ†’tenants cascade UNIQUE, `planId` FKâ†’plans restrict, `status` default `pending_first_payment`, `currentPeriodEnd`, `mpPreapprovalId`, `expiredAt`, `abandonedAt`, `lastProcessedPaymentId`, `createdAt`, `updatedAt`), Ã­ndices: Ãºnico en `tenantId` (`subscriptions_tenant_idx`) y en `status` (`subscriptions_status_idx`), y tipos `Subscription`/`NewSubscription`.
- **Tests:** `describe('subscriptions table')` en `packages/db/src/__tests__/schema.test.ts` con 7 casos: 11 columnas, FKs (tenantId cascade, planId restrict), unique index en tenantId, default status, nullabilidad de 4 columnas, NOT NULL en 7 columnas core.
- **DoD verificado:** `pnpm lint` 6/6 âœ“ + `pnpm typecheck` 9/9 âœ“ + `pnpm test` 18/18 âœ“ + `pnpm build` 3/3 âœ“.
- **Subagentes:** A (schema), B (tests), C (cross-check vs spec Â§4).
- **ObservaciÃ³n cross-check:** 3 hallazgos no bloqueantes: (1) naming divergence spec usa snake_case vs camelCase real; (2) `currentPeriodEnd` NOT NULL sin default en estado inicial; (3) migraciÃ³n pendiente (T5).
- **Branch:** `feature/fase1-t3-subscriptions`
- **Issue:** #103

---

## 2026-09-19 â€” T4: tabla `tenant_mp_config` en schema Drizzle + tests

- **Schema:** `dbTenantMpConfig` agregado a `packages/db/src/schema.ts` con 8 columnas (`id`, `tenantId`, `accessTokenEnc`, `webhookSecretEnc`, `publicKey`, `isVerified`, `createdAt`, `updatedAt`), FK `tenantId â†’ tenants.id ON DELETE CASCADE`, Ã­ndice Ãºnico `tenant_mp_config_tenant_idx` (1 config por tenant), `isVerified` default `false`, y tipos `TenantMpConfig`/`NewTenantMpConfig`.
- **Deviation del plan T4 (DoD):** el plan pedÃ­a importar `bytea` desde `drizzle-orm/pg-core`, pero **`bytea()` no existe en drizzle-orm 0.45.2** (verificado en node_modules; solo `gel-core/columns/bytes.cjs` lo menciona). Se usÃ³ `customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })` â€” emite SQL `bytea`, manteniendo el cumplimiento de ADR-024.
- **Tests:** `describe('tenant_mp_config table')` en `packages/db/src/__tests__/schema.test.ts` con 7 casos: export + 8 columnas, FK cascade vÃ­a `getTableConfig`, Ã­ndice Ãºnico sobre `tenantId`, `getSQLType() === 'bytea'` para ambos tokens (y `dataType !== 'string'`), ausencia de columnas plain-text (`accessToken`/`webhookSecret`), y `isVerified` default `false`.
- **DoD verificado:** `pnpm test` 438/438 âœ“ + `pnpm lint` 6/6 âœ“ + `pnpm typecheck` 9/9 âœ“ + `pnpm build` 3/3 âœ“.
- **Branch:** `feature/fase1-t4-tenant-mp-config`

---

## 2026-09-19 â€” Fix T3: currentPeriodEnd nullable (PR #119)

- **Contexto:** el PR #117 (T3) se mergeÃ³ sin el fix de currentPeriodEnd nullable que se acordÃ³ durante el review.
- **Fix:** currentPeriodEnd pasÃ³ a nullable. Propagado a schema, tests, plan, spec transversal (Â§4) y blueprint v2.6 (lÃ­nea 224).
- **Motivo:** en pending_first_payment no existe perÃ­odo. El valor se setea a now() + 1 month al recibir el primer payment.created.
- Aprobado en PR #119.
---

## 2026-09-19 â€” T5: MigraciÃ³n 0012 (plans, subscriptions, tenant_mp_config)

- **MigraciÃ³n generada:** `0012_tearful_supreme_intelligence.sql`
- **3 tablas:** plans, subscriptions, tenant_mp_config con FKs y UNIQUEs.
- **2 fixes incluidos en schema.ts durante el checkpoint de revisiÃ³n:**
  - Eliminada redundancia en plans.slug (UNIQUE CONSTRAINT + UNIQUE INDEX).
  - Agregado Ã­ndice en subscriptions.plan_idx (Postgres no auto-indexa FKs).
- **Deuda tÃ©cnica pre-existente detectada (no introducida por T5):**
  - gaps en _journal.json (idx 9â†’11, snapshots faltantes 3/4/9/10).

---

## 2026-09-19 â€” Fix: guard de migraciones (falso positivo en CI)

- **Contexto:** el guard `scripts/check-migrations.sh` fallaba con cualquier PR que agregara una migraciÃ³n nueva. Detectaba archivos agregados como si fueran modificaciones. El bug no se habÃ­a expuesto antes porque T2/T3/T4 no agregaron migraciones.
- **Fix:** `--diff-filter=MD` para filtrar modificaciones (M) y eliminaciones (D), y restringir los paths a `*.sql` y `*_snapshot.json` (excluir `_journal.json`, que es metadata).
- **Aplicado en PR #121 (T5) durante el review.**
- **Documentado en AGENTS.md y en comentario inline del script.

---

## 2026-09-20 â€” MigraciÃ³n 0013: GRANTs y FORCE RLS idempotente (Ã­tems 6-7)

**Contexto:**
Ãtems 6 y 7 de deuda tÃ©cnica bloqueaban T7 (RLS):
- Ãtem 6: gaps en _journal.json (0010_force_rls.sql no registrado, envs frescos sin FORCE RLS).
- Ãtem 7: GRANTs a app_user faltantes en las 3 tablas nuevas. En Postgres, RLS y privileges son capas separadas: sin GRANT, el rol app_user recibe permission denied aunque las policies existan.

**Estrategia elegida:**
MigraciÃ³n 0013 IDEMPOTENTE en lugar de editar _journal.json retroactivamente. Razones:
- Editar el journal para agregar 0010 romperÃ­a DBs ya migradas (drizzle intentarÃ­a re-aplicar CREATE POLICY sin IF NOT EXISTS).
- Una migraciÃ³n idempotente garantiza el estado deseado en cualquier entorno (prod ya forzada, frescos sin forzar), sin tocar el historial.

**Contenido de 0013:**
- GRANT SELECT, INSERT, UPDATE, DELETE en plans, subscriptions, tenant_mp_config para app_user.
- ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner: futuras tablas heredan los GRANTs.
- FORCE ROW LEVEL SECURITY en las 8 tablas existentes con policies de 0009 (products, product_variants, product_images, categories, customers, orders, order_items, shipping_methods).
- NOTA: subscriptions y tenant_mp_config reciben ENABLE + FORCE RLS + policies en T7, no en esta migraciÃ³n.

**Decisiones clave:**
- plans NO lleva RLS (es catÃ¡logo global, sin tenantId). ENABLE RLS sin policy serÃ­a fail-closed â†’ landing roto.
- subscriptions y tenant_mp_config tampoco reciben FORCE RLS en 0013: sin policies, fail-closed = checkout y panel admin bloqueados. Van en T7 junto con sus policies.
- El gap histÃ³rico del journal (0005_add_admin_users, 0010_force_rls no registrados) queda como decisiÃ³n consciente: no reconstruir, cubrir con migraciÃ³n nueva.

**LecciÃ³n aprendida (checklist de migraciones con RLS):**
El checklist de verificaciÃ³n de migraciones no distinguÃ­a entre tablas con RLS (tenantId + policy) y tablas globales (sin tenantId, sin RLS). En este PR, el primer checkpoint incluÃ­a ENABLE/FORCE RLS para plans â€” habrÃ­a roto el landing pÃºblico.

Regla a futuro (ver AGENTS.md):
- Antes de aprobar un ALTER TABLE ... ENABLE ROW LEVEL SECURITY, verificar que la tabla:
  a. Tiene columna tenantId.
  b. Tiene una policy tenant_isolation correspondiente.
- Si no cumple ambas â†’ NO debe llevar RLS.
- Tablas globales conocidas: plans, tenants.

**Archivos:**
- packages/db/migrations/0013_ensure_rls_and_grants.sql (nuevo)
- packages/db/migrations/meta/_journal.json (idx 13 agregado)
- packages/db/migrations/meta/0013_snapshot.json (nuevo, copia de 0012)
- docs/deuda-tecnica.md (Ã­tems 6 y 7 â†’ RESUELTOS)

**PR:** #124

---

## 2026-09-19 â€” T6: helper de cifrado/descifrado con pgcrypto

- Implementado: packages/commerce/src/encryption.ts
  - encryptToken(tenantId, key, values) â†’ upsert cifrado.
  - decryptToken(tenantId, key, column) â†’ descifra en memoria.
  - Clave como bind param directo (ADR-024 enmienda 2026-09-18).
  - EncryptionError tipado (EMPTY_KEY, ENCRYPTION_FAILED,
    DECRYPTION_FAILED, INVALID_COLUMN).
- Exportado como @repo/commerce/encryption.
- Tests: 19 (roundtrip, cross-tenant, bind params, fail-closed,
  columna invÃ¡lida, columna hardcoded).
- AuditorÃ­a QA + DiseÃ±ador: 1 ALTO resuelto (try/catch simÃ©trico),
  1 bug funcional detectado en review humano (decryptToken column
  como bind param), fix con mapa hardcodeado.
- Deuda registrada: Ã­tems 11-13 (Ã­tem 11 resuelto en este PR).
- PR #123.
- Merge: 2ca1ba8.

---

## 2026-09-19 â€” LecciÃ³n de proceso: T6 sin subagentes

- El agente implementÃ³ T6 sin usar subagentes de construcciÃ³n,
  violando la instrucciÃ³n explÃ­cita del prompt.
- JustificaciÃ³n: "T6 es una Ãºnica tarea cohesiva". No es vÃ¡lida â€”
  el prompt dividÃ­a T6 en 3 partes (implementaciÃ³n, tests,
  verificaciÃ³n).
- Cuarta vez consecutiva (T2, T4, T5, T6).
- Regla reforzada en AGENTS.md (PR #120): "Subagentes â€” confirmaciÃ³n
  obligatoria antes de empezar".
- AuditorÃ­a posterior (con subagentes) sÃ­ se ejecutÃ³ y encontrÃ³
  hallazgos reales.

---

## 2026-09-20 â€” VerificaciÃ³n app_user en Neon + grants

- VerificaciÃ³n manual en SQL Editor de Neon (branch production):
  - SELECT rolname, rolbypassrls, rolcanlogin FROM pg_roles WHERE
    rolname = 'app_user' â†’ app_user | f | t.
  - Grants en tablas existentes: SELECT/INSERT/UPDATE/DELETE en
    orders, products, tenants.
- Confirmado: app_user existe, sin BYPASSRLS, con LOGIN.
- Coincide con el connection string de DATABASE_APP_URL en runtime
  (postgresql://app_user:***@ep-...).
- ValidaciÃ³n Zod en packages/validation/src/env.ts exige "app_user"
  en DATABASE_APP_URL.
- Esta verificaciÃ³n es pre-requisito del merge del PR #124
  (migraciÃ³n 0013 hace GRANT ... TO app_user).

---

## 2026-09-20 â€” Release retroactiva v0.9.0

- Creada GitHub Release de v0.9.0 retroactivamente.
  - Tag existÃ­a (2026-08-12, commit b32cfe9) sin pÃ¡gina de Release.
  - v0.10.0 sÃ­ tenÃ­a Release, asÃ­ que se creÃ³ la de v0.9.0 para
    consistencia.
- Contenido de la Release:
  - RLS real + app_user + withTenantContext en 27 handlers +
    9 Server Components.
  - E2E Playwright (15 specs) + health checks + Sentry + UptimeRobot.
  - Tests: 430 / 55 archivos.
  - Rama: main.
- Nota: GitHub no permite backdatear publishedAt (se registra
  2026-09-21, aunque el tag es del 2026-08-12).

---

## 2026-09-20 â€” Incidente: docs/bitacora.md huÃ©rfano (PR #123)

**QuÃ© pasÃ³:**
El commit 5405afa (PR #123, T6) creÃ³ docs/bitacora.md como archivo
nuevo en lugar de modificar el bitacora.md raÃ­z. Resultado: dos
archivos con entradas de bitÃ¡cora; el root quedÃ³ sin las entradas
de T6 durante dÃ­as, y el huÃ©rfano tenÃ­a solo un subconjunto.

**Impacto:**
- Las entradas de T6 (helper de cifrado + lecciÃ³n de proceso) NO
  llegaron al root durante el PR #123 ni el PR #124.
- Detectado durante la verificaciÃ³n de bitÃ¡cora del PR #126.
- Ninguna entrada se perdiÃ³ definitivamente (el huÃ©rfano se
  conservÃ³). Las 2 entradas se re-integraron al root en el commit
  bd21103.

**Causa raÃ­z:**
El agente escribiÃ³ con una ruta relativa incorrecta (docs/bitacora.md
en lugar de bitacora.md). No es un fallo del merge â€” es un fallo en
la escritura del archivo.

**Fix aplicado:**
- docs/bitacora.md eliminado con git rm.
- Entradas de T6 re-integradas al root (bd21103).
- Verificado: no hay otros archivos .md mal ubicados en docs/.

**LecciÃ³n / regla:**
Al editar bitacora.md, usar siempre la ruta raÃ­z (bitacora.md, sin
prefijo). Verificar despuÃ©s de escribir con:

    git status  # no debe aparecer docs/bitacora.md

Y agregar la verificaciÃ³n al listado de "BitÃ¡cora append-only" en
AGENTS.md (PR B).

### 2026-09-21 â¬   T7: RLS en subscriptions y tenant_mp_config

- MigraciÃ³n 0014_enable_rls_new_tables.sql:
  - ENABLE + FORCE RLS + policy tenant_isolation en las 2 tablas.
  - plans NO lleva RLS (catÃ¡logo global, regla del PR #126).
  - Las 8 tablas de 0009 no se tocan.
- PatrÃ³n de policy idÃ©ntico a 0009:
  current_setting('app.tenant_id', true). El segundo argumento
  `true` es crÃ­tico: sin Ã©l, queries sin tenant context rompen
  (landing pÃºblica incluida).
- Smoke tests con app_user (cross-tenant bidireccional):
  tienda1 no ve filas de tienda2 en ninguna de las 2 tablas, y
  viceversa.
- Backup previo tomado y movido fuera del repo. .gitignore
  actualizado con `backup-*.sql`.
- Cleanup post-test: datos de prueba eliminados (tablas en 0 filas).
- Deuda tÃ©cnica registrada:
  - Ãtem 14: tracking de migraciones incompleto en BD actual.
  - Ãtem 15: snapshot Drizzle no refleja isRLSEnabled.
- Incidente en el PR: README agregado en meta/ rompiÃ³ drizzle-kit.
  Fix en 4de0187: movido a packages/db/migrations/.
- PR #127.

---

## 2026-09-23 — T8-T10: Seed de planes y suscripciones (cierre Fase 1)

- **T8 (verificación):** 0012/0013/0014 aplicadas en Neon
  (verificado con pg_class + journal). RLS activo en subscriptions
  y tenant_mp_config (relrowsecurity + relforcerowsecurity = true,
  policy tenant_isolation). plans sin RLS (catálogo global).

- **T9 (seed):** 3 planes insertados con onConflictDoNothing por
  slug.
  - Starter: 200000 centavos, 150 prod, 5 var/prod, 1 admin,
    0 plantillas, 250 subs.
  - Pro: 400000 centavos, 400 prod, 10 var/prod, 5 admin,
    3 plantillas, 1000 subs.
  - Business: 800000 centavos, ilimitados, 10 admin, 6 plantillas,
    ilimitados.

- **T10 (suscripciones):** tienda1 → Starter (active),
  tienda2 → Business (active). currentPeriodEnd = now() + 1 month.

- **Idempotencia:** verificada con 2 corridas consecutivas de
  pnpm db:seed (3 planes, 2 subs, sin duplicados).

- **Fix manual durante el desarrollo:** el seed no truncaba plans
  (tabla global sin tenantId). Agregado TRUNCATE TABLE plans
  CASCADE al inicio. Verificado empíricamente que CASCADE ignora
  RESTRICT de la FK (RESTRICT aplica a DELETE, no a TRUNCATE).

- **Guard de seguridad:** NODE_ENV === 'production' bloquea la
  ejecución. Deuda técnica ítem 16 registrada (guard adicional
  por DATABASE_URL antes de Fase 3).

- **PR #137** (limpieza scratch files) + PR pendiente Fase 1.
- **Fase 1 del blueprint v2.6:** ✅ completada.

---

## 2026-09-24 — Cierre formal de Fase 1: T11, T13 y 0015 preparado

- **T13:** `MP_TOKEN_ENCRYPTION_KEY` quedó required en todos los entornos con mínimo de 32 caracteres; las variables `MP_PLATFORM_*` quedaron opcionales hasta Fase 2. Se actualizaron `.env.local.example`, Zod, `turbo.json` y `SETUP.md`.
- **T11:** se agregó `packages/db/src/__tests__/rls-cross-tenant.test.ts` con conexión real a `DATABASE_APP_URL`, rol sin `BYPASSRLS`, 8 casos de lectura/escritura y cliente dedicado para el caso sin contexto. El INSERT de B bajo contexto A fue rechazado por RLS.
- **Grants:** se creó `0015_revoke_plans_dml.sql` para revocar solo INSERT/UPDATE/DELETE de `app_user` sobre `plans`, conservando SELECT. El grep de runtime solo encontró DML de planes en el seed.
- **Snapshots:** `drizzle-kit generate --custom` quedó bloqueado por la colisión preexistente de `id`/`prevId` entre 0012, 0013 y 0014; se creó el snapshot 0015 derivado sin modificar snapshots previos. Se registra como ítem 23 de deuda.
- **Verificación de conexiones:** storefront, admin y superadmin usan el cliente compartido `packages/db/src/index.ts`, con `DATABASE_APP_URL` y `app_user`; no se detectó uso de `DATABASE_URL` owner en runtime. No se agrega ítem 24 porque admin no usa owner.
- **E2E:** `NEON_DATABASE_APP_URL` está disponible en GitHub Secrets; el workflow ejecuta T11 con esa URL. No se aplicó 0015 ni se ejecutó seed contra Neon.
- **Nota:** reparación de corrupción UTF-16/NUL en entrada T7 (byte 128806). Excepción consciente al append-only: los bytes NUL no son contenido, son corrupción. Contenido textual preservado.
- **Nota:** no se ejecutó `pg_dump` porque el entorno de operación (Paseo, sin acceso físico) no tiene el binario disponible. `pnpm db:migrate` terminó con `Everything's fine`, pero 0015 no se aplicó: el post-check sigue mostrando `DELETE`, `INSERT`, `SELECT` y `UPDATE`, y el tracking público solo contiene la entrada con timestamp de 0014. No se ejecutaron smoke tests ni rollback porque el REVOKE no llegó a aplicarse. El rollback previsto sigue siendo `GRANT INSERT, UPDATE, DELETE ON plans TO app_user`.
- **Aplicación manual de 0015:** se ejecutó el REVOKE con owner, se verificó que `app_user` conserva solo `SELECT` y se insertó el hash de 0015 en `public.__drizzle_migrations` (2 filas). Smoke tests: `COUNT(*)=3` e INSERT rechazado con `42501 permission denied`. No se ejecutó seed.
- **Bug de tooling:** el script raíz `db:migrate` ejecuta `drizzle-kit up` y `setup` encadena el flujo roto; queda registrado como ítem 24 de deuda.
- **Corrección de estado:** la mención previa de que 0015 no se aplicaba correspondía al intento fallido de `drizzle-kit up`; después se aplicó manualmente el REVOKE y se insertó el tracking, como queda registrado arriba. El ítem 24 se refiere exclusivamente al bug de tooling, no a una conexión owner en admin.

---

## 2026-09-24 — Ítem 24: reset de migraciones con baseline limpio

**Contexto.** El ítem 24 ("script db:migrate roto") resultó ser más profundo de lo estimado. El inventario read-only reveló 5 problemas entrelazados:

1. `db:migrate` en `package.json` raíz corría `drizzle-kit up` (solo actualiza snapshots locales) en vez de `drizzle-kit migrate` (aplica a la DB).
2. Las migraciones 0000-0004 estaban en el journal pero sin archivo `.sql` en disco (se perdieron).
3. El tracking en `public.__drizzle_migrations` tenía solo 2 filas (0014, 0015), no las 16 esperadas.
4. Faltaban snapshots 0003, 0004, 0009, 0010.
5. `0005_add_admin_users.sql` era huérfana (en disco, fuera del journal).

**Hallazgo raíz durante la aplicación.** El branch efímero v2 (`verify-baseline-v2-20260924-183415`) reveló que drizzle-kit 0.31.x usa `drizzle.__drizzle_migrations` (schema `drizzle`), NO `public.__drizzle_migrations`. Todo el tracking manual insertado en `public` durante T7/T8 nunca fue leído por drizzle-kit. Causa raíz de por qué `db:migrate` devolvía "Everything's fine" con migraciones pendientes.

**Decisión (Estrategia B, aprobada por luisavilaland).** Reset con baseline limpio:
- Archivar el historial completo en `docs/migrations-archive/2026-09-24/`.
- Regenerar un único baseline (`0000_baseline.sql`) desde el schema actual (13 tablas).
- Incluir RLS + policies + GRANTs en el baseline (no solo CREATE TABLE): 10 tablas tenant-scoped con `ENABLE` + `FORCE ROW LEVEL SECURITY` y policy `tenant_isolation`; `plans` con SELECT únicamente para `app_user` (REVOKE heredado de 0015); GRANTs para las 13 tablas; función `set_tenant_id(UUID)` (SECURITY INVOKER + `set_config(..., true)` = SET LOCAL); `ALTER DEFAULT PRIVILEGES` para futuras tablas.
- Corregir `db:migrate`: `drizzle-kit up` → `drizzle-kit migrate`.
- Configurar tracking canónico en `drizzle.__drizzle_migrations`.

**Validación.** Branch efímero v2: `db:migrate` no-op, `db:seed` OK, smokes OK (`plans=3`, INSERT 42501, `subscriptions=2`), T11 RLS 8/8. Aplicado luego en production con la misma secuencia; T11 8/8, smokes OK. Backup: branch `pre-baseline-20260924` (`br-shiny-star-amlp7c0a`) desde production, con snapshot explícito y auto-delete de 7 días.

**Producción.** `drizzle.__drizzle_migrations` creado con el hash del baseline (`2d3f2533...`). `public.__drizzle_migrations` dropeado (artefacto inútil). Seed production: 2 tenants, 3 planes, 2 suscripciones, 4 órdenes.

**Deuda técnica.** Ítem 24 cerrado. `db:migrate` funciona ahora en entornos frescos. El script `setup` encadena `db:generate → db:migrate → db:seed` correctamente.

**Nota.** Primer intento de `INSERT plans` en smoke dio 42703 en lugar de 42501 por `displayName` sin comillas; los identificadores camelCase requieren quoting explícito en Postgres. Repetido con `"displayName"` devolvió el 42501 esperado. No fue un problema de permisos.

**DoD final.** Lint 6/6, typecheck 9/9, 474 tests en 57 archivos y build 3/3.

