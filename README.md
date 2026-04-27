# SaaS eCommerce MVP

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

## Estado actual

✅ **Completado:**
- Estructura monorepo con Turborepo (apps: `storefront`, `admin`, `superadmin`).
- Servicios Docker locales: PostgreSQL 16, Redis 7, MinIO, MailHog.
- Drizzle ORM configurado con todas las tablas (camelCase).
- Autenticación con NextAuth v5 (Credentials provider) en admin y superadmin.
- Login pages y rutas protegidas.
- Middleware multi-tenant con resolución de subdominios (proxy.ts).
- CRUD de tenants en superadmin (API + UI).
- CRUD de productos en admin (API + UI): create, read, update, delete.
- Logout functionality.
- Validación backend: price > 0, stock >= 0, SKU regeneration on slug update.
- Índices de base de datos: unique (tenantId, slug) para products, (tenantId, email) para customers, (tenantId, sku) para variants.
- Índices en tenantId en todas las tablas de negocio.
- Subida de imágenes a MinIO con FormData.
- Paquete `@repo/storage` para integración con MinIO.
- Storefront: catálogo, página de detalle, navbar, breadcrumbs.
- **Carrito funcional:** Redis + cookie session, 7-day TTL, usuarios anónimos.
- **Checkout:** Flujo completo con MercadoPago.
- **Webhook:** Actualiza orden según notificación (con prevención de duplicados).
- **Email:** Confirmación de orden con nodemailer.
- **Fixes:** Bug inArray en cart/checkout, deleteImage, validación tenant, queries N+1, order_items check.

🔄 **En desarrollo:**
- Políticas RLS.
- Normalizar slug en create/edit.

## Requisitos previos

- Node.js 20+ y pnpm
- Docker Desktop (con WSL2)
- Git

## Primeros pasos

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd saas-ecommerce
cp .env.local.example .env.local
pnpm install
```

### 2. Levantar servicios Docker

```bash
docker-compose up -d
```

### 3. Configurar base de datos

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

## Usuario de prueba

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** five-mice-do (id: 11111111-1111-1111-1111-111111111111)

## Estructura del proyecto

```
saas-ecommerce/
├── apps/
│   ├── storefront/     # Tienda pública (Next.js)
│   ├── admin/          # Panel del comercio (Next.js)
│   └── superadmin/     # Panel SaaS interno (Next.js)
├── packages/
│   ├── db/             # Schema Drizzle, migrations, client
│   └── storage/        # MinIO client for image upload
├── docker-compose.yml
├── .env.local
├── pnpm-workspace.yaml
└── turbo.json
```

## Scripts

|Script|Descripción|
|:-:|-|
|pnpm dev|Levanta todas las apps en modo desarrollo|
|pnpm db:generate|Genera migraciones desde el schema Drizzle|
|pnpm db:migrate|Ejecuta migraciones pendientes|

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **ORM:** Drizzle ORM
- **Auth:** NextAuth v5 (Auth.js)
- **Base de datos:** PostgreSQL 16
- **Cache/Carrito:** Redis 7
- **Storage:** MinIO (S3-compatible)
- **Email:** MailHog (dev) / Resend (prod)
- **Pagos:** MercadoPago (Checkout Pro)
- **Monorepo:** Turborepo + pnpm

## API Endpoints

### Admin Products

|Method|Endpoint|Descripción|
|:-:|-|/api/products|Listar productos|
|POST|/api/products|Crear producto|
|GET|/api/products/[id]|Obtener producto|
|PUT|/api/products/[id]|Actualizar producto|
|DELETE|/api/products/[id]|Eliminar producto|

### Storefront Cart

|Method|Endpoint|Descripción|
|:-:|-|/api/cart|Obtener carrito|
|POST|/api/cart|Agregar item|
|PUT|/api/cart|Actualizar cantidad|
|DELETE|/api/cart|Eliminar item o vaciar|

### Storefront Checkout

|Method|Endpoint|Descripción|
|:-:|-|/api/checkout|Crear orden desde carrito|
|POST|/api/checkout/preference|Crear preferencia de pago MP|
|POST|/api/webhooks/mercadopago|Notificación de pago|

### Superadmin Tenants

|Method|Endpoint|Descripción|
|:-:|-|/api/tenants|Listar tenants|
|POST|/api/tenants|Crear tenant|
|GET|/api/tenants/[id]|Obtener tenant|
|PUT|/api/tenants/[id]|Actualizar tenant|
|DELETE|/api/tenants/[id]|Eliminar tenant|

## MercadoPago - Configuración

### Variables de entorno

```env
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx
```

### Webhook

Para recibir notificaciones de pago en desarrollo:
1. Usar ngrok: `ngrok http 3000`
2. Configurar URL en MP Developer Dashboard: `https://tu-subdomain.ngrok.io/api/webhooks/mercadopago`

### Estados de orden

| Estado | Descripción |
|--------|-------------|
| `pending_payment` | Orden creada, esperando pago |
| `confirmed` | Pago aprobado |
| `payment_failed` | Pago rechazado/cancelado |

## Prioridades para Producción

### 🔴 Alta prioridad (crítico antes de producción)

| # | Tarea |
|---|-------|
| 1 | **RLS** - Habilitar políticas de fila por tenant |
| 2 | **AUTH_SECRET** - Validar que exista en prod, eliminar fallback |
| 3 | **CSRF** - Habilitar en producción |
| 4 | **NEXTAUTH_URL** - Usar variable de entorno |

### 🟡 Media prioridad

| # | Tarea |
|---|-------|
| 5 | Normalizar slug en create/edit |
| 6 | Prevenir eliminación si hay order_items |
| 7 | Mejorar UI de errores 409 |

### 🟢 Baja prioridad

| # | Tarea |
|---|-------|
| 8 | Extraer auth duplicado a paquete compartido |
| 9 | dotenv repetido en next.config.ts |
| 10 | Productos con Server Actions |
| 11 | Paquetes faltantes: commerce, ui, config |

## Notas importantes

- NO hacer deploy a cloud hasta que el MVP funcione 100% local.
- Usar `lvh.me` para testing de subdominios.
- Las migraciones son immutables – generar nuevas para cambios.
- Prices siempre en centavos (integer), nunca floats.
- Cart funciona sin autenticación (usuarios anónimos).
- Checkout requiere email para enviar confirmación.