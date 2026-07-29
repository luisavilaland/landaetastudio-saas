# Infraestructura E2E con Playwright

**Fecha:** 2026-07-29
**Estado:** Diseño aprobado pendiente de implementación

## Contexto

El proyecto tiene 379 tests unitarios/de integración (vitest) pero cero tests end-to-end. Flujos críticos como checkout, CRUD de productos, y aislamiento cross-tenant no tienen cobertura desde el navegador. Incidentes previos (TOCTOU en PUT `products/[id]`, RLS bypass) se detectaron tarde porque no había E2E.

## Decisiones arquitectónicas

| Decisión | Opción elegida | Alternativa descartada |
|---|---|---|
| Framework | Playwright | Cypress (más lento, menos integración TypeScript) |
| Auth | Híbrido: `auth.spec.ts` login real + `storageState` reutilizado (solo admin y superadmin) | Login en cada spec (más lento, duplica asserts) |
| Cliente storefront | Sin autenticación — carrito anónimo vía cookie, checkout sin cuenta | Login de cliente (no hay consumidor real, oculta flujo guest) |
| data-testid | Incremental por spec | Barrido global previo (nunca pasa) |
| CI | Fase 2 con fecha explícita | Sin CI (nunca se agrega) o CI inmediato (entrena a ignorar rojo) |
| Checkout MP | Hasta redirect a MP | Sin checkout (se posterga indefinidamente) |
| Hosts | Subdominios locales con lvh.me | localhost con rewrites (no refleja prod) |

## Estructura de directorios

```
e2e/
├── playwright.config.ts
├── global-setup.ts
├── fixtures/
│   └── index.ts              # Page objects compartidos
├── storefront/
│   ├── auth.spec.ts           # Login real (storageState)
│   ├── home.spec.ts           # Homepage visual + nav
│   ├── products.spec.ts       # Catálogo, búsqueda, detalle
│   ├── categories.spec.ts     # Navegación por categorías
│   ├── cart.spec.ts           # Carrito anónimo (cookie)
│   └── register.spec.ts       # Registro de cliente
├── checkout/
│   └── checkout.spec.ts       # Flujo completo hasta MP
├── admin/
│   ├── products-crud.spec.ts  # CRUD productos (storageState)
│   ├── categories.spec.ts     # CRUD categorías (storageState)
│   ├── orders.spec.ts         # Vista de órdenes (storageState)
│   └── settings.spec.ts       # Configuración tienda (storageState)
├── superadmin/
│   ├── tenants.spec.ts        # Listado/creación tenants (storageState)
│   └── login.spec.ts          # Login superadmin
└── security/
    └── cross-tenant.spec.ts   # GET/PUT/DELETE productos T2 desde T1
```

## playwright.config.ts

Tres projects con distintos `baseURL` para reflejar la arquitectura multi-tenant:

```ts
projects: [
  {
    name: "storefront",
    use: {
      baseURL: "http://tienda1.lvh.me:3000",
    },
    testMatch: "e2e/storefront/*.spec.ts",
    dependencies: ["setup"],
  },
  {
    name: "checkout",
    use: {
      baseURL: "http://tienda1.lvh.me:3000",
    },
    testMatch: "e2e/checkout/*.spec.ts",
    dependencies: ["setup"],
  },
  {
    name: "admin",
    use: {
      baseURL: "http://localhost:3001",
      storageState: "e2e/.auth/admin.json",
    },
    testMatch: "e2e/admin/*.spec.ts",
    dependencies: ["setup"],
  },
  {
    name: "superadmin",
    use: {
      baseURL: "http://localhost:3002",
      storageState: "e2e/.auth/superadmin.json",
    },
    testMatch: "e2e/superadmin/*.spec.ts",
    dependencies: ["setup"],
  },
  {
    name: "security",
    use: {
      baseURL: "http://localhost:3001",
      storageState: "e2e/.auth/admin.json",
    },
    testMatch: "e2e/security/*.spec.ts",
    dependencies: ["setup"],
  },
],
```

## Estrategia de autenticación

### Global setup (`global-setup.ts`)

