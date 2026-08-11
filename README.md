# SaaS eCommerce MVP

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

# Roadmap

## Fase 1 – Autenticación y Órdenes ✅ (Completada)

- Auth de admins separada
- Registro y login de clientes en storefront
- Panel de órdenes en admin (lista, detalle, cambio de estado)

## Fase 2 – Dashboard y Stock ✅ (Completada)

- Dashboard con métricas reales (ventas del mes, órdenes pendientes, stock bajo/agotado)
- Gestión de stock con alertas visuales
- Edición rápida de stock en tabla de admin
- Badge "Agotado" en storefront y product-card
- Lista de productos con stock bajo en dashboard (enlace a editar)

## Fase 3 – Experiencia de Tienda Completa ✅ (Completada)

- Categorías de productos
- Búsqueda en catálogo
- Múltiples imágenes por producto
- Múltiples variantes reales (talle, color)
- Validación Zod en endpoints

## Fase 4 – Autoservicio del Tenant ✅ (Completada)

- ✅ Configuración visual del tenant (logo, colores)
- ✅ Dominio personalizado con verificación
- ✅ Métodos de envío configurables por tenant
- ✅ Página de perfil de tienda pública con SEO
- ✅ Checkout con selector visual de envío y cálculo dinámico
- ✅ Refactor de API: `NextResponse` unificado en todas las rutas
- ✅ 426 tests (100% passing), build limpio en 3 apps (hoy)

## Fase 5 – Producción ✅ (Completada)

- ✅ **RLS policies (Row Level Security)** - Implementado en tablas de negocio
- ✅ **AUTH_SECRET obligatorio** - Sin fallback hardcoded, validación al arrancar
- ✅ **CSRF protection** - Manejado automáticamente por NextAuth v5 en producción
- ✅ **Validación de variables de entorno en producción** - Zod valida al arrancar
- ✅ **Logs estructurados** - Pino en @repo/logger, desarrollo con pino-pretty, producción JSON
- ✅ **Sentry para errores en producción** - Integrado en las tres apps con DSN opcional
- ✅ **NEXTAUTH_URL dinámica** - Opcional; NextAuth v5 la infiere del Host header
- ✅ **Resolución de conflictos drizzle en @repo/auth** - Auth consolidada en paquete compartido
- ✅ **Normalización de slugs en create/edit** - Slugs consistentes en productos y categorías
- ✅ **Authentication hardening** - Sin credenciales expuestas, validación estricta
- ✅ **Mensajes de error 409 con campo específico** - UI inline con validación visual en formularios
- ✅ **Configuración de build corregida** - next.config.mjs para compatibilidad ESM

## Fase 6 – RLS real (withTenantContext) y E2E 🔄 (en curso)

- ✅ **withTenantContext real** - Transacción + `SET LOCAL set_tenant_id`, 27 handlers wireados, FORCE RLS + role `app_user` sin BYPASSRLS
- ✅ **DATABASE_APP_URL** obligatorio en runtime (rol app_user), `DATABASE_URL` solo build/migraciones
- ✅ **Incidente RLS Server Components (08-08) corregido** - 9 Server Components leían tablas con RLS directo (`db.`); envueltos en withTenantContext, admin vacío y 500 en /buscar solucionados
- ✅ **E2E Playwright** - 14 specs (storefront, checkout, admin, superadmin, security) con CI self-hosted
- ✅ **Carrito resiliente** - degradación progresiva cuando Redis está caído (wrappers `safeGet`/`redisSetEx`/`redisDel` + `whenReady`)
- ✅ **Barrido `console.*` completo** - 0 instancias en apps/ (excepción intencional: seed.ts y env.ts)
- 🔄 Pendiente: migración `develop → main`, assertions de contenido en E2E

---

## Estado actual

