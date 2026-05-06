# SaaS eCommerce MVP

Monorepo del proyecto de SaaS de eCommerce headless, multi-tenant, orientado al Cono Sur.

# Roadmap

## Fase 1 – Autenticación y Órdenes ✅ (Completada)

- Auth de admins separada
- Registro y login de clientes en storefront
- Panel de órdenes en admin (lista, detalle, cambio de estado)

## Fase 2 – Dashboard y Stock ✅ (Completada)

- Dashboard con métricas reales (ventas del mes, órdenes pendientes, stock bajo/agotado)
- Gestión de stock con alertas visuales
- Edición rápida de stock en tabla de admin
- Badge "Agotado" en storefront y product-card
- Lista de productos con stock bajo en dashboard (enlace a editar)

## Fase 3 – Experiencia de Tienda Completa ✅ (Completada)

- Categorías de productos
- Búsqueda en catálogo
- Múltiples imágenes por producto
- Múltiples variantes reales (talle, color)
- Validación Zod en endpoints

## Fase 4 – Autoservicio del Tenant ✅ (Completada)

- ✅ Configuración visual del tenant (logo, colores)
- ✅ Dominio personalizado con verificación
- ✅ Métodos de envío configurables por tenant
- ✅ Página de perfil de tienda pública con SEO
- ✅ Checkout con selector visual de envío y cálculo dinámico
- ✅ Refactor de API: `NextResponse` unificado en todas las rutas
- ✅ 225 tests (100% passing), build limpio en 3 apps

## Fase 5 – Producción 🔄 (En progreso)

- ✅ **RLS policies (Row Level Security)** - Implementado en tablas de negocio
- ✅ **AUTH_SECRET obligatorio** - Sin fallback hardcoded, validación al arrancar
- ✅ **CSRF protection** - Manejado automáticamente por NextAuth v5 en producción
- ✅ **Validación de variables de entorno en producción** - Zod valida al arrancar
- ✅ **Logs estructurados** - Pino en @repo/logger, desarrollo con pino-pretty, producción JSON
- ✅ **Sentry para errores en producción** - Integrado en las tres apps con DSN opcional
- ✅ **NEXTAUTH_URL dinámica** - Opcional; NextAuth v5 la infiere del Host header
- Resolver conflicto drizzle en @repo/auth
- Normalizar slug on create/edit
- Authentication hardening

---

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
- Tipos TypeScript para NextAuth (tenantId, role).
- Logout functionality.
- Validación backend con Zod: price > 0, stock >= 0, SKU regeneration on slug update.
- Índices de base de datos: unique (tenantId, slug) para products, (tenantId, email) para customers, (tenantId, sku) para variants.
- Índices en tenantId en todas las tablas de negocio.
- Subida de imágenes a MinIO con FormData (@repo/storage).
- Múltiples imágenes por producto (tabla product_images, ordenamiento por position).
- Categorías de productos con CRUD completo.
- Variantes reales con JSONB (talle, color, SKU, stock independiente).
- Búsqueda server-side con ILIKE en storefront.
- Storefront: catálogo, página de detalle, navbar con categorías, búsqueda.
- **Carrito funcional:** Redis + cookie session, 7-day TTL, usuarios anónimos, variantes en carrito.
- **Checkout:** Flujo completo con MercadoPago (binary_mode).
- **Webhook:** Actualiza orden según notificación (con prevención de duplicados, modo simulación).
- **Email:** Confirmación de orden con nodemailer.
- **Customer auth:** Registro y login de clientes en storefront.
- **Admin orders:** Panel de gestión de órdenes con cambio de status.
- **Admin dashboard:** Métricas (ventas, órdenes, stock), tabla de productos con stock bajo.
- **Stock management:** Edición rápida de stock en tabla, badge "Agotado", alertas en dashboard.
- **Métodos de envío:** API `GET /api/shipping` en storefront que lee `x-tenant-id` del proxy. Checkout con selector visual, cálculo dinámico de envío gratis, desglose subtotal + envío + total.
- **Seed:** 2 métodos para tienda1 (estándar $150, express $350) + 25 tests de lógica pura.
- **Fixes:** Bugs carrito, variantes, imágenes, validación tenant, queries N+1, logout redirects. Refactor completo de `new Response()` → `NextResponse` en 5 rutas. Tests de categorías reescritos con patrón de lógica pura.

