# AGENT GUIDANCE for saas-ecommerce

This document provides concise, high-signal information for AI agents working in this repository.

## Project Overview

- **Product:** SaaS eCommerce B2C/B2B targeting Uruguay/Cono Sur (PyMEs). Competitor reference: Fenicio.
- **Architecture:** Headless, API-first, multi-tenant moderno.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Applications (`apps/`):**
  - `storefront` – Tienda pública (Next.js, App Router).
  - `admin` – Panel del comercio (Next.js, rutas protegidas).
  - `superadmin` – Panel SaaS interno (gestión de tenants, planes, etc.).
- **Shared Packages (`packages/`):**
  - `db` – Drizzle ORM schema, migrations, client.
  - `commerce` – Business logic (cart, orders, pricing).
  - `ui` – Shared components (shadcn/ui).
  - `config` – Shared ESLint, TypeScript, Tailwind configs.

## Current Status

✅ **Completed:**
- Monorepo initialized with Turborepo and three Next.js apps.
- Docker Compose services: PostgreSQL 16, Redis 7, MinIO, MailHog.
- `.env.local` with local credentials.
- Drizzle ORM with all tables (camelCase columns).
- Authentication with NextAuth v5 (Credentials provider) in admin and superadmin.
- Login pages and protected routes in both apps.
- Multi-tenant middleware via proxy.ts.
- Env loading via dotenv in next.config.ts.
- Superadmin CRUD for tenants (API + UI).
- Logout functionality in admin and superadmin.
- Admin Products CRUD (API + UI): create, read, update, delete.
- Backend validation: price > 0, stock >= 0, SKU regeneration on slug update.
- Database indexes: unique (tenantId, slug) for products, (tenantId, email) for customers, (tenantId, sku) for variants.
- TenantId indexes on all business tables for query performance.

🔄 **Pending (see priorities below):**
- RLS policies (Row Level Security).
- Product images (MinIO).
- Checkout & MercadoPago.
- FK constraints in database.
- Normalize slug on create/edit.
- Prevent delete when product has orders.

## Development Setup (Local Only)

### Prerequisites
- Node.js 20+ and pnpm
- Docker Desktop (with WSL2 on Windows)
- Git

### Initial Setup (after cloning)
```bash
cp .env.local.example .env.local
docker-compose up -d
pnpm install
```

### Environment Variables (.env.local)
```
DATABASE_URL=postgresql://saas:saas123@localhost:5432/saas_ecommerce
REDIS_URL=redis://localhost:6379
AUTH_SECRET=02729723375753422536102479576611
NEXTAUTH_URL=http://localhost:3001
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=saas-media
MINIO_USE_SSL=false
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@saas.local
```

### Running Development Servers
```bash
pnpm dev
```
- Storefront: http://localhost:3000
- Admin: http://localhost:3001
- Superadmin: http://localhost:3002

### Database Commands
```bash
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Apply migrations
```

## Architecture Decisions

- **Multi-tenant:** Single DB with `tenantId` column on all tables.
- **Tenant resolution:** Middleware extracts from subdomain (lvh.me), injects `x-tenant-slug` header.
- **Pricing:** Always cents (integer) – never floats.
- **Dates:** Always UTC.
- **Auth:** NextAuth v5 with JWT strategy, tenantId in token claims.
- **Image storage:** Local MinIO (dev), Cloudflare R2 (prod).
- **Email:** Local MailHog (dev), Resend (prod).

## Key Files and Directories
```
saas-ecommerce/
├── apps/
│   ├── storefront/
│   │   └── proxy.ts              # Multi-tenant middleware
│   ├── admin/
│   │   ├── lib/auth.ts           # NextAuth config
│   │   ├── components/
│   │   │   ├── product-form.tsx
│   │   │   └── auth/session-provider.tsx
│   │   └── app/
│   │       ├── api/
│   │       │   ├── auth/[...nextauth]/route.ts
│   │       │   └── products/
│   │       │       ├── route.ts        # GET, POST
│   │       │       └── [id]/route.ts # GET, PUT, DELETE
│   │       ├── login/page.tsx
│   │       ├── dashboard/layout.tsx
│   │       ├── products/
│   │       │   ├── page.tsx         # List
│   │       │   ├── new/page.tsx      # Create
│   │       │   └── [id]/edit/page.tsx # Edit
│   │       └── page.tsx
│   └── superadmin/
│       ├── lib/auth.ts           # NextAuth config
│       ├── components/
│       │   ├── tenant-form.tsx
│       │   ├── logout-button.tsx
│       │   └── auth/session-provider.tsx
│       └── app/
│           ├── api/tenants/
│           ├── login/page.tsx
│           ├── (dashboard)/tenants/
│           └── page.tsx
├── packages/
│   └── db/
├── docker-compose.yml
├── .env.local
├── pnpm-workspace.yaml
└── turbo.json
```

## API Endpoints (Admin Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List all products |
| POST | /api/products | Create product |
| GET | /api/products/[id] | Get product |
| PUT | /api/products/[id] | Update product |
| DELETE | /api/products/[id] | Delete product |

## Test Users

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** tienda1 (id: 11111111-1111-1111-1111-111111111111)

## API Endpoints (Superadmin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tenants | List all tenants |
| POST | /api/tenants | Create tenant |
| GET | /api/tenants/[id] | Get tenant by ID |
| PUT | /api/tenants/[id] | Update tenant |
| DELETE | /api/tenants/[id] | Delete tenant |

## Important Notes

- DO NOT deploy to cloud until MVP works 100% locally.
- Use lvh.me for subdomain testing: tenant1.lvh.me:3000
- Migrations are immutable – generate new ones for changes.
- Keep schema columns in camelCase to match DB.

---

Last updated: April 23, 2026 – Admin products CRUD, indexes, validation fixes.

## Production Priorities

### 🔴 High Priority (Critical before production)

| # | Task | Status | Action |
|---|------|--------|--------|
| 1 | **RLS** | Not enabled | Enable Row Level Security policies per tenant |
| 2 | **AUTH_SECRET** | Has fallback | Validate env var exists in prod, remove default |
| 3 | **CSRF** | Disabled in admin | Enable CSRF in production |
| 4 | **NEXTAUTH_URL** | Hardcoded local | Use env var in production |

### 🟡 Medium Priority (Important)

| # | Task | Status | Action |
|---|------|--------|--------|
| 5 | **FK constraints** | Not in DB | Add FK or rely on app logic |
| 6 | **Normalize slug** | Accepts any format | Normalize on create/edit |
| 7 | **Delete protection** | No check | Prevent if product has order_items |
| 8 | **409 error UI** | Generic message | Improve error display |

### 🟢 Low Priority (Enhancements)

| # | Task | Notes |
|---|------|-------|
| 9 | Auth duplicated | admin/lib/auth.ts ≈ superadmin/lib/auth.ts → shared package |
| 10 | dotenv repeated | 3x in next.config.ts → packages/config |
| 11 | Default SVGs | vercel.svg, etc. → remove if unused |
| 12 | ProductsTable client | Could use Server Actions |