✅ **Completado:**
- Estructura monorepo con Turborepo (apps: `storefront`, `admin`, `superadmin`).
- Servicios cloud: PostgreSQL (Neon), Redis (Upstash), R2 (Cloudflare), Resend.
- Drizzle ORM configurado con todas las tablas (camelCase).
- Autenticación con NextAuth v5 (Credentials provider) en admin y superadmin.
- Login pages y rutas protegidas.
- Middleware multi-tenant con resolución de subdominios (proxy.ts en storefront; admin/superadmin no tienen proxy desde el cleanup del 10-07).
- CRUD de tenants en superadmin (API + UI).
- CRUD de productos en admin (API + UI): create, read, update, delete.
- Tipos TypeScript para NextAuth (tenantId, role).
- Logout functionality.
- Validación backend con Zod: price > 0, stock >= 0, SKU regeneration on slug update.
- Índices de base de datos: unique (tenantId, slug) para products, (tenantId, email) para customers, (tenantId, sku) para variants.
- Índices en tenantId en todas las tablas de negocio.
- Subida de imágenes a R2/cloud storage con FormData (@repo/storage).
- Múltiples imágenes por producto (tabla product_images, ordenamiento por position).
- Categorías de productos con CRUD completo.
- Variantes reales con JSONB (talle, color, SKU, stock independiente).
- Búsqueda server-side con ILIKE en storefront.
- Storefront: catálogo, página de detalle, navbar con categorías, búsqueda.
- **Carrito funcional:** Redis + cookie session, 7-day TTL, usuarios anónimos, variantes en carrito.
- **Checkout:** Flujo completo con MercadoPago (binary_mode).
- **Webhook:** Actualiza orden según notificación (HMAC fail-closed, idempotente por payment_id, modo simulación con x-test-order-id).
- **Email:** Confirmación de orden con Resend (@repo/commerce/email.ts).
- **Customer auth:** Registro y login de clientes en storefront (customer-auth.ts con withTenantContext).
- **Admin orders:** Panel de gestión de órdenes con cambio de status.
- **Admin dashboard:** Métricas (ventas, órdenes, stock), tabla de productos con stock bajo.
- **Stock management:** Edición rápida de stock en tabla, badge "Agotado", alertas en dashboard.
- **Métodos de envío:** API `GET /api/shipping` en storefront que lee `x-tenant-id` del proxy. Checkout con selector visual, cálculo dinámico de envío gratis, desglose subtotal + envío + total.
- **Seed:** 2 tenants (tienda1, tienda2), 2 métodos de envío para tienda1.
- **Fixes:** Bugs carrito, variantes, imágenes, validación tenant, queries N+1, logout redirects. Refactor completo de `new Response()` → `NextResponse` en todas las rutas.
- **E2E Playwright:** 14 specs + CI self-hosted (e2e.yml). Ver SETUP.md sección E2E.

### Fase 5 - Tareas de Seguridad Completadas ✅
- **Row Level Security (RLS)**: Implementado en todas las tablas de negocio con políticas `tenant_isolation`. Función `set_tenant_id` y helper `withTenantContext` en `@repo/db`.
- **AUTH_SECRET obligatorio**: Eliminado fallback hardcoded. Validación al arrancar en `@repo/auth` lanza error si falta la variable.
- **CSRF protection**: Manejado automáticamente por NextAuth v5 en producción (NODE_ENV=production). Documentado en `next.config.mjs`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **ORM:** Drizzle ORM
- **Auth:** NextAuth v5 (Auth.js)
- **Base de datos:** PostgreSQL 16
- **Cache/Carrito:** Redis (Upstash)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Email:** Resend
- **Pagos:** MercadoPago (Checkout Pro)
- **Monorepo:** Turborepo + pnpm
- **Validación:** Zod (endpoints API)

## Requisitos previos

- Node.js 22+ y pnpm
- Git
- Cuentas activas en: Neon, Upstash, Cloudflare R2, Resend, MercadoPago

