# Agent Guidance for saas-ecommerce

This document provides concise, high-signal information for AI agents working in this repository.

## Project Overview

- **Product:** SaaS eCommerce B2C/B2B targeting Uruguay/Cono Sur (PyMEs). Competitor reference: Fenicio.
- **Architecture:** Headless, API-first, multi-tenant.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Applications (`apps/`):**
  - `storefront` – Tienda pública (Next.js, App Router).
  - `admin` – Panel del comercio (Next.js, rutas protegidas).
  - `superadmin` – Panel SaaS interno (gestión de tenants, planes, etc.).
- **Shared Packages (`packages/`):**
  - `db` – Drizzle ORM schema, migrations, client.
  - `storage` – MinIO client for image upload.

## Roadmap

### ✅ Fase 1 – Autenticación y Órdenes (Completada)

| Task | Status |
|------|--------|
| Auth de admins separada | ✅ |
| Registro y login de clientes en storefront | ✅ |
| Panel de órdenes en admin (lista, detalle, cambio de estado) | ✅ |

### ✅ Fase 2 – Dashboard y Stock (Completada)

| Task | Status |
|------|--------|
| Dashboard con métricas reales (ventas, pendientes, stock) | ✅ |
| Gestión de stock con alertas visuales | ✅ |
| Edición rápida de stock en tabla de admin | ✅ |
| Badge "Agotado" en storefront | ✅ |
| Lista de productos con stock bajo en dashboard | ✅ |

### 🔄 Fase 3 – Experiencia de Tienda Completa (Pendiente)

| Task | Status |
|------|--------|
| Categorías de productos | ❌ |
| Búsqueda en catálogo | ❌ |
| Múltiples imágenes por producto | ❌ |
| Múltiples variantes reales (talle, color) | ❌ |
| Validación Zod en endpoints | ❌ |

### 🔄 Fase 4 – Autoservicio del Tenant (Pendiente)

| Task | Status |
|------|--------|
| Configuración visual del tenant (logo, colors) | ❌ |
| Dominio personalizado | ❌ |
| Métodos de envío configurables | ❌ |
| Página de perfil de tienda | ❌ |

### 🔄 Fase 5 – Producción (Pendiente)

| Task | Status |
|------|--------|
| RLS policies (Row Level Security) | ❌ |
| Validación de variables de entorno en prod | ❌ |
| Logs estructurados | ❌ |
| Resolver conflicto drizzle en @repo/auth | ❌ |
| Normalizar slug on create/edit | ❌ |
| CSRF protection | ❌ |
| Authentication hardening | ❌ |

---

## Current Status

✅ **Completed:**
- Monorepo initialized with Turborepo and three Next.js apps.
- Docker Compose services: PostgreSQL 16, Redis 7, MinIO, MailHog.
- `.env.local` with local credentials.
- Drizzle ORM with all tables (camelCase columns).
- Authentication with NextAuth v5 (Credentials provider) in admin and superadmin.
- Login pages and protected routes in both apps.
- Multi-tenant middleware via proxy.ts (header-based).
- Superadmin CRUD for tenants (API + UI).
- Admin Products CRUD (API + UI): create, read, update, delete.
- Backend validation: price > 0, stock >= 0, SKU regeneration on slug update.
- Database indexes: unique (tenantId, slug) for products, (tenantId, email) for customers, (tenantId, sku) for variants.
- TenantId indexes on all business tables for query performance.
- Product images upload to MinIO with FormData support.
- Package `@repo/storage` for MinIO integration.
- Storefront: catalog page, product detail page, navbar, breadcrumbs.
- **Cart functionality:** Redis + cookie session (cart_session_id), 7-day TTL, anonymous users.
- **Checkout:** Full flow with MercadoPago integration.
- **Webhook:** Updates order status on payment notification (with duplicate prevention).
- **Email:** Confirmation email on successful payment.
- **Bug fixes:** inArray in cart/checkout, deleteImage path, tenant validation, N+1 queries, order_items check.
- **TypeScript types:** NextAuth extended types (tenantId, role), Product/Tenant nullable fields.
- **Webhook dev mode:** Simulation with paymentId 123456789 (approved) / 000000 (rejected).
- **Customer auth:** /register, /login in storefront with NextAuthCredentials.
- **Customer orders:** Checkout associates customerId from session.
- **Admin orders:** `/api/orders`, `/api/orders/[id]`, orders page and detail.
- **Admin dashboard:** `/api/dashboard` con métricas (ventas, órdenes, stock), página con tarjetas y tablas.
- **Stock management:** Edición rápida de stock en tabla de productos, badge "Agotado", stock bajo en storefront.
- **Stock alerts:** Lista de productos con stock bajo en dashboard (enlace a editar).

### Not Built Yet (Future Phases)
- **Storefront:** Customer auth (`/api/register`, lib/auth.ts, app/register, app/login), session-provider.
- **Admin:** Orders pages (app/orders/page.tsx, app/orders/[id]/page.tsx).

