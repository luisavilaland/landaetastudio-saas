# SaaS eCommerce MVP

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

## Estado actual

✅ **Completado:**
- Estructura monorepo con Turborepo (apps: `storefront`, `admin`, `superadmin`).
- Servicios Docker locales: PostgreSQL 16, Redis 7, MinIO, MailHog.
- Drizzle ORM configurado con todas las tablas (camelCase).
- Autenticación con NextAuth v5 (Credentials provider).
- Login page y rutas protegidas.
- Middleware multi-tenant con resolución de subdominios.
- Carga de variables de entorno desde la raíz del monorepo.

🔄 **En desarrollo:**
- Panel de productos y catálogo.
- Checkout y MercadoPago.

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
│   └── db/             # Schema Drizzle, migrations, client
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