# Setup - Configuración del Proyecto

## Requisitos Previos

- Node.js 22+
- pnpm
- Cuentas activas en: Neon, Upstash, Cloudflare R2, Resend, MercadoPago

## Inicialización Rápida

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar .env.local.example a .env.local y llenar con credenciales reales
cp .env.local.example .env.local

# 3. Generar migraciones (si hay cambios en el schema)
pnpm db:generate

# 4. Aplicar migraciones
pnpm db:migrate

# 5. Ejecutar seed (limpia y crea datos de prueba)
pnpm db:seed
```

## Comandos de Base de Datos

| Comando | Descripción |
|--------|-------------|
| `pnpm db:generate` | Genera migraciones desde el schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:seed` | Limpia la BD y crea datos de prueba |

## Datos de Prueba

### admin

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Rol:** admin (tenant: tienda1)

### superadmin

- **Email:** super@admin.com
- **Password:** 123456
- **Rol:** superadmin (sin tenant)

### Cliente

- **Email:** cliente@ejemplo.com
- **Password:** 123456
- **Rol:** customer (tenant: tienda1)

### Tenant

- **Slug:** tienda1
- **Nombre:** Tienda Demo

### Productos de Prueba

- **Remera Básica** (Categoría: Remeras) - 6 variantes (S/M/L x Rojo/Azul)
- **Pantalón Jeans** (Categoría: Pantalones) - 6 variantes (38/40/42 x Azul/Negro)
- **Gorra** (Categoría: Accesorios) - 1 variante (Único, Negra)

### Métodos de Envío (tienda1)

- **Envío estándar** - $150 (gratis sobre $2000, 3-5 días hábiles)
- **Envío express** - $350 (1 día hábil)

### Órdenes de Ejemplo

- Orden #1: **confirmed** (2 remeras M rojas + 1 jean 40 azul)
- Orden #2: **pending_payment** (1 gorra negra + 1 remera L azul)

## Variables de Entorno — 3 archivos

| Archivo | Propósito | Git |
|---------|-----------|-----|
| `.env.example` | Template original del proyecto (legado) | ✅ tracked |
| `.env.local.example` | Template con servicios cloud como default | ✅ tracked |
| `.env.local` | Credenciales reales (copiar de `.env.local.example`) | ❌ ignorado |

**Solo `.env.local` contiene las credenciales reales** y no debe subirse a git. Los otros dos son templates de referencia.

Los servicios locales (Docker) ya no se usan. En su lugar:

| Servicio Local | Reemplazo Cloud |
|---------------|-----------------|
| PostgreSQL (Docker) | Neon |
| Redis (Docker) | Upstash |
| MinIO (Docker) | Cloudflare R2 |
| MailHog (Docker) | Resend |

## Validación de Variables de Entorno

La aplicación valida automáticamente las variables de entorno al arrancar (`packages/validation/src/env.ts`).

### Comportamiento por entorno

| Entorno | Validación |
|---------|-----------|
| **Desarrollo** (`NODE_ENV=development`) | Valida solo las variables core (`DATABASE_URL`, `AUTH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`). `NEXTAUTH_URL` es opcional (NextAuth v5 la infiere del Host header). Las variables cloud son opcionales. |
| **Producción** (`NODE_ENV=production`) | Valida core + todas las variables cloud (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `MERCADOPAGO_WEBHOOK_SECRET`, `STOREFRONT_URL`). |

### Si falta una variable

La app **no arrancará** y mostrará un error claro indicando qué variable falta o es inválida:

```
❌ Invalid environment variables for PRODUCTION:
  - RESEND_API_KEY: RESEND_API_KEY is required in production for email delivery
  - R2_ENDPOINT: R2_ENDPOINT must be a valid URL in production
```

### Agregar nuevas variables

Si agregás una variable de entorno nueva, actualizá:
1. `packages/validation/src/env.ts` - agregala al schema correspondiente (dev o prod)
2. `.env.example` y `.env.local.example` - agregá el placeholder
3. `SETUP.md` - documentala si es relevante para el setup

## Desarrollo

```bash
# Levantar todas las apps (desarrollo)
pnpm dev

# Iniciar todas las apps (producción, requiere build previo)
pnpm start

# Opcional: levantar solo una app
pnpm --filter storefront dev  # http://localhost:3000
pnpm --filter admin dev      # http://localhost:3001
pnpm --filter superadmin dev # http://localhost:3002
```

