# Checklist de Pruebas Manuales — SaaS eCommerce

**Fecha:** Agosto 2026 | **Versión:** 3.0 | **Estado:** Fase 6 en curso (RLS real + E2E) ✅

> Ejecutar en orden. Marcar cada ítem con ✅ al verificar o ❌ si falla.
> Credenciales: admin@tienda1.com / 123456 | super@admin.com / 123456 | cliente@ejemplo.com / 123456

---

## 0. Setup previo

- [x] Servicios cloud accesibles — Neon (PostgreSQL), Upstash (Redis `REDIS_URL`), R2 (imágenes), Resend (emails)
- [x] `pnpm dev` corriendo (storefront :3000, admin :3001, superadmin :3002)
- [x] `pnpm db:seed` ejecutado (datos frescos — 2 tenants: tienda1, tienda2)
- [x] Para webhooks en dev: `npx dotunnel` y `STOREFRONT_URL` apuntando al túnel

---

## 1. Superadmin (localhost:3002)

### Autenticación

- [x] Login con super@admin.com / 123456 → redirige a /tenants
- [x] Login con credenciales incorrectas → mensaje de error
- [x] Acceder a /tenants sin sesión → redirige a /login
- [x] Logout → redirige a /login del superadmin (no al admin)

### CRUD de Tenants

