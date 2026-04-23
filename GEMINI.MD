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
- Authentication with NextAuth v5 (Credentials provider).
- Login page and protected routes.
- Multi-tenant middleware via proxy.ts.
- Env loading via dotenv in next.config.ts.

🔄 **Pending:**
- Superadmin with Auth.js.
- RLS policies.
- Product catalog & admin panel.
- Checkout & MercadoPago.

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
│   │   ├── lib/auth.ts          # NextAuth config
│   │   ├── app/
│   │   │   ├── api/auth/[...nextauth]/route.ts
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/layout.tsx
│   │   │   └── page.tsx
│   │   └── components/auth/session-provider.tsx
│   └── superadmin/
├── packages/
│   └── db/
│       ├── drizzle.config.ts
│       ├── migrations/
│       └── src/
│           ├── index.ts        # Drizzle client
│           └── schema.ts      # All tables (camelCase)
├── docker-compose.yml
├── .env.local
├── pnpm-workspace.yaml
└── turbo.json
```

## Test Users

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** tienda1 (id: 11111111-1111-1111-1111-111111111111)

## Important Notes

- DO NOT deploy to cloud until MVP works 100% locally.
- Use lvh.me for subdomain testing: tenant1.lvh.me:3000
- Migrations are immutable – generate new ones for changes.
- Keep schema columns in camelCase to match DB.

---

Last updated: April 23, 2026 – Authentication working, login page, protected dashboard.