### Fase 5 - Tareas de Seguridad Completadas ✅
- **Row Level Security (RLS)**: Implementado en todas las tablas de negocio con políticas `tenant_isolation`. Función `set_tenant_id` y helper `withTenantContext` en `@repo/db`.
- **AUTH_SECRET obligatorio**: Eliminado fallback hardcoded. Validación al arrancar en `@repo/auth` lanza error si falta la variable.
- **CSRF protection**: Manejado automáticamente por NextAuth v5 en producción (NODE_ENV=production). Documentado en `next.config.ts`.

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
- **Validación:** Zod (endpoints API)

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

## Usuarios de prueba

### Admin

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Tenant:** tienda1

### Superadmin

- **Email:** super@admin.com
- **Password:** 123456
- **Rol:** superadmin (sin tenant)

### Cliente

- **Email:** cliente@ejemplo.com
- **Password:** 123456

## Estructura del proyecto

```
saas-ecommerce/
├── apps/
│   ├── storefront/     # Tienda pública (Next.js)
│   ├── admin/          # Panel del comercio (Next.js)
│   └── superadmin/     # Panel SaaS interno (Next.js)
├── packages/
│   ├── auth/           # NextAuth v5 para admin y superadmin
│   ├── db/             # Schema Drizzle, migrations, client
│   ├── commerce/       # Lógica de negocio (carrito, productos, emails, tenant, Redis)
│   ├── storage/        # MinIO client for image upload
│   └── validation/    # Schemas Zod compartidos
├── docker-compose.yml
├── .env.local
├── pnpm-workspace.yaml
└── turbo.json
```

## Scripts

