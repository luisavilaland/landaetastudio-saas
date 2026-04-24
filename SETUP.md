# Setup Local — SaaS eCommerce

## Requisitos
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop

## Pasos para correr el proyecto

### 1. Clonar e instalar
```bash
git clone https://github.com/luisavilaland/landaetastudio-saas.git
cd landaetastudio-saas
pnpm install
```

### 2. Levantar servicios Docker
```bash
docker compose up -d
```

### 3. Variables de entorno
Crear `.env.local` en la raíz del proyecto con los valores del archivo
`.env.example` (pedirlos al equipo por canal privado).

### 4. Crear tablas en la base de datos
```bash
cd packages/db
DATABASE_URL=<tu_database_url> npx drizzle-kit push
cd ../..
```

### 5. Levantar las apps
```bash
pnpm dev
```

## URLs locales
| App | URL |
|-----|-----|
| Storefront | http://localhost:3000 |
| Admin | http://localhost:3001 |
| Superadmin | http://localhost:3002 |
| MinIO Console | http://localhost:9001 |
| MailHog | http://localhost:8025 |

## Credenciales de prueba
Solicitar al equipo por canal privado (Slack / WhatsApp).

## Próximos pasos (Fase 3 y 4)
- [ ] Carrito de compras con Redis
- [ ] Checkout con MercadoPago (sandbox)
- [ ] Emails transaccionales con Resend
- [ ] Row Level Security en PostgreSQL
- [ ] Deploy a Vercel + Neon + Upstash
