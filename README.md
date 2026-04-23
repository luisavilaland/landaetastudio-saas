# SaaS eCommerce MVP

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

## Estado actual

✅ **Completado:**
- Estructura monorepo con Turborepo (apps: `storefront`, `admin`, `superadmin`).
- Servicios Docker locales: PostgreSQL 16, Redis 7, MinIO, MailHog.
- Drizzle ORM configurado con todas las tablas (camelCase).
- Autenticación con NextAuth v5 (Credentials provider) en admin y superadmin.
- Login pages y rutas protegidas.
- Middleware multi-tenant con resolución de subdominios.
- CRUD de tenants en superadmin (API + UI).
- CRUD de productos en admin (API + UI).
- Logout functionality.
- Carga de variables de entorno desde la raíz del monorepo.
- Validación backend: price > 0, stock >= 0, SKU regeneration on slug update.
- Índices de base de datos: unique (tenantId, slug) para products, (tenantId, email) para customers, (tenantId, sku) para variants.
- Índices en tenantId en todas las tablas de negocio.
- Subida de imágenes a MinIO con FormData.
- Paquete `@repo/storage` para integración con MinIO.

🔄 **En desarrollo:**
- Checkout y MercadoPago.
- Políticas RLS.
- Normalizar slug en create/edit.
- Prevenir eliminación si el producto tiene pedidos.

## Requisitos previos

- Node.js 20+ y pnpm
- Docker Desktop (con WSL2)
- Git

## Primeros pasos

### 1. Clonar e instalar

```bash
git clone <url-del-repo>
cd saas-ecommerce
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

** URLs:**
- Storefront: http://localhost:3000
- Admin: http://localhost:3001
- Superadmin: http://localhost:3002

## Usuario de prueba

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** tienda1 (id: 11111111-1111-1111-1111-111111111111)

## Prioridades para Producción

### 🔴 Alta prioridad (crítico antes de producción)

| # | Tarea |
|---|-------|
| 1 | **RLS** - Habilitar políticas de fila por tenant |
| 2 | **AUTH_SECRET** - Validar que exista en prod, eliminar fallback |
| 3 | **CSRF** - Habilitar en producción |
| 4 | **NEXTAUTH_URL** - Usar variable de entorno en prod |

### 🟡 Media prioridad

| # | Tarea |
|---|-------|
| 5 | FK constraints en base de datos |
| 6 | Normalizar slug en create/edit |
| 7 | Prevenir eliminación si hay order_items |
| 8 | Mejorar UI de errores 409 |

### 🟢 Baja prioridad

| # | Tarea |
|---|-------|
| 9 | Extraer auth duplicado a paquete compartido |
| 10 | dotenv repetido en next.config.ts |
| 11 | Eliminar SVGs por defecto |
| 12 | ProductsTable con Server Actions |

## Scripts

|Script|Descripción|
|:-|:-|
|pnpm dev|Levanta todas las apps en modo desarrollo|
|pnpm db:generate|Genera migraciones desde el schema Drizzle|
|pnpm db:migrate|Ejecuta migraciones pendientes|

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
└── turbo.json
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **ORM:** Drizzle ORM
- **Auth:** NextAuth v5 (Auth.js)
- **Base de datos:** PostgreSQL 16
- **Cache:** Redis 7
- **Storage:** MinIO (S3-compatible)
- **Email:** MailHog (dev) / Resend (prod)
- **Monorepo:** Turborepo + pnpm