# SaaS eCommerce MVP - Fase 1

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

## Estado actual (Semana 1 - avance)

✅ **Completado hasta ahora**:
- Estructura monorepo con Turborepo (apps: `storefront`, `admin`, `superadmin`).
- Servicios Docker locales: PostgreSQL 16, Redis 7, MinIO (almacenamiento), MailHog (email).
- Variables de entorno base en `.env.local`.
- Scripts raíz agregados (ver más abajo).
- Dependencias compartidas instaladas (Drizzle, Auth.js, Redis, MinIO, etc.).
- Pendiente: configuración de Drizzle ORM, schema de DB y migraciones.

## Requisitos previos

- Node.js 20+ y pnpm
- Docker Desktop (con WSL2)
- Git

## Primeros pasos (para tu compañero)

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd saas-ecommerce
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.local.example .env.local
```

### 3. Levantar servicios Docker
```bash
docker-compose up -d
```
### 4. Instalar dependencias
```bash
pnpm install
```

### 5. (Próximamente) Configurar base de datos

Una vez que Drizzle esté configurado:
```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```
### 6. Ejecutar en desarrollo

```bash
pnpm dev
```
Storefront: http://localhost:3000

Admin: http://localhost:3001

Superadmin: http://localhost:3002

### Scripts disponibles (en package.json raíz)

|Script|Descripción|
|:-|:-|
|pnpm dev|Levanta todas las apps en modo desarrollo|
|pnpm db:generate|Genera migraciones desde el schema Drizzle|
|pnpm db:migrate|Ejecuta migraciones pendientes|
|pnpm db:seed|(Próximamente) Llena la DB con datos de prueba|
|pnpm setup|Ejecuta install, levanta Docker, genera y migra (pendiente de afinar)|

### Variables de entorno (.env.local)
```bash
# PostgreSQL local
DATABASE_URL=postgresql://saas:saas123@localhost:5432/saas_ecommerce

# Redis local
REDIS_URL=redis://localhost:6379

# Auth (Generado con https://numbergenerator.org/random-32-digit-number-generator)
AUTH_SECRET=02729723375753422536102479576611

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=C03NSVQ6UYKJAR5NZ34T
MINIO_SECRET_KEY=HTKZk97sQhYObHBXHcNZviOT7S72NBjx595ja5YO
MINIO_BUCKET=saas-media
MINIO_USE_SSL=false

# Email (MailHog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@saas.local
```

### Estructura del proyecto
```text
saas-ecommerce/
├── apps/
│   ├── storefront/     # Tienda pública (Next.js)
│   ├── admin/          # Panel del comercio (Next.js)
│   └── superadmin/     # Panel SaaS interno (Next.js)
├── packages/
│   ├── db/             # Schema Drizzle, migrations, client
│   ├── auth/           # Configuración compartida de Auth.js
│   ├── commerce/       # Lógica de negocio (carrito, órdenes)
│   ├── ui/             # Componentes comunes (shadcn/ui)
│   └── config/         # Configs compartidas (ESLint, TS, Tailwind)
├── docker-compose.yml
├── .env.local
├── turbo.json
└── package.json
```

### Próximos pasos (después de este commit)
Configurar Drizzle ORM y crear schema inicial (tenants, products, variants, orders, customers).

Implementar middleware multi-tenant con resolución de subdominios.

Autenticación con NextAuth (Auth.js) para admin y superadmin.

