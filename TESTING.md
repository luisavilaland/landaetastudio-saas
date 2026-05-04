# Testing Checklist – saas-ecommerce

Este archivo contiene el checklist de pruebas para verificar el funcionamiento de todas las fases implementadas.

---

## Pruebas Manuales – 30 de abril de 2026

### Setup Previo

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Docker servicios corriendo (PostgreSQL, Redis, MinIO) | ✅ |
| 2 | Migraciones aplicadas (`pnpm db:migrate`) | ✅ |
| 3 | Seed ejecutado (`pnpm db:seed`) | ✅ |
| 4 | Apps en desarrollo (`pnpm dev`) sin errores | ✅ |

---

### Superadmin – Autenticación

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Login con super@admin.com / 123456 | ✅ |
| 2 | Redirección a /tenants tras login | ✅ |
| 3 | Protección de rutas sin sesión | ✅ |
| 4 | Logout funcional | ✅ |

### Superadmin – CRUD Tenants

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Listado de tenants | ✅ |
| 2 | Crear tenant nuevo | ✅ |
| 3 | Editar tenant existente | ✅ |
| 4 | Eliminar tenant | ✅ |
| 5 | Validación de slug duplicado | ✅ |
| 6 | Asignar customDomain | ✅ |
| 7 | Limpiar customDomain (vacío → null) | ✅ |
| 8 | GET /api/tenants/[id] incluye customDomain | ✅ |
| 9 | Validación customDomain duplicado al crear | ✅ |

### Superadmin – API Domain-Check

| # | Prueba | Estado |
|---|--------|--------|
| 1 | GET /api/domain-check?domain=disponible.com → available: true | ✅ |
| 2 | GET /api/domain-check?domain=usado.com → available: false | ✅ |
| 3 | Sin parámetro domain → 400 | ✅ |

### Superadmin – General

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Ruta /plans accesible | ✅ |

---

### Admin – Autenticación

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Login con admin@tienda1.com / 123456 | ✅ |
| 2 | Redirección a /dashboard | ✅ |
| 3 | Protección de rutas sin sesión | ✅ |
| 4 | Logout funcional | ✅ |
| 5 | Login redirige si ya hay sesión | ✅ |

### Admin – Dashboard

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Tarjetas de métricas (ventas, órdenes, stock) | ✅ |
| 2 | Tabla de últimas órdenes | ✅ |
| 3 | Lista de productos con stock bajo | ✅ |
| 4 | Enlace a editar producto desde stock bajo | ✅ |

### Admin – Categorías

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Listado de categorías | ✅ |
| 2 | Crear categoría nueva | ✅ |
| 3 | Editar categoría (slug se regenera) | ✅ |
| 4 | Eliminar categoría | ✅ |
| 5 | Slug duplicado retorna 409 | ✅ |
| 6 | Slug reflejado en tabla sin recargar | ✅ |

### Admin – Productos

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Listado de productos | ✅ |
| 2 | Stock visible con badges | ✅ |
| 3 | Edición rápida de stock inline (solo lectura, muestra la suma de variantes) | ✅ |
| 4 | Editar producto (nombre, descripción, precio) | ✅ |
| 5 | Eliminar imagen individual | ✅ |
| 6 | Crear producto (bug: slug primera letra) | ✅ |
| 7 | Subir imagen en creación | ✅ |
| 8 | Crear producto con variantes | ✅ |
| 9 | Editar producto | ✅ |
| 10 | Editar imagen | ✅ |
| 11 | Eliminar imagen individual | ✅ |
| 12 | SKU se regenera al actualizar slug | ✅ |
| 13 | Importar productos por CSV (probado con archivo válido y archivo con errores) | ✅ |

### Admin – Variantes

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Agregar variante al editar producto | ✅ |
| 2 | Editar variante existente | ✅ |
| 3 | Eliminar variante | ✅ |

### Admin – Órdenes

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Listado de órdenes | ✅ |
| 2 | Detalle de orden | ✅ |
| 3 | Cambio de estado | ✅ |
| 4 | Filtro por estado | ✅ |

### Admin – Métodos de Envío

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Listado de métodos | ✅ |
| 2 | Editar método | ✅ |
| 3 | Desactivar método | ✅ |
| 4 | Eliminar método | ✅ |
| 5 | Crear nuevo método | ✅ |

### Admin – Configuración Visual

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Carga del formulario /store/settings | ✅ |
| 2 | Guardar configuración (200 OK) | ✅ |
| 3 | Colores aplicados en storefront | ✅ |

