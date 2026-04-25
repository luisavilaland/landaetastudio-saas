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
cp .env.local.example .env.local
pnpm install
```

### 2. Levantar servicios Docker
```bash
docker compose up -d
```

### 3. Configurar variables de entorno
Editar `.env.local` con los valores correspondientes:
- `DATABASE_URL` (PostgreSQL)
- `MERCADOPAGO_ACCESS_TOKEN` (sandbox de MP)

### 4. Migrar base de datos
```bash
pnpm db:generate
pnpm db:migrate
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

### Admin (tienda1)
- **Email:** admin@tienda1.com
- **Password:** 123456

### Base de datos (Docker)
- **Usuario:** saas
- **Contraseña:** saas123
- **Base:** saas_ecommerce

## MercadoPago (sandbox)

Para probar pagos:
1. Ir a https://www.mercadopago.com/developers/panel
2. Crear credenciales sandbox
3. Usar tarjetas de prueba:
   - Mastercard: 5031 7557 3450 0604
   - CVV: 123
   - Vencimiento: cualquier fecha futura

## Estado del proyecto

### ✅ Implementado
- [x] Carrito de compras (Redis + cookies)
- [x] Checkout con MercadoPago
- [x] Webhook de pago
- [x] Emails transaccionales (MailHog)

### ⏳ Pendiente
- [ ] Row Level Security en PostgreSQL
- [ ] Deploy a Vercel + Neon + Upstash