## Primeros pasos

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd saas-ecommerce
cp .env.local.example .env.local
pnpm install
```

### 2. Configurar base de datos

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Ejecutar en desarrollo

```bash
pnpm dev
```

**URLs:**
- Storefront: http://localhost:3000
- Admin: http://localhost:3001
- Superadmin: http://localhost:3002

**Testing multi-tenant:**
```bash
# Usar lvh.me para testing de subdominios
tenant1.lvh.me:3000  # Tienda1 storefront
```

## Usuarios de prueba

### Admin

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** tienda1

### Superadmin

- **Email:** super@admin.com
- **Password:** 123456
- **Rol:** superadmin (sin tenant)

### Cliente

- **Email:** cliente@ejemplo.com
- **Password:** 123456

## Estructura del proyecto

```
saas-ecommerce/
├── apps/
│   ├── storefront/   # Tienda pública (Next.js) — incluye proxy multi-tenant
│   ├── admin/        # Panel del comercio (Next.js)
│   └── superadmin/   # Panel SaaS interno (Next.js)
├── packages/
│   ├── auth/         # NextAuth v5 para admin y superadmin
│   ├── db/           # Schema Drizzle, migrations, client, conTenantContext (RLS)
│   ├── commerce/     # Lógica de negocio (carrito, productos, emails, tenant, Redis)
│   ├── logger/       # Logs estructurados con Pino
│   ├── storage/      # Cliente R2/cloud storage (upload de imágenes)
│   ├── test-utils/   # Helpers de test (makeTxMock, session, mockReq)
│   └── validation/   # Schemas Zod compartidos
├── e2e/              # Tests end-to-end Playwright (14 specs)
├── docs/
│   ├── adr/          # Decisiones de arquitectura (ADR-001 a ADR-022)
│   └── superpowers/  # Specs y planes de diseño
├── playwright.config.ts
├── .env.local
├── pnpm-workspace.yaml
├── turbo.json
└── vercel.json
```

> **Nota:** cada app tiene su propio `vercel.json` (dentro de `apps/*/vercel.json`) y sus archivos de configuración (`next.config.mjs`, `sentry.*.config.ts`). `docker-compose.yml` fue eliminado — los servicios locales se reemplazaron por servicios cloud (Neon, Upstash, R2, Resend). Consulte SETUP.md para más detalles.

## Scripts

| Script | Descripción |
| :--- | :--- |
| `pnpm dev` | Levanta todas las apps en modo desarrollo |
| `pnpm start` | Inicia todas las apps en modo producción (requiere build previo) |
| `pnpm db:generate` | Genera migraciones desde el schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:seed` | Limpia la BD y crea datos de prueba |
| `pnpm test` | Ejecuta todos los tests (vitest) |
| `pnpm lint` | Linting + formatting |
| `pnpm typecheck` | Verificación de tipos TypeScript |
| `pnpm build` | Build de producción de todas las apps |

## API Endpoints

### Admin Products

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/products | Listar productos |
| POST | /api/products | Crear producto |
| POST | /api/products/import | Importar productos por CSV (transacción por fila, éxito parcial) |
| GET | /api/products/[id] | Obtener producto |
| PUT | /api/products/[id] | Actualizar producto |
| DELETE | /api/products/[id] | Eliminar producto |
| POST | /api/products/[id]/images | Subir imágenes |
| DELETE | /api/products/[id]/images/[imageId] | Eliminar imagen |
| GET/PUT | /api/products/[id]/variants | Gestionar variantes |

### Categories

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/categories | Listar categorías |
| POST | /api/categories | Crear categoría |
| GET | /api/categories/[id] | Obtener categoría |
| PUT | /api/categories/[id] | Actualizar categoría |
| DELETE | /api/categories/[id] | Eliminar categoría |

### Storefront Cart

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/cart | Obtener carrito |
| POST | /api/cart | Agregar item |
| PUT | /api/cart | Actualizar cantidad |
| DELETE | /api/cart | Eliminar item o vaciar |

### Storefront Catálogo

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/categories | Categorías activas del tenant |
| GET | /api/search | Búsqueda server-side con ILIKE (`?q=remera` o `?category=slug`) |

### Storefront Checkout

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/checkout | Crear orden desde carrito |
| POST | /api/checkout/preference | Crear preferencia de pago MP |
| POST | /api/webhooks/mercadopago | Notificación de pago |
| GET | /checkout/success | Página de éxito |
| GET | /checkout/failure | Página de fallo |
| GET | /checkout/pending | Página de pendiente |

### Admin Shipping

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/shipping | Listar métodos de envío del tenant |
| POST | /api/shipping | Crear método de envío |
| PUT | /api/shipping/[id] | Actualizar método de envío |
| DELETE | /api/shipping/[id] | Eliminar método de envío |

### Storefront Shipping

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/shipping | Métodos activos del tenant (lee `x-tenant-id` del proxy) |

### Admin Dashboard

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/dashboard | Métricas (ventas, órdenes, stock bajo) |

### Admin Orders

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/orders | Listar órdenes |
| GET | /api/orders/[id] | Obtener orden |
| PUT | /api/orders/[id] | Cambiar status |

### Admin Configuración del tenant

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/config/tenant | Configuración del tenant (logo, colores, contacto) |
| GET/PUT | /api/config/settings | Configuración visual (store_settings) |
| PUT | /api/config/tenant/domain | Dominio personalizado + verificación |
| GET | /api/domain-check | Verifica disponibilidad de un dominio (`?domain=`) |

### Superadmin Tenants

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/tenants | Listar tenants |
| POST | /api/tenants | Crear tenant |
| GET | /api/tenants/[id] | Obtener tenant |
| PUT | /api/tenants/[id] | Actualizar tenant |
| DELETE | /api/tenants/[id] | Eliminar tenant |
| GET | /api/domain-check | Verifica disponibilidad de un dominio |
| GET | /plans | Página de gestión de planes |

### Storefront Auth

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/register | Registrar nuevo cliente |
| POST | /api/auth/[...nextauth] | Login de cliente |

## MercadoPago

### Webhook

Para recibir notificaciones de pago en desarrollo:
1. Usar dotunnel: `npx dotunnel` y exponer el puerto 3000
2. Registrar esa URL en MP Developer Dashboard: `https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago`

> **Nota:** el storefront ya **no** usa `STOREFRONT_URL` para construir URLs públicas: la base (`proto` + `host`) se deriva del request entrante en cada llamada (`getStorefrontBaseUrl`), así los `back_urls` de MercadoPago y los links de emails apuntan al dominio real de cada tenant. La variable se mantiene en Vercel solo por validación de entorno (inerte en storefront).

MercadoPago firma cada notificación con el header `x-signature: ts=<ts>,v1=<v1>` y envía un header `x-request-id` aparte. La cadena canónica firmada es `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (las partes vacías se omiten) y `v1` es `HMAC-SHA256(cadena, MERCADOPAGO_WEBHOOK_SECRET)`. El webhook rechaza firmas cuyo `ts` esté fuera de una ventana de **300 segundos** (anti-replay) y es **fail-closed en producción**. Idempotente por `payment_id`. Modo simulación en desarrollo con header `x-test-order-id` (magic IDs `123456789` approved / `000000` rejected / `999999` pending). En previews de Vercel los magic IDs se activan con `E2E_WEBHOOK_TEST=1` (decisión 2026-08-10, ver AGENTS.md) — la firma HMAC se valida siempre. En desarrollo, `BYPASS_WEBHOOK_SIGNATURE=true` salta la verificación de firma — **nunca se salta en producción**.

Ejemplo de smoke test local (generar `v1` con openssl, solo en dev vía dotunnel):

```bash
TS=$(date +%s)
CANONICAL="id:123456789;ts:${TS};"                 # sin x-request-id → la parte se omite
V1=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$MERCADOPAGO_WEBHOOK_SECRET" -hex | sed 's/^.*= //')
curl -s -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=${TS},v1=${V1}" \
  -H "x-test-order-id: tenant-1:order-dev-123" \
  -d '{"type":"payment","data":{"id":"123456789"}}'
```

En producción la firma la genera MercadoPago: prod es fail-closed, por lo que este ejemplo de firma local solo aplica al túnel de desarrollo. Ver SETUP.md para detalles.

## Monitoreo / Health check

Cada app expone un endpoint **público** `GET /api/health` (sin sesión ni auth) para monitoreo:

| App | URL |
|-----|-----|
| Storefront | `https://tienda1.landaetastudio.com/api/health` |
| Admin | `https://admin.landaetastudio.com/api/health` |
| Superadmin | `https://superadmin.landaetastudio.com/api/health` |

**Implementación:** los tres endpoints delegan en el factory compartido `createHealthCheckHandler({ appName, hasRedis })` de `@repo/commerce/health` (las routes solo delegan). Redis se chequea solo en storefront (`hasRedis: true` + `REDIS_URL`); admin/superadmin siempre `"skipped"`.

Cada endpoint evalúa, con timeout de 4s por dependencia (`Promise.race`), tres checks:

- **DB**: `SELECT 1` con `db.execute` (fuera de `withTenantContext` — no toca tablas RLS).
- **Redis**: `redisPing()` solo en storefront (única app con `hasRedis: true`) y si `REDIS_URL` está configurada; `"skipped"` en cualquier otro caso (admin/superadmin no tocan Redis).
- **MercadoPago**: `"ok"` si `MERCADOPAGO_ACCESS_TOKEN` está presente; `"missing"` si no.

Respuestas:

- **200** `{ status: "ok", checks: { db, redis, mercadopago }, app, timestamp }`
- **503** `{ status: "degraded", checks, app, timestamp }` si algún check es `"error"` (fallo o timeout) o el token de MP falta (`"missing"`).

Ejemplo:

```json
{
  "status": "ok",
  "checks": { "db": "ok", "redis": "ok", "mercadopago": "ok" },
  "app": "storefront",
  "timestamp": "2026-08-08T17:00:00.000Z"
}
```

En storefront `/api/health` está excluida del matcher del proxy multi-tenant (`proxy.ts`) para que no devuelva 404 por resolución de tenant. Ver SETUP.md → Health Check / UptimeRobot.

### Estados de orden

| Estado | Descripción |
|--------|-------------|
| `pending_payment` | Orden creada, esperando pago |
| `confirmed` | Pago aprobado |
| `processing` | Pago confirmado, preparando envío |
| `shipped` | Enviado al cliente |
| `delivered` | Entregado al cliente |
| `cancelled` | Cancelada (antes de envío) |
| `refunded` | Devuelta/reembolsada |

## Prioridades para Producción

### 🔴 Alta prioridad (crítico antes de producción)

| # | Tarea |
| ---|-------|
| 1 | ✅ **RLS** - Habilitar políticas de fila por tenant |
| 2 | ✅ **AUTH_SECRET** - Validar que exista en prod, eliminar fallback |
| 3 | ✅ **CSRF** - Habilitar en producción |
| 4 | ✅ **NEXTAUTH_URL dinámica** - Opcional; NextAuth v5 la infiere del Host header |

### 🟡 Media prioridad

| # | Tarea |
| ---|-------|
| 1 | ✅ **Normalizar slug en create/edit** |
| 2 | ✅ **Consolidar auth duplicada en `@repo/auth`** |
| 3 | ✅ **Refactorizar lógica de negocio duplicada a `@repo/commerce`** |
| 4 | ✅ **Logs estructurados con Pino** |
| 5 | ✅ **Sentry para errores en producción** |
| 6 | ✅ **Mensajes de error 409 con campo específico** |

### 🟢 Baja prioridad

| # | Tarea |
| ---|-------|
| 1 | ✅ **Eliminar dotenv duplicado en `next.config.ts`** |
| 2 | ✅ **Mejorar UI de errores 409** |

## Notas importantes

- Los servicios Docker locales son reemplazables por cloud (ver SETUP.md).
- Usar `lvh.me` para testing de subdominios.
- Las migraciones son inmutables – generar nuevas para cambios.
- Prices siempre en centavos (integer), nunca floats.
- Cart funciona sin autenticación (usuarios anónimos).
- Checkout requiere email para enviar confirmación.

## Documentación adicional

- [Decisiones de arquitectura](./docs/arquitectura.md) – Por qué elegimos cada tecnología.
- [Guía de setup](./SETUP.md) – Configuración del proyecto y solución de problemas.
- [Guía para agentes de IA](./AGENTS.md) – Políticas y comandos para asistentes de código.
- [Prompts reutilizables](./PROMPTS.md) – Plantillas de prompts para agentes de IA.
- [Brief técnico Fase 5](./docs/brief%20tecnico%20fase%205.md) – Plan de producción.
- [Checklist de pruebas manuales](./TESTING-MANUAL.md) – Verificación manual por área.

## Tests

```bash
pnpm test        # Unit + integración (vitest)
pnpm test:e2e    # End-to-end Playwright (requiere apps corriendo)
```

- **Total:** 426 tests pasando, 0 fallos (55 archivos).
- Los helpers de test están centralizados en `@repo/test-utils` (`makeTxMock`, `session`, `mockReq`).
- Los endpoints importan los handlers reales (`../route`) con mocks de dependencias (`withTenantContext`, redis).
- 14 specs E2E en `e2e/` (storefront, checkout, admin, superadmin, security) — CI con runner self-hosted.

---

**Última actualización:** 10 de agosto de 2026 – Alineación documental post-PR44 (426 tests, factory de health check, decisión E2E_WEBHOOK_TEST). Rama `develop`. Build limpio.