| Script | Descripción |
| :--- | :--- |
| `pnpm dev` | Levanta todas las apps en modo desarrollo |
| `pnpm db:generate` | Genera migraciones desde el schema |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:seed` | Limpia la BD y crea datos de prueba |
| `pnpm test` | Ejecuta todos los tests (vitest) |
| `pnpm lint` | Linting + formatting |
| `pnpm typecheck` | Verificación de tipos TypeScript |
| `pnpm build` | Build de producción de todas las apps |

## API Endpoints

### Admin Products

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/products | Listar productos |
| POST | /api/products | Crear producto |
| GET | /api/products/[id] | Obtener producto |
| PUT | /api/products/[id] | Actualizar producto |
| DELETE | /api/products/[id] | Eliminar producto |
| POST | /api/products/[id]/images | Subir imágenes |
| DELETE | /api/products/[id]/images/[imageId] | Eliminar imagen |
| GET/PUT | /api/products/[id]/variants | Gestionar variantes |

### Categories

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/categories | Listar categorías |
| POST | /api/categories | Crear categoría |
| GET | /api/categories/[id] | Obtener categoría |
| PUT | /api/categories/[id] | Actualizar categoría |
| DELETE | /api/categories/[id] | Eliminar categoría |

### Storefront Cart

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/cart | Obtener carrito |
| POST | /api/cart | Agregar item |
| PUT | /api/cart | Actualizar cantidad |
| DELETE | /api/cart | Eliminar item o vaciar |

### Storefront Checkout

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/checkout | Crear orden desde carrito |
| POST | /api/checkout/preference | Crear preferencia de pago MP |
| POST | /api/webhooks/mercadopago | Notificación de pago |
| GET | /checkout/success | Página de éxito |
| GET | /checkout/failure | Página de fallo |
| GET | /checkout/pending | Página de pendiente |

### Admin Shipping

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/shipping | Listar métodos de envío del tenant |
| POST | /api/shipping | Crear método de envío |
| PUT | /api/shipping/[id] | Actualizar método de envío |
| DELETE | /api/shipping/[id] | Eliminar método de envío |

### Storefront Shipping

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/shipping | Métodos activos del tenant (lee `x-tenant-id` del proxy) |

### Admin Dashboard

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/dashboard | Métricas (ventas, órdenes, stock bajo) |

### Admin Orders

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/orders | Listar órdenes |
| GET | /api/orders/[id] | Obtener orden |
| PUT | /api/orders/[id] | Cambiar status |

### Superadmin Tenants

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| GET | /api/tenants | Listar tenants |
| POST | /api/tenants | Crear tenant |
| GET | /api/tenants/[id] | Obtener tenant |
| PUT | /api/tenants/[id] | Actualizar tenant |
| DELETE | /api/tenants/[id] | Eliminar tenant |
| GET | /plans | Página de gestión de planes |

### Storefront Auth

| Method | Endpoint | Descripción |
| :--- | :--- | :--- |
| POST | /api/register | Registrar nuevo cliente |
| POST | /api/auth/[...nextauth] | Login de cliente |

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
| `processing` | Pago confirmado, preparando envío |
| `shipped` | Enviado al cliente |
| `delivered` | Entregado al cliente |
| `cancelled` | Cancelada (antes de envío) |
| `refunded` | Devuelta/reembolsada |

## Prioridades para Producción

### 🔴 Alta prioridad (crítico antes de producción)

| # | Tarea |
| ---|-------|
| 1 | ✅ **RLS** - Habilitar políticas de fila por tenant |
| 2 | ✅ **AUTH_SECRET** - Validar que exista en prod, eliminar fallback |
| 3 | ✅ **CSRF** - Habilitar en producción |
| 4 | ✅ **NEXTAUTH_URL dinámica** - Opcional; NextAuth v5 la infiere del Host header |

### 🟡 Media prioridad

| # | Tarea |
| ---|-------|
| 1 | ~~Normalizar slug en create/edit (acentos y mayúsculas)~~ ✅ Completada |
| 2 | ~~Consolidar auth duplicada en `@repo/auth`~~ ✅ Completada |
| 3 | ~~Refactorizar lógica de negocio duplicada a `@repo/commerce`~~ ✅ Completada |

### 🟢 Baja prioridad

| # | Tarea |
| ---|-------|
| 1 | Eliminar dotenv duplicado en `next.config.ts` |
| 2 | Mejorar UI de errores 409 |

## Notas importantes

- NO hacer deploy a cloud hasta que el MVP funcione 100% local.
- Usar `lvh.me` para testing de subdominios.
- Las migraciones son inmutables – generar nuevas para cambios.
- Prices siempre en centavos (integer), nunca floats.
- Cart funciona sin autenticación (usuarios anónimos).
- Checkout requiere email para enviar confirmación.

## Documentación adicional

- [Decisiones de arquitectura](./docs/arquitectura.md) – Por qué elegimos cada tecnología.
- [Guía de setup](./SETUP.md) – Configuración del proyecto y solución de problemas.
- [Guía para agentes de IA](./AGENTS.md) – Políticas y comandos para asistentes de código.
- [Prompts reutilizables](./PROMPTS.md) – Plantillas de prompts para agentes de IA.
- [Brief técnico Fase 5](./docs/brief%20tecnico%20fase%205.md) – Plan de producción.
- [Checklist de pruebas manuales](./TESTING-MANUAL.md) – 92 ítems de verificación manual.

## Tests

```bash
pnpm test    # Ejecuta todos los tests (vitest)
```

- **Total:** 225 tests (225 pasando, 0 fallos)
- Tests de shipping (25) escritos en patrón de lógica pura para compatibilidad con vitest.
- Tests de categorías reescritos con patrón de lógica pura — ya no importan el route directamente.

---

**Última actualización:** 5 de mayo de 2026 – Fase 5 en progreso: RLS, AUTH_SECRET, CSRF, validación de variables de entorno, logs estructurados con Pino, Sentry integrado, NEXTAUTH_URL dinámica. 225/225 tests. Build limpio.