- Se ejecuta una vez antes de la suite completa
- Crea 2 archivos `storageState`: `admin.json`, `superadmin.json`
- **No** hay login de cliente storefront — todos los specs de storefront/checkout corren sin autenticación (carrito anónimo, checkout sin cuenta)
- Cada uno navega al login correspondiente, completa credenciales, espera redirect exitoso, guarda cookies
- Almacenados en `e2e/.auth/` (gitignored)

### Specs

- **`auth.spec.ts`** (storefront): prueba el login real — form submit, validación de campos, error en credenciales inválidas, redirect exitoso. Corre sin storageState.
- **`register.spec.ts`** (storefront): prueba el registro como visitante. Corre sin storageState (igual que `auth.spec.ts`).
- **Resto de specs de storefront/checkout**: corren sin autenticación (sin storageState).
- **Admin/superadmin/security**: heredan `storageState` desde el proyecto correspondiente. No repiten login.

## data-testid

Se agregan solo cuando una spec los necesita. Sin refactor previo. Convención:

```html
<button data-testid="checkout-submit">Pagar</button>
```

Cada spec documenta en comentarios qué `data-testid` agrega.

## Especificación de los 14 specs

### Storefront (6)

#### `auth.spec.ts`
- Login con credenciales válidas → redirect a home
- Login con email inválido → mensaje de error
- Login con contraseña incorrecta → mensaje de error
- Acceso a `/perfil` sin auth → redirect a login

#### `home.spec.ts`
- Homepage carga sin errores
- Navegación a categorías desde navbar
- Navegación a carrito desde header

#### `products.spec.ts`
- Listado de productos se renderiza
- Búsqueda por texto encuentra producto
- Detalle de producto muestra nombre, precio, descripción
- Variante seleccionable cambia precio

#### `categories.spec.ts`
- Navegación por categoría desde home
- Filtro de productos por categoría

#### `cart.spec.ts`
- Agregar producto al carrito (anónimo, cookie)
- Ver carrito con ítem
- Actualizar cantidad
- Eliminar ítem
- Carrito vacío muestra mensaje

#### `register.spec.ts`
- Registro con datos válidos → redirect
- Registro con email existente → error 409
- Registro con datos inválidos → errores de validación

### Checkout (1)

#### `checkout.spec.ts`
- Agregar producto al carrito
- Navegar a checkout
- Completar formulario de envío
- Seleccionar método de envío
- Enviar orden
- Verificar redirect a MercadoPago (no completar pago)

### Admin (4)

#### `products-crud.spec.ts`
- Login admin (storageState)
- Listar productos
- Crear producto nuevo con imagen
- Editar producto existente
- Eliminar producto

#### `categories.spec.ts`
- Listar categorías
- Crear categoría
- Editar categoría
- Eliminar categoría

#### `orders.spec.ts`
- Listar órdenes
- Ver detalle de orden

#### `settings.spec.ts`
- Ver configuración de tienda
- Editar nombre de tienda
- Cambiar dominio

### Superadmin (2)

#### `tenants.spec.ts`
- Listar tenants
- Crear tenant nuevo
- Ver detalle de tenant
- Editar tenant

#### `login.spec.ts`
- Login superadmin
- Acceso a panel superadmin

### Seguridad (1)

#### `cross-tenant.spec.ts`
- Login como admin de T1
- Intentar GET `products/[id]` de T2 (producto seed de otro tenant) → esperar 404 o 403
- Intentar PUT `products/[id]` de T2 → esperar 404 o 403
- Intentar DELETE `products/[id]` de T2 → esperar 404 o 403
- Handler específico que se rompió dos veces en el proyecto

## Infraestructura