## Packages (`packages/`)

| Package | Status | Description |
|---------|--------|-------------|
| `db` | ✅ Done | Drizzle ORM schema, migrations, client. |
| `storage` | ✅ Done | MinIO client (uploadImage, deleteImage, getPublicUrl). |
| `auth` | 🟡 Partial | NextAuth shared config (created, pending drizzle version fix in Fase 5). |
| `commerce` | ❌ Missing | Business logic (cart, orders, pricing). |
| `ui` | ❌ Missing | Shared components (shadcn/ui). |
| `config` | ❌ Missing | Shared ESLint, TypeScript, Tailwind configs. |

### Prerequisites
- Node.js 20+ and pnpm
- Docker Desktop (with WSL2 on Windows)
- Git

### Initial Setup (after cloning)
```bash
cp .env.local.example .env.local
docker-compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
```

### Environment Variables (.env.local)
```
DATABASE_URL=postgresql://saas:saas123@localhost:5432/saas_ecommerce
REDIS_URL=redis://localhost:6379
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
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
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx
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
pnpm db:generate  # Generate migrations from schema
pnpm db:migrate  # Apply pending migrations
pnpm db:seed     # Seed database with test data
```

### Debugging

**Connect to PostgreSQL (Docker):**
```bash
docker exec -it saas-postgres psql -U saas -d saas_ecommerce
```

**Check tables:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

**Check data:**
```sql
SELECT * FROM tenants;
SELECT * FROM products;
SELECT * FROM admin_users;
```

**Reset database:**
```bash
pnpm db:seed  # Re-runs seed script to reset all data
```

## Architecture Decisions

- **Multi-tenant:** Single DB with `tenantId` column on all tables.
- **Tenant resolution:** Middleware extracts from subdomain (lvh.me), injects `x-tenant-slug` header.
- **Cart session:** Cookie `cart_session_id` (httpOnly, 30-day TTL) + Redis (7-day TTL).
- **Pricing:** Always cents (integer) – never floats.
- **Dates:** Always UTC.
- **Auth:** NextAuth v5 with JWT strategy, tenantId in token claims.
- **Image storage:** Local MinIO (dev), Cloudflare R2 (prod).
- **Email:** Local MailHog (dev), Resend (prod).
- **Payments:** MercadoPago (Checkout Pro).

## Key Files and Directories
```
saas-ecommerce/
├── apps/
│   ├── storefront/
│   │   ├── proxy.ts              # Multi-tenant + cart-session middleware
│   │   ├── lib/
│   │   │   ├── auth.ts             # Customer NextAuth config
│   │   │   ├── redis.ts          # Redis client (ioredis)
│   │   │   ├── cart.ts          # Cart utilities (getCart, removeFromCart)
│   │   │   ├── email.ts         # Email notifications
│   │   │   ├── products.ts      # Product queries
│   │   │   └── tenant.ts        # Tenant utilities
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/route.ts  # Customer auth
│   │   │   │   ├── cart/route.ts    # Cart API
│   │   │   │   ├── checkout/route.ts    # Create order
│   │   │   │   ├── checkout/preference/route.ts  # MP preference
│   │   │   │   ├── register/route.ts  # Customer registration
│   │   │   │   └── webhooks/mercadopago/route.ts  # MP webhook
│   │   │   ├── cart/page.tsx      # Cart page
│   │   │   ├── checkout/page.tsx  # Checkout form
│   │   │   ├── checkout/success/page.tsx
│   │   │   ├── checkout/failure/page.tsx
│   │   │   ├── checkout/pending/page.tsx
│   │   │   ├── products/[slug]/page.tsx  # Product detail
│   │   │   ├── register/page.tsx  # Customer register
│   │   │   └── login/page.tsx      # Customer login
│   │   └── components/
│   │       ├── add-to-cart-button.tsx
│   │       ├── cart-list.tsx
│   │       ├── navbar.tsx
│   │       ├── product-card.tsx
│   │       └── breadcrumbs.tsx
│   ├── admin/
│   │   ├── lib/auth.ts           # NextAuth config
│   │   ├── components/
│   │   │   ├── product-form.tsx
│   │   │   └── auth/session-provider.tsx
│   │   └── app/
│   │       ├── api/
│   │       │   ├── auth/[...nextauth]/route.ts
│   │       │   ├── dashboard/route.ts   # Dashboard metrics
│   │       │   ├── orders/
│   │       │   │   ├── route.ts        # GET, POST orders
│   │       │   │   └── [id]/route.ts   # GET, PUT orders
│   │       │   └── products/
│   │       │       ├── route.ts        # GET, POST
│   │       │       └── [id]/route.ts   # GET, PUT, DELETE
│   │       ├── login/page.tsx
│   │       ├── dashboard/
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx            # Dashboard with metrics
│   │       ├── products/
│   │       │   ├── page.tsx           # List
│   │       │   ├── new/page.tsx        # Create
│   │       │   └── [id]/edit/page.tsx  # Edit
│   │       └── orders/
│   │           ├── page.tsx           # Orders list
│   │           └── [id]/page.tsx      # Order detail
│   └── superadmin/
│       ├── lib/auth.ts           # NextAuth config
│       ├── components/
│       │   ├── tenant-form.tsx
│       │   ├── logout-button.tsx
│       │   └── auth/session-provider.tsx
│       └── app/
│           ├── api/
│           │   ├── auth/[...nextauth]/route.ts
│           │   └── tenants/
│           │       ├── route.ts        # GET, POST
│           │       └── [id]/route.ts # GET, PUT, DELETE
│           ├── login/page.tsx
│           └── (dashboard)/
│               ├── layout.tsx
│               └── tenants/
│                   ├── page.tsx         # List
│                   ├── new/page.tsx     # Create
│                   └── [id]/edit/page.tsx  # Edit
├── packages/
│   ├── db/             # Drizzle schema, migrations, client
│   └── storage/        # MinIO client
├── docker-compose.yml
├── .env.local
├── pnpm-workspace.yaml
└── turbo.json
```

