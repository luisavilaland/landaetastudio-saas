# Setup - Configuración del Proyecto

## Requisitos Previos

- Node.js 20+
- pnpm
- Docker Desktop (con PostgreSQL, Redis, MinIO, MailHog)

## Inicialización Rápida

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar servicios Docker
docker-compose up -d

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

## Limpiar Base de Datos Manualmente

### Opción 1: Usando el seed (recomendado)

```bash
pnpm db:seed
```

El seed automáticamente:
- Limpia todas las tablas (TRUNCATE CASCADE)
- Crea tenant por defecto
- Crea admins y superadmin
- Crea productos de ejemplo
- Crea cliente de prueba

### Opción 2: Directamente en PostgreSQL

```bash
# Conectar al contenedor
docker exec -it saas-postgres psql -U saas -d saas_ecommerce

# Dentro de PSQL, ejecutar:
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE product_variants CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE admin_users CASCADE;
TRUNCATE TABLE tenants CASCADE;

-- Verificar
SELECT count(*) FROM tenants;
SELECT count(*) FROM products;
SELECT count(*) FROM admin_users;
```

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

### Órdenes de Ejemplo

- Orden #1: **confirmed** (2 remeras M rojas + 1 jean 40 azul)
- Orden #2: **pending_payment** (1 gorra negra + 1 remera L azul)

## Variables de Entorno

Crear `.env.local` basado en `.env.local.example`:

```env
DATABASE_URL=postgresql://saas:saas123@localhost:5432/saas_ecommerce
REDIS_URL=redis://localhost:6379
AUTH_SECRET=<generar-con-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3001

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=saas-media
MINIO_USE_SSL=false

# Email (MailHog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@saas.local

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx
```

## Desarrollo

```bash
# Levantar todas las apps
pnpm dev

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

```bash
# Simular webhook aprobado (paymentId 123456789)
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"123456789"}}'

# Simular webhook rechazado (paymentId 000000)
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"000000"}}'
```

> **Nota:** La URL del túnel cambia cada vez que reinicias `npx dotunnel`, a menos que uses un plan pago con dominio fijo. Si el webhook deja de funcionar, verifica que el túnel esté activo y actualiza `STOREFRONT_URL` en tu `.env.local` con la nueva URL.

## Troubleshooting

### PostgreSQL no conecta

```bash
# Verificar que el contenedor está corriendo
docker ps

# Reiniciar contenedor
docker restart saas-postgres
```

### Redis no conecta

```bash
docker restart saas-redis
```

### Error de migraciones

```bash
# Eliminar todas las migraciones y regenerate
rm -rf packages/db/migrations
pnpm db:generate
pnpm db:migrate
```

## Testing Conventions

### Tarjetas de prueba MercadoPago

> Próximamente: tarjetas de prueba para simular pagos aprobados y rechazados en el entorno de desarrollo de MercadoPago.

### Multi-tenant local

```bash
# Usar lvh.me para probar resolución de tenant
tenant1.lvh.me:3000
```

## Nota

Última actualización: 28 de abril de 2026 – Fase 3 completada: categorías, imágenes, variantes, búsqueda, Zod.