### playwright.config.ts config base

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false, // evitar colisión de storageState
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 1 worker por proyecto
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // ... 5 projects
  ],
});
```

### global-setup.ts

```ts
import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  // Login admin (T1)
  const adminBrowser = await chromium.launch();
  const adminPage = await adminBrowser.newPage();
  await adminPage.goto("http://localhost:3001/login");
  await adminPage.fill("[name=email]", process.env.E2E_ADMIN_EMAIL!);
  await adminPage.fill("[name=password]", process.env.E2E_ADMIN_PASSWORD!);
  await adminPage.click("button[type=submit]");
  await adminPage.waitForURL("http://localhost:3001/");
  await adminPage.context().storageState({ path: "e2e/.auth/admin.json" });
  await adminBrowser.close();

  // Login superadmin
  const saBrowser = await chromium.launch();
  const saPage = await saBrowser.newPage();
  await saPage.goto("http://localhost:3002/login");
  await saPage.fill("[name=email]", process.env.E2E_SUPERADMIN_EMAIL!);
  await saPage.fill("[name=password]", process.env.E2E_SUPERADMIN_PASSWORD!);
  await saPage.click("button[type=submit]");
  await saPage.waitForURL("http://localhost:3002/");
  await saPage.context().storageState({ path: "e2e/.auth/superadmin.json" });
  await saBrowser.close();

  // Sin login de cliente storefront — ningún spec lo necesita
  // (carrito anónimo vía cookie, checkout sin cuenta)
}
```

### Variables de entorno

```
E2E_ADMIN_EMAIL=admin@tienda1.com
E2E_ADMIN_PASSWORD=123456
E2E_SUPERADMIN_EMAIL=super@admin.com
E2E_SUPERADMIN_PASSWORD=123456
```

Storefront/checkout no necesitan variables — corren sin autenticación.

## CI (Fase 2, con fecha)

La suite no se agrega al CI hasta que esté estabilizada localmente. Fase 2 implica:

1. Docker services en CI: PostgreSQL, Redis (Upstash skip), MinIO
2. `pnpm build` de los 3 apps
3. `pnpm db:migrate && pnpm db:seed`
4. `npx playwright install --with-deps`
5. `pnpm exec playwright test`
6. Compromiso: implementar antes de próximo deploy a producción

## Scripts en root package.json

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

## Gitignore

```
e2e/.auth/
e2e/test-results/
e2e/playwright-report/
```

## data-testid a agregar

| Spec | data-testid |
|---|---|
| auth.spec.ts | `login-email`, `login-password`, `login-submit`, `login-error` |
| home.spec.ts | `nav-categories`, `nav-cart`, `hero-title` |
| products.spec.ts | `product-card`, `search-input`, `search-submit`, `product-name`, `product-price`, `variant-selector` |
| categories.spec.ts | `category-link`, `category-name` |
| cart.spec.ts | `add-to-cart`, `cart-count`, `cart-item`, `cart-quantity`, `cart-remove`, `cart-empty` |
| register.spec.ts | `register-name`, `register-email`, `register-password`, `register-submit`, `register-error` |
| checkout.spec.ts | `checkout-email`, `checkout-name`, `checkout-address`, `checkout-submit`, `shipping-method` |
| products-crud.spec.ts | `product-form-name`, `product-form-price`, `product-form-submit`, `delete-product` |
| admin-categories.spec.ts | `category-form-name`, `category-form-submit`, `delete-category` |
| settings.spec.ts | `store-name-input`, `store-name-submit`, `domain-input`, `domain-submit` |
| tenants.spec.ts | `tenant-form-name`, `tenant-form-submit`, `tenant-table` |
| superadmin-login.spec.ts | `superadmin-email`, `superadmin-password`, `superadmin-submit` |

## Plan de implementación

### Fase 1: Infraestructura
1. `pnpm add -D @playwright/test`
2. Crear `e2e/playwright.config.ts`
3. Crear `e2e/global-setup.ts`
4. Agregar scripts a root package.json
5. Agregar `e2e/.auth/` a `.gitignore`
6. Agregar variables E2E a `.env.local`

### Fase 2: Storefront (6 specs) + Checkout (1)
1. `auth.spec.ts` — login real + storageState
2. `home.spec.ts`
3. `products.spec.ts`
4. `categories.spec.ts`
5. `cart.spec.ts`
6. `register.spec.ts`
7. `checkout.spec.ts`

### Fase 3: Admin (4 specs)
1. `products-crud.spec.ts`
2. `categories.spec.ts`
3. `orders.spec.ts`
4. `settings.spec.ts`

### Fase 4: Superadmin (2) + Seguridad (1)
1. `tenants.spec.ts`
2. `login.spec.ts`
3. `cross-tenant.spec.ts`

### Fase 5: CI
1. Docker services en workflow
2. Playwright install + run
3. Compromiso con fecha

## Verificación

- `pnpm test:e2e` — todos los specs pasan localmente
- `pnpm build` — sin errores (ignoreBuildErrors=false)
- `pnpm test` — 379 tests unitarios siguen pasando
