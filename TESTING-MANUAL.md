# Checklist de Pruebas Manuales — SaaS eCommerce

**Fecha:** Abril 2026 | **Versión:** 1.0 | **Estado:** Pre Fase 5

> Ejecutar en orden. Marcar cada ítem con ✅ al verificar o ❌ si falla.
> Credenciales: admin@tienda1.com / 123456 | super@admin.com / 123456

---

## 0. Setup previo

- [x] Docker corriendo (`docker compose ps` — 4 servicios UP)
- [x] `pnpm dev` corriendo (storefront :3000, admin :3001, superadmin :3002)
- [x] `pnpm db:seed` ejecutado (datos frescos)
- [x] ngrok corriendo (`ngrok http 3000`) y URL en `.env.local`

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
- [ ] Edición rápida de stock inline → se actualiza sin recargar
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
- [ ] Email de confirmación recibido en MailHog (localhost:8025)
- [ ] Pago fallido → redirige a /checkout/failure
- [ ] Pago pendiente → redirige a /checkout/pending

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
cd ~/landaetastudio-saas
pnpm test
```

- [x] 195 tests pasando
- [x] 0 tests fallando

```bash
pnpm build
```

- [x] 3 builds exitosos (storefront, admin, superadmin)
- [x] 0 errores de TypeScript

---

## Resumen de resultados

| Área              | Total ítems | ✅ OK | ❌ Falla |
| ----------------- | ----------- | ----- | -------- |
| Superadmin        | 19          | 19    | 0        |
| Admin             | 35          | 33    | 2        |
| Storefront        | 35          | 31    | 4        |
| Seguridad         | 5           | 5     | 0        |
| Tests automáticos | 2           | 2     | 0        |
| **Total**         | **96**      | **90**| **6**    |

---
_Archivo actualizado en Mayo 2026 — concordante con TESTING.md_
_Checklist generado en Abril 2026 — Pre Fase 5_

---

## Pendientes documentados

### Importación de productos por CSV
- **Estado:** No implementado
- **Descripción:** Permitir que el admin cargue productos masivamente desde un archivo CSV
- **Campos mínimos del CSV:** nombre, slug, descripción, precio, stock, categoría, SKU
- **Ubicación sugerida:** `/admin/products` → botón "Importar CSV"
- **Endpoints a crear:** `POST /api/products/import` en admin
- **Consideraciones:** validar formato, manejar errores por fila, reportar resumen de importación

### Seguridad de subdominios en admin y superadmin
- **Estado:** ✅ Implementado — commit 13b5f28
- **Descripción:** proxy.ts en admin y superadmin rechaza requests desde subdominios de tenant
- **Pendiente para producción:** configurar variables `ADMIN_HOST` y `SUPERADMIN_HOST` en Vercel

---

## 6. Importación de productos por CSV

### UI Admin (/products)
- [ ] Botón "Importar CSV" visible junto a "Nuevo Producto"
- [ ] Click en "Importar CSV" → abre modal
- [ ] Botón "Descargar template de ejemplo" → descarga CSV con columnas correctas
- [ ] Subir CSV válido → muestra resumen (creados, omitidos, errores)
- [ ] Subir CSV con productos duplicados → muestra fila omitida con razón
- [ ] Subir CSV con precio negativo → muestra error en esa fila
- [ ] Subir CSV con categoría inexistente → muestra error en esa fila
- [ ] Subir CSV con nombre vacío → muestra error en esa fila
- [ ] Subir archivo que no es CSV → error de validación
- [ ] Tras importación exitosa → productos aparecen en el listado

### API
- [ ] `POST /api/products/import` sin sesión → 401
- [ ] `POST /api/products/import` sin archivo → 400
- [ ] `POST /api/products/import` con CSV sin columnas requeridas → 400
- [ ] `POST /api/products/import` con CSV válido → 200 con summary

---

## 7. Seguridad de subdominios

### Admin (localhost:3001)
- [ ] Acceder a `tienda1.lvh.me:3001/login` → respuesta 403
- [ ] Acceder a `localhost:3001/login` → carga normalmente

### Superadmin (localhost:3002)
- [ ] Acceder a `tienda1.lvh.me:3002/login` → respuesta 403
- [ ] Acceder a `localhost:3002/login` → carga normalmente