### Admin – Dominio Personalizado

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Carga de /store/domain | ✅ |
| 2 | Guardar dominio válido | ✅ |
| 3 | Validación de formato inválido (http://) | ✅ |
| 4 | Verificar disponibilidad | ✅ |

### Admin – Seguridad de Subdominios

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Acceder a `tienda1.lvh.me:3001/login` → 403 | ✅ |
| 2 | Acceder a `localhost:3001/login` → carga normal | ✅ |
| 3 | Acceder a `tienda1.lvh.me:3002/login` → 403 | ✅ |
| 4 | Acceder a `localhost:3002/login` → carga normal | ✅ |

---

### Storefront – Proxy y Resolución

| # | Prueba | Estado |
|---|--------|--------|
| 1 | tienda1.lvh.me:3000 resuelve tenant | ✅ |
| 2 | customDomain resuelve al tenant correcto | ✅ |
| 3 | Dominio inexistente → 404 | ✅ |

### Storefront – Página de Inicio

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Catálogo de productos visible | ✅ |
| 2 | Logo en navbar | ✅ |
| 3 | Menú de categorías en navbar | ✅ |

### Storefront – Catálogo y Búsqueda

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Búsqueda por nombre de producto | ✅ |
| 2 | Filtro por categoría | ✅ |
| 3 | Resultados sin coincidencias | ✅ |
| 4 | Badge "Agotado" en sin stock | ✅ |

### Storefront – Página de Producto

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Nombre y descripción del producto | ✅ |
| 2 | Galería de imágenes | ✅ |
| 3 | Selector de variantes | ✅ |
| 4 | Precio y stock según variante | ✅ |
| 5 | Breadcrumbs | ✅ |

### Storefront – Carrito

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Agregar producto al carrito | ✅ |
| 2 | Cambiar cantidad | ✅ |
| 3 | Eliminar ítem individual | ✅ |
| 4 | Vaciar carrito | ✅ |
| 5 | Persistencia (7 días TTL) | ✅ |
| 6 | Carrito anónimo (sin login) | ✅ |
| 7 | Variante seleccionada visible | ✅ |
| 8 | Precio correcto según variante | ✅ |

### Storefront – Checkout

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Selector de método de envío | ✅ |
| 2 | Cálculo de envío gratis | ✅ |
| 3 | Desglose subtotal + envío + total | ✅ |
| 4 | Crear orden (POST /api/checkout) | ✅ |
| 5 | Redirección a MercadoPago | ✅ |
| 6 | Validación campos vacíos | ✅ |
| 7 | Formulario muestra campos completos | ✅ |
| 8 | Seleccionar envío express actualiza resumen | ✅ |
| 9 | Carrito > $2000 → envío gratis | ✅ |
| 10 | Botón pagar incluye total con envío | ✅ |

### Storefront – Perfil

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Nombre de la tienda | ✅ |
| 2 | Logo del tenant | ✅ |
| 3 | Descripción de la tienda | ✅ |
| 4 | Email de contacto (mailto:) | ✅ |
| 5 | Teléfono | ✅ |
| 6 | Link Instagram | ✅ |
| 7 | Link Facebook | ✅ |
| 8 | Categorías como links | ✅ |
| 9 | Sin categorías → sección oculta | ✅ |
| 10 | <title> con nombre de tienda | ✅ |
| 11 | Meta description | ✅ |
| 12 | JSON-LD Store schema | ✅ |
| 13 | Página carga sin login (pública) | ✅ |

### Storefront – Autenticación Cliente

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Registro de cliente | ✅ |
| 2 | Login de cliente | ✅ |
| 3 | Logout redirige a storefront | ✅ |
| 4 | /login y /register con sesión activa | ✅ |

---

### Seguridad – Aislamiento de Tenants

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Admin solo ve datos de su tenant | ✅ |
| 2 | Storefront resuelve solo su tenant | ✅ |
| 3 | Superadmin ve todos los tenants | ✅ |

### Seguridad – Headers Proxy

| # | Prueba | Estado |
|---|--------|--------|
| 1 | x-tenant-id presente en headers | ✅ |
| 2 | x-tenant-slug presente en headers | ✅ |

---

### Pago con MercadoPago

| # | Prueba | Estado |
|---|--------|--------|
| 1 | Flujo E2E completo (sandbox) | 🔄 Pendiente – cuenta de prueba no disponible |
| 2 | Webhook de pago aprobado | 🔄 Pendiente |
| 3 | Webhook de pago rechazado | 🔄 Pendiente |
| 4 | Email de confirmación de orden | 🔄 Pendiente |

---

### Tests Automáticos

```bash
pnpm test
```

| Métrica | Valor |
|---------|-------|
| **Total** | 225 tests |
| **Pasando** | 225 ✅ |
| **Fallas** | 0 ✅ |
| **Archivos** | 25 |

> Los 25 tests de shipping usan patrón de "lógica pura" para evitar incompatibilidad con next-auth@5.0.0-beta.31. Los tests de categorías también fueron reescritos con este patrón.

---

## Resumen de Resultados

| Área | Total | ✅ | ⚠️ | ❌ |
|------|-------|----|-----|-----|
| Setup | 4 | 4 | 0 | 0 |
| Superadmin | 17 | 17 | 0 | 0 |
| Admin | 51 | 48 | 0 | 0 |
| Storefront | 50 | 50 | 0 | 0 |
| Seguridad | 5 | 5 | 0 | 0 |
| **Total** | **127** | **124** | **0** | **0** |

---
## Notas

- Última actualización: 30 de abril de 2026 — Pruebas manuales completadas.
- Fase 4 completada: Dominio personalizado + Perfil de tienda + Shipping + Checkout.
- 225 tests automatizados pasando (0 fallos). Build limpio en las 3 apps.
- Flujo E2E de MercadoPago pendiente (bloqueado por cuenta de prueba).
- Ver AGENTS.md para detalles de bugs funcionales y mejoras de UX pendientes.
- Próximo paso antes de Fase 5: corregir el ítem marcado como ❌ (Importar productos por CSV).

### Fase 5 - Tareas de Seguridad Completadas ?
- **Row Level Security (RLS)**: Implementado en todas las tablas de negocio con pol�ticas 	enant_isolation. Funci�n set_tenant_id y helper withTenantContext en @repo/db.
- **AUTH_SECRET obligatorio**: Eliminado fallback hardcoded. Validaci�n al arrancar en @repo/auth lanza error si falta la variable.
- **CSRF protection**: Manejado autom�ticamente por NextAuth v5 en producci�n (NODE_ENV=production). Documentado en 
ext.config.ts de las 3 apps.