- [x] Listado de tenants muestra tienda1
- [x] Crear tenant nuevo con slug único → aparece en listado
- [x] Editar tenant → cambios reflejados sin recargar
- [x] Asignar customDomain válido → se guarda correctamente
- [x] Asignar customDomain con formato inválido (con http://) → error 400
- [x] Asignar customDomain ya usado por otro tenant → error 409
- [x] Dejar customDomain vacío → se setea a null en BD
- [x] Eliminar tenant → desaparece del listado

### API domain-check
- [x] `curl "localhost:3002/api/domain-check?domain=disponible123.com"` → `{"available":true}`
- [x] `curl "localhost:3002/api/domain-check?domain=tienda1.com"` (si existe) → `{"available":false}`
- [x] `curl "localhost:3002/api/domain-check"` (sin parámetro) → 400

### General
- [x] Ruta /plans accesible

---

## 2. Admin (localhost:3001)

### Autenticación

- [x] Login con admin@tienda1.com / 123456 → redirige a /dashboard
- [x] Login con credenciales incorrectas → mensaje de error
- [x] Acceder a /dashboard sin sesión → redirige a /login
- [x] Logout → redirige a /login del admin (no al storefront)
- [x] Login redirige al dashboard si ya hay sesión activa

### Dashboard

- [x] 4 tarjetas de métricas visibles (ventas, órdenes, productos, stock bajo)
- [x] Tabla de últimas órdenes con datos reales del seed
- [x] Lista de productos con stock bajo con enlace a editar
- [x] Métricas muestran valores correctos (no todos en cero)

### Categorías (/categorias)

- [x] Listado de categorías: Remeras, Pantalones, Accesorios
- [x] Crear categoría nueva → aparece en listado
- [x] Editar nombre → slug se regenera automáticamente
- [x] Slug actualizado reflejado sin recargar página
- [x] Eliminar categoría → desaparece del listado
- [x] Crear categoría con slug duplicado → error 409

### Productos (/products)

- [x] Listado de 3 productos del seed con imagen, precio y stock
- [x] Badge amarillo para stock ≤ 5, rojo para stock = 0
- [x] Columna de stock de solo lectura (muestra la suma de variantes)
- [x] Crear producto nuevo con variantes → aparece en listado
- [x] Editar producto → cambios reflejados
- [x] Subir imagen → imagen visible en formulario y storefront
- [x] Eliminar imagen individual → desaparece del formulario
- [ ] Importar productos por CSV (si está implementado)
- [x] SKU se regenera al actualizar slug del producto

### Variantes

- [x] Agregar múltiples variantes con diferentes atributos (color, talle)
- [x] Cada variante tiene precio y stock independiente
- [x] Variante sin stock muestra badge "Agotado"

### Órdenes (/orders)

- [x] Listado de 2 órdenes del seed (1 confirmada, 1 pendiente)
- [x] Ver detalle de orden → muestra productos, cliente, dirección, total
- [x] Cambiar estado de orden desde el panel → se actualiza
- [x] Filtrar órdenes por estado

### Métodos de Envío (/shipping)

- [x] Listado muestra "Envío estándar" y "Envío express"
- [x] Crear nuevo método con precio y días de entrega → aparece en listado
- [x] Editar método → cambios reflejados
- [x] Desactivar método (isActive = false) → no aparece en checkout del storefront
- [x] Eliminar método → desaparece del listado

### Configuración Visual (/store/settings)

- [x] Página carga sin error JSON
- [x] Formulario muestra campos: logo, colores, descripción, contacto, redes sociales
- [x] Guardar configuración → respuesta 200 y mensaje de éxito
- [x] Cambios de color se reflejan en el storefront

### Dominio Personalizado (/store/domain)

- [x] Página carga correctamente
- [x] Ingresar dominio válido y guardar → muestra confirmación
- [x] Ingresar dominio inválido (con http://) → error de validación
- [x] Instrucciones DNS visibles en la página

---

## 3. Storefront (localhost:3000)

### Proxy y resolución de tenant

- [x] Logs `[Proxy] Tenant Slug: default` visibles en terminal al acceder a localhost:3000
- [x] Acceder a tienda1.lvh.me:3000 → logs muestran `[Proxy] Tenant Slug: tienda1`
- [x] Rutas estáticas (/\_next/static) NO aparecen en logs del proxy

### Página de inicio

- [x] Carga con productos activos de tienda1
- [x] Navbar con logo, categorías y carrito
- [x] Menú desplegable de categorías funciona

### Catálogo y búsqueda

- [x] Listado de productos con imagen, nombre y precio
- [x] Filtro por categoría (?category=remeras) muestra solo esa categoría
- [x] Barra de búsqueda → resultados con productos coincidentes
- [x] Producto sin stock muestra badge "Agotado" y botón deshabilitado

### Página de producto

- [x] Imagen principal y galería de imágenes funcionan
- [x] Selector de variantes (talle, color) cambia precio y stock dinámicamente
- [x] Botón "Agregar al carrito" habilitado solo con stock disponible
- [x] Breadcrumbs visibles y navegables

### Carrito (/cart)

- [x] Agregar producto → aparece en carrito con imagen, nombre y precio
- [x] Cambiar cantidad → total se actualiza sin recargar página
- [x] Eliminar ítem individual → resto del carrito persiste
- [x] Vaciar carrito → carrito vacío
- [x] Variante seleccionada visible en el carrito
- [x] Precio correcto según variante seleccionada

### Checkout (/checkout)

- [x] Formulario muestra campos: nombre, email, teléfono, dirección
- [x] Selector de métodos de envío muestra "Envío estándar" y "Envío express"
- [x] Seleccionar "Envío express" → precio del envío se actualiza en resumen
- [x] Carrito superior a $2000 → "Envío estándar" aparece como "Gratis"
- [x] Resumen muestra subtotal + envío + total correctamente
- [x] Botón "Pagar" incluye el total con envío
- [x] Submit sin completar campos → validación en frontend

### Pago con MercadoPago (sandbox)

- [ ] Completar checkout → redirige a MercadoPago
- [ ] Pagar con tarjeta de prueba → redirige a /checkout/success
- [ ] Página /checkout/success muestra confirmación
- [ ] Orden creada en panel admin con estado "confirmed"
- [ ] Stock descontado correctamente tras la compra
- [ ] Pago fallido → redirige a /checkout/failure
- [ ] Pago pendiente → redirige a /checkout/pending
- [ ] Email de confirmación de orden recibido en Resend (bandeja de pruebas)

### Perfil de tienda (/perfil)

- [x] Página carga sin login (pública)
- [x] Muestra nombre de la tienda
- [x] Logo visible si está configurado
- [x] Descripción visible si está configurada
- [x] Links de Instagram/Facebook si están configurados
- [x] Categorías listadas como links clickeables
- [x] `<title>` en el `<head>` es el nombre de la tienda
- [x] JSON-LD con schema de tienda en el HTML

### Autenticación de cliente

- [x] Registro con email nuevo → 201
- [x] Registro con email duplicado → 409
- [x] Login de cliente → sesión activa
- [x] Logout → redirige al storefront (no al admin)

---

## 4. Pruebas de seguridad básicas

### Aislamiento de tenants

- [x] Login en admin de tienda1 → NO puede ver productos de otro tenant
- [x] Llamar `/api/products` sin sesión → 401
- [x] Llamar `/api/orders` con tenantId de otro tenant en headers → sin datos ajenos

### Headers del proxy

- [x] `x-tenant-slug` presente en cada request al storefront
- [x] `x-cart-session-id` presente en cada request (cookie persistente)

---

## 5. Pruebas de integración automáticas

```bash
pnpm test
```

- [x] 388 tests pasando (51 archivos)
- [x] 0 tests fallando

```bash
pnpm build
```

- [x] 3 builds exitosos (storefront, admin, superadmin)
- [x] 0 errores de TypeScript

```bash
pnpm test:e2e
```

- [x] 14 specs E2E pasando (Playwright, CI self-hosted)

---

## Resumen de resultados

| Área              | Total ítems | ✅ OK | ❌ Falla |
| ----------------- | ----------- | ----- | -------- |
| Superadmin        | 19          | 19    | 0        |
| Admin             | 36          | 36    | 0        |
| Admin (CSV)        | 10          | 10    | 0        |
| Admin (Seguridad)  | 4           | 4     | 0        |
| Storefront        | 36          | 32    | 4        |
| Seguridad         | 5           | 5     | 0        |
| Tests automáticos | 3           | 3     | 0        |
| **Total**         | **113**     | **109**| **4**    |

> Los 4 ❌ de Storefront son el flujo de pago manual en sandbox (requiere cuenta de prueba de MP). El webhook automatizado está cubierto por 11 tests de integración.

---
_Archivo actualizado en Agosto 2026 — concordante con TESTING.md_
_Checklist generado en Abril 2026 — Pre Fase 5; migrado a servicios cloud en Julio 2026_

---

## 8. Verificación de la Fase 5 (Seguridad y Rendimiento)

### Seguridad (RLS, Auth y CSRF)

> ⚠️ **Actualizado 08-08:** los `proxy.ts` de admin y superadmin fueron **eliminados** (10-07, eran no-ops). Ya no existe rechazo de subdominios a nivel de middleware en esas apps. El aislamiento de tenant se garantiza por datos (RLS + `withTenantContext`), no por host. Las pruebas de 403 por subdominio quedan obsoletas.

- [x] Login de admin en `admin.landaetastudio.com` (o localhost:3001) → panel de administración normal.
- [x] Login de superadmin en `superadmin.landaetastudio.com` (o localhost:3002) → panel del superadministrador normal.
- [x] Registro de cliente con email nuevo → 201. Email de confirmación enviado vía Resend.
- [x] Intentar crear un producto en el admin de tienda1. El producto solo debe ser visible en la tienda1 y no en otras.

### Validación de Errores 409 (Conflict)
- [x] En el panel de administración, intentar crear un producto con un slug que ya exista. Verificar que aparece un mensaje de error junto al campo slug, no solo un mensaje genérico.
- [x] En el panel de superadmin, intentar crear un tenant con un slug que ya exista. Verificar el mensaje de error en el campo slug.
- [x] Repetir la prueba para categorías con slug duplicado.

### Logs Estructurados (Pino)
- [x] Iniciar la aplicación en modo desarrollo (`pnpm dev`). Navegar por el storefront y el admin.
- [x] Verificar que en la terminal los logs aparecen con el nuevo formato (colores, timestamp legible) y no como `console.log` planos.
- [x] Buscar en los logs la presencia de la palabra "Proxy" para confirmar que los logs del middleware están usando el nuevo sistema.

### Integración de Sentry
- [x] Iniciar la aplicación en modo desarrollo sin configurar `SENTRY_DSN`.
- [x] Verificar que la aplicación compila y arranca sin errores relacionados con Sentry.
- [x] En la terminal, buscar un mensaje de información que indique que Sentry no está configurado (o simplemente que no hay errores de compilación).

---

## Pendientes documentados

### Importación de productos por CSV
- **Estado:** ✅ Implementado (ver sección 6 abajo)
- **Endpoints:** `POST /api/products/import` en admin
- **Detalle:** transacción POR FILA (éxito parcial), validación por fila con resumen (creados, omitidos, errores), template descargable

### Seguridad de subdominios en admin y superadmin
- **Estado:** ⚠️ **Obsoleto — proxies eliminados**
- **Descripción:** los `proxy.ts` de admin y superadmin (que rechazaban subdominios de tenant) fueron eliminados el 10-07 como no-ops. El aislamiento de tenant se garantiza por datos (RLS + `withTenantContext`), **no** por filtrado de host. `ADMIN_HOST` y `SUPERADMIN_HOST` quedan como documentación de entornos, sin enforce en runtime.

---

## 6. Importación de productos por CSV

### UI Admin (/products)
- [x] Botón "Importar CSV" visible junto a "Nuevo Producto"
- [x] Click en "Importar CSV" → abre modal
- [x] Botón "Descargar template de ejemplo" → descarga CSV con columnas correctas
- [x] Subir CSV válido → muestra resumen (creados, omitidos, errores)
- [x] Subir CSV con productos duplicados → muestra fila omitida con razón
- [x] Subir CSV con precio negativo → muestra error en esa fila
- [x] Subir CSV con categoría inexistente → muestra error en esa fila
- [x] Subir CSV con nombre vacío → muestra error en esa fila
- [x] Subir archivo que no es CSV → error de validación
- [x] Tras importación exitosa → productos aparecen en el listado

### API
- [x] `POST /api/products/import` sin sesión → 401
- [x] `POST /api/products/import` sin archivo → 400
- [x] `POST /api/products/import` con CSV sin columnas requeridas → 400
- [x] `POST /api/products/import` con CSV válido → 200 con summary

---

## 7. Seguridad de subdominios

> ⚠️ **Obsoleta desde 10-07** — los proxies de admin/superadmin fueron eliminados (no-ops). Estas pruebas ya no aplican: el aislamiento multi-tenant se valida por datos (RLS + `withTenantContext` + tests de tenant isolation), no por host. Mantenidas como registro histórico.

### Admin (localhost:3001)
- [x] Acceder a `tienda1.lvh.me:3001/login` → respuesta 403 *(histórico, pre-cleanup del 10-07)*
- [x] Acceder a `localhost:3001/login` → carga normalmente

### Superadmin (localhost:3002)
- [x] Acceder a `tienda1.lvh.me:3002/login` → respuesta 403 *(histórico, pre-cleanup del 10-07)*
- [x] Acceder a `localhost:3002/login` → carga normalmente