## API Endpoints (Admin Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List all products (by tenantId) |
| POST | /api/products | Create product + default variant |
| GET | /api/products/[id] | Get product by ID |
| PUT | /api/products/[id] | Update product + variant (JSON or FormData) |
| DELETE | /api/products/[id] | Delete product + variants |

## API Endpoints (Admin Dashboard)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Get metrics (revenue, orders, stock alerts) |

## API Endpoints (Admin Orders)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orders | List orders (by tenantId) |
| GET | /api/orders/[id] | Get order by ID |
| PUT | /api/orders/[id] | Update order status |

## API Endpoints (Storefront Cart)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/cart | Get cart items (enriched with product data) |
| POST | /api/cart | Add item (productId, variantId, quantity) |
| PUT | /api/cart | Update item quantity |
| DELETE | /api/cart | Remove item or clear cart |

## API Endpoints (Storefront Checkout)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/checkout | Create order from cart |
| POST | /api/checkout/preference | Create MP payment preference |
| POST | /api/webhooks/mercadopago | MP payment notification |

## API Endpoints (Storefront Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/register | Register new customer |
| POST | /api/auth/[...nextauth] | NextAuth handler for customer login |

## Test Users

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** five-mice-do (id: 11111111-1111-1111-1111-111111111111)

## API Endpoints (Superadmin Tenants)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tenants | List all tenants |
| POST | /api/tenants | Create tenant |
| GET | /api/tenants/[id] | Get tenant by ID |
| PUT | /api/tenants/[id] | Update tenant |
| DELETE | /api/tenants/[id] | Delete tenant |

## Important Notes

- DO NOT deploy to cloud until MVP works 100% locally.
- Use lvh.me for subdomain testing: `tenant1.lvh.me:3000`
- Migrations are immutable – generate new ones for changes.
- Keep schema columns in camelCase to match DB.
- Cart works for anonymous users (no auth required).
- `dotenv` is loaded in each `next.config.ts` for dev convenience.
- For MP webhook in development: use ngrok or polling on success page.

## Testing Conventions

- Use `lvh.me` subdomains for tenant resolution in local development.
- Webhook simulation: POST to `/api/webhooks/mercadopago` with `x-test-order-id` header and `data.id` = `123456789` (approved) or `000000` (rejected).
- Test cards: approved `5031 7557 3453 0604`, rejected `4509 9535 6777 0071`.
- Test users: admin@tienda1.com / super@admin.com / customers registered via /register.

---

Last updated: April 27, 2026 – Fase 2 complete: Dashboard + Stock management.

## Production Priorities (Fase 5)

### 🔴 High Priority (Critical before production)

| # | Task | Status | Action |
|---|------|--------|--------|
| 1 | **RLS** | Not enabled | Enable Row Level Security policies per tenant |
| 2 | **AUTH_SECRET** | Has fallback | Validate env var exists in prod, remove default |
| 3 | **CSRF** | Disabled in admin/superadmin | Enable CSRF in production |
| 4 | **NEXTAUTH_URL** | Hardcoded local | Use env var in production |

### 🟡 Medium Priority (Important)

| # | Task | Status | Action |
|---|------|--------|--------|
| 5 | **Normalize slug** | Accepts any format | Normalize on create/edit |
| 7 | **409 error UI** | Generic message | Improve error display |

### 🟢 Low Priority (Enhancements)

| # | Task | Notes |
|---|------|-------|
| 8 | Auth duplicated | admin/lib/auth.ts ≈ superadmin/lib/auth.ts → shared package |
| 9 | dotenv repeated | 3x in next.config.ts → packages/config |
| 10 | Default SVGs | vercel.svg, etc. → remove if unused |
| 11 | ProductsTable client | Could use Server Actions |
| 12 | Missing packages | commerce, ui, config not yet created |