## Tunnel para Webhooks (dotunnel)

Para recibir webhooks de MercadoPago en desarrollo, necesitas exponer tu localhost públicamente usando `dotunnel`.

### dotunnel (npx)

```bash
npx dotunnel
```

Te pedirá:
1. Puerto local (ej: 3000)
2. Nombre para el proxy (ej: saas-ecommerce)

Te devolverá una URL pública (ej: `https://saas-ecommerce-prxy.ayooub.me`)

### Uso rápido

```bash
# Entrar puerto 3000
npx dotunnel

? Enter the local port of the service to expose (e.g., 8000): 3000
? Enter a name for the proxy (e.g., todo): saasecommerce

🌐 Forwarding to: http://localhost:3000
🔗 Public URL:    https://saasecommerce-prxy.ayooub.me
```

### Configurar STOREFRONT_URL en .env.local

```env
STOREFRONT_URL=https://saasecommerce-prxy.ayooub.me
```

### Testing del Webhook en Desarrollo

Para simular un webhook firmado correctamente (formato real de MercadoPago: `x-signature: ts=<ts>,v1=<v1>` con cadena canónica `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), genera `v1` con openssl y envialo contra el túnel:

```bash
# Simular webhook aprobado (paymentId 123456789)
TS=$(date +%s)
CANONICAL="id:123456789;ts:${TS};"   # sin x-request-id → la parte se omite
V1=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$MERCADOPAGO_WEBHOOK_SECRET" -hex | sed 's/^.*= //')
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=${TS},v1=${V1}" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"123456789"}}'

# Simular webhook rechazado (paymentId 000000)
TS=$(date +%s)
CANONICAL="id:000000;ts:${TS};"
V1=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$MERCADOPAGO_WEBHOOK_SECRET" -hex | sed 's/^.*= //')
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=${TS},v1=${V1}" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"000000"}}'
```

> **Nota:** La firma real en producción la genera MercadoPago (fail-closed), y `BYPASS_WEBHOOK_SIGNATURE=true` solo salta la verificación en desarrollo, nunca en producción. La ventana de validez del `ts` es de 300 segundos: si el webhook responde 401 por firma, verificá que el reloj esté sincronizado y que el `ts` sea actual.

> **Nota:** La URL del túnel cambia cada vez que reinicias `npx dotunnel`, a menos que uses un plan pago con dominio fijo. Si el webhook deja de funcionar, verifica que el túnel esté activo y actualiza `STOREFRONT_URL` en tu `.env.local` con la nueva URL.

## Troubleshooting

### Error de migraciones

```bash
# Eliminar todas las migraciones y regenerate
rm -rf packages/db/migrations
pnpm db:generate
pnpm db:migrate
```

## Testing Conventions

### Ejecutar Tests

```bash
pnpm test          # Todos los tests (vitest run)
pnpm test:e2e      # E2E Playwright (requiere apps corriendo + REDIS_URL)
pnpm lint          # Linting + formatting
pnpm typecheck     # TypeScript --noEmit
pnpm build         # Build de todas las apps
```

### Estado de Tests

**388 tests pasando, 0 fallos (51 archivos).** Todos los suites de test están operativos. Los helpers de test están centralizados en `@repo/test-utils` (`makeTxMock`, `session`, `mockReq`).

### Patrones de Testing

- **Handlers reales:** Los tests de endpoints importan los handlers reales (`import { GET, POST } from "../route"`) con mocks de dependencias (`withTenantContext`, Redis, storage). Patrón documentado en AGENTS.md → Helpers de test.
- **Ubicación:** `__tests__/` junto al archivo bajo test.
- **E2E:** Playwright en `e2e/` (ver sección E2E abajo).

### Herramientas adicionales

- **Logs estructurados:** `@repo/logger` con `createLogger('nombre')`. En desarrollo usa `pino-pretty` para logs legibles; en producción formato JSON. Incluir contexto (tenantId, userId, requestId) en cada log.
- **Sentry:** Integrado en las tres apps (`@sentry/nextjs`) para captura automática de errores en producción. Configuración condicional vía `SENTRY_DSN`. Si la variable no está presente, Sentry no se activa.
- **Validación de errores 409:** Todos los endpoints retornan `field` para identificar el campo conflictivo. Los formularios muestran errores inline con highlight visual rojo en el campo afectado.

### Tarjetas de prueba MercadoPago

> Próximamente: tarjetas de prueba para simular pagos aprobados y rechazados en el entorno de desarrollo de MercadoPago.

### Multi-tenant local

```bash
# Usar lvh.me para probar resolución de tenant
tenant1.lvh.me:3000
```

---

## Redis (carrito)

El carrito anónimo persiste en Redis vía ioredis. **Hay dos variables distintas, no confundir:**

| Variable | Cliente | Uso |
|----------|---------|-----|
| `REDIS_URL` | ioredis (`rediss://...:6379`) | **El carrito** (`@repo/commerce/redis.ts`). Es la que importa. Sensible a mayúsculas. |
| `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` | REST HTTP | Legacy/validación de producción. **No** usada por el carrito. |

⚠️ **Trap de `isProduction` en `packages/validation/src/env.ts`:** si `NODE_ENV=production` y está presente cualquiera de (`UPSTASH_REDIS_REST_URL`, `RESEND_API_KEY`, `R2_*`), el schema de producción **exige todas** las cloud vars — falta alguna → la app no arranca. El carrito solo necesita `REDIS_URL` (que no dispara `isProduction`), así que **no hace falta** agregar `UPSTASH_*` si no están las demás vars de producción.

---

## E2E (Playwright)

- Config en la raíz: `playwright.config.ts` (6 projects, `storageState` para admin/superadmin vía `global-setup.ts`).
- Specs en `e2e/` (storefront, checkout, admin, superadmin, security) — 14 specs.
- Env vars (ver `.env.local.example`): `E2E_STOREFRONT_URL`, `E2E_STOREFRONT_T2_URL`, `E2E_ADMIN_URL`, `E2E_SUPERADMIN_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`.
- CI: `.github/workflows/e2e.yml` — corre en **runner self-hosted** (AlmaLinux). Requisitos del runner:
  - Egress TCP a Neon (puerto 5432, IPv4 o IPv6) y red a los 3 dominios Vercel.
  - Si el host no tiene ruta IPv6, pin del endpoint Neon en `/etc/hosts`.
  - Libs de sistema de Chromium instaladas vía `dnf` (nss, atk, at-spi2-atk, cups-libs, libdrm, libxkbcommon, libXcomposite, libXdamage, libXfixes, libXrandr, mesa-libgbm, alsa-lib, pango, cairo, gtk3).
  - Guard anti-fork: los jobs se saltan PRs de forks (repo público + runner self-hosted = riesgo RCE).

## Nota

Última actualización: 08 de agosto de 2026 – Alineación documental post-incidente RLS (388 tests, E2E Playwright con CI self-hosted, sección Redis agregada). Rama `develop`. Build limpio.

## URLs de producción (Vercel)

| App | URL |
|-----|-----|
| Superadmin | https://landaetastudio-saas-superadmin.vercel.app |
| Admin | https://saas-admin-sable.vercel.app |
| Storefront | https://landaetastudio-saas-storefront.vercel.app |

## Deploy en Vercel

Cada app es un proyecto independiente en Vercel conectado al mismo repositorio.

### Configuración por proyecto

| App | Root Directory | Build Command |
|-----|---------------|---------------|
| Storefront | `apps/storefront` | `cd ../.. && pnpm run build --filter=storefront` |
| Admin | `apps/admin` | `cd ../.. && pnpm run build --filter=admin` |
| Superadmin | `apps/superadmin` | `cd ../.. && pnpm run build --filter=superadmin` |

Cada proyecto tiene su propio `vercel.json` en la carpeta de la app correspondiente.

### Variables de entorno en Vercel

Todas las variables cloud deben estar configuradas en cada proyecto:

- `DATABASE_URL`, `DATABASE_APP_URL`, `AUTH_SECRET` (core, obligatorias en todos)
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` (ioredis — storefront)
- `RESEND_API_KEY`
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `STOREFRONT_URL`
- `SUPERADMIN_HOST`, `ADMIN_HOST`, `DEFAULT_TENANT_SLUG`

### turbo.json

Las env vars deben estar declaradas en `turbo.json` > `tasks.build.env` para que Turbo 2 las exponga durante el build. Si agregás una variable nueva en Vercel, agregala también en `turbo.json`.

## Variables de entorno adicionales

- `SUPERADMIN_HOST` — dominio del superadmin en Vercel
- `ADMIN_HOST` — dominio del admin en Vercel  
- `DEFAULT_TENANT_SLUG` — tenant por defecto para el storefront (tienda1)
