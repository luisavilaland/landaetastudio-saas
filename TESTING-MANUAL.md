# Checklist de Pruebas Manuales — SaaS eCommerce

**Fecha:** Abril 2026 | **Versión:** 1.0 | **Estado:** Pre Fase 5

> Ejecutar en orden. Marcar cada ítem con ✅ al verificar o ❌ si falla.
> Credenciales: admin@tienda1.com / 123456 | super@admin.com / 123456

---

## 0. Setup previo

- [ ] Docker corriendo (`docker compose ps` — 4 servicios UP)
- [ ] `pnpm dev` corriendo (storefront :3000, admin :3001, superadmin :3002)
- [ ] `pnpm db:seed` ejecutado (datos frescos)
- [ ] ngrok corriendo (`ngrok http 3000`) y URL en `.env.local`

---

## 1. Superadmin (localhost:3002)

### Autenticación

- [ ] Login con super@admin.com / 123456 → redirige a /tenants
- [ ] Login con credenciales incorrectas → mensaje de error
- [ ] Acceder a /tenants sin sesión → redirige a /login
- [ ] Logout → redirige a /login del superadmin (no al admin)

### CRUD de Tenants

- [ ] Listado de tenants muestra tienda1
- [ ] Crear tenant nuevo con slug único → aparece en listado
- [ ] Editar tenant → cambios reflejados sin recargar
- [ ] Asignar customDomain válido → se guarda correctamente
- [ ] Asignar customDomain con formato inválido (con http://) → error 400
- [ ] Asignar customDomain ya usado por otro tenant → error 409
- [ ] Dejar customDomain vacío → se setea a null en BD
- [ ] Eliminar tenant → desaparece del listado

### API domain-check

- [ ] `curl "localhost:3002/api/domain-check?domain=disponible123.com"` → `{"available":true}`
- [ ] `curl "localhost:3002/api/domain-check?domain=tienda1.com"` (si existe) → `{"available":false}`
- [ ] `curl "localhost:3002/api/domain-check"` (sin parámetro) → 400

---

## 2. Admin (localhost:3001)

### Autenticación

- [ ] Login con admin@tienda1.com / 123456 → redirige a /dashboard
- [ ] Login con credenciales incorrectas → mensaje de error
- [ ] Acceder a /dashboard sin sesión → redirige a /login
- [ ] Logout → redirige a /login del admin (no al storefront)
- [ ] Login redirige al dashboard si ya hay sesión activa

### Dashboard

- [ ] 4 tarjetas de métricas visibles (ventas, órdenes, productos, stock bajo)
- [ ] Tabla de últimas órdenes con datos reales del seed
- [ ] Lista de productos con stock bajo con enlace a editar
- [ ] Métricas muestran valores correctos (no todos en cero)

### Categorías (/categorias)

- [ ] Listado de categorías: Remeras, Pantalones, Accesorios
- [ ] Crear categoría nueva → aparece en listado
- [ ] Editar nombre → slug se regenera automáticamente
- [ ] Slug actualizado reflejado sin recargar página
- [ ] Eliminar categoría → desaparece del listado
- [ ] Crear categoría con slug duplicado → error 409

### Productos (/products)

- [ ] Listado de 3 productos del seed con imagen, precio y stock
- [ ] Badge amarillo para stock ≤ 5, rojo para stock = 0
- [ ] Edición rápida de stock inline → se actualiza sin recargar
- [ ] Crear producto nuevo con variantes → aparece en listado
- [ ] Editar producto → cambios reflejados
- [ ] Subir imagen → imagen visible en formulario y storefront
- [ ] Eliminar imagen individual → desaparece del formulario
- [ ] Importar productos por CSV (si está implementado)
- [ ] SKU se regenera al actualizar slug del producto

### Variantes

- [ ] Agregar múltiples variantes con diferentes atributos (color, talle)
- [ ] Cada variante tiene precio y stock independiente
- [ ] Variante sin stock muestra badge "Agotado"

### Órdenes (/orders)

- [ ] Listado de 2 órdenes del seed (1 confirmada, 1 pendiente)
- [ ] Ver detalle de orden → muestra productos, cliente, dirección, total
- [ ] Cambiar estado de orden desde el panel → se actualiza
- [ ] Filtrar órdenes por estado

### Métodos de Envío (/shipping)

- [ ] Listado muestra "Envío estándar" y "Envío express"
- [ ] Crear nuevo método con precio y días de entrega → aparece en listado
- [ ] Editar método → cambios reflejados
- [ ] Desactivar método (isActive = false) → no aparece en checkout del storefront
- [ ] Eliminar método → desaparece del listado

### Configuración Visual (/store/settings)

- [ ] Página carga sin error JSON
- [ ] Formulario muestra campos: logo, colores, descripción, contacto, redes sociales
- [ ] Guardar configuración → respuesta 200 y mensaje de éxito
- [ ] Cambios de color se reflejan en el storefront

### Dominio Personalizado (/store/domain)

- [ ] Página carga correctamente
- [ ] Ingresar dominio válido y guardar → muestra confirmación
- [ ] Ingresar dominio inválido (con http://) → error de validación
- [ ] Instrucciones DNS visibles en la página

---

## 3. Storefront (localhost:3000)

### Proxy y resolución de tenant

- [ ] Logs `[Proxy] Tenant Slug: default` visibles en terminal al acceder a localhost:3000
- [ ] Acceder a tienda1.lvh.me:3000 → logs muestran `[Proxy] Tenant Slug: tienda1`
- [ ] Rutas estáticas (/\_next/static) NO aparecen en logs del proxy

### Página de inicio

- [ ] Carga con productos activos de tienda1
- [ ] Navbar con logo, categorías y carrito
- [ ] Menú desplegable de categorías funciona

### Catálogo y búsqueda

- [ ] Listado de productos con imagen, nombre y precio
- [ ] Filtro por categoría (?category=remeras) muestra solo esa categoría
- [ ] Barra de búsqueda → resultados con productos coincidentes
- [ ] Producto sin stock muestra badge "Agotado" y botón deshabilitado

### Página de producto

- [ ] Imagen principal y galería de imágenes funcionan
- [ ] Selector de variantes (talle, color) cambia precio y stock dinámicamente
- [ ] Botón "Agregar al carrito" habilitado solo con stock disponible
- [ ] Breadcrumbs visibles y navegables

### Carrito (/cart)

- [ ] Agregar producto → aparece en carrito con imagen, nombre y precio
- [ ] Cambiar cantidad → total se actualiza sin recargar página
- [ ] Eliminar ítem individual → resto del carrito persiste
- [ ] Vaciar carrito → carrito vacío
- [ ] Variante seleccionada visible en el carrito
- [ ] Precio correcto según variante seleccionada

### Checkout (/checkout)

- [ ] Formulario muestra campos: nombre, email, teléfono, dirección
- [ ] Selector de métodos de envío muestra "Envío estándar" y "Envío express"
- [ ] Seleccionar "Envío express" → precio del envío se actualiza en resumen
- [ ] Carrito superior a $2000 → "Envío estándar" aparece como "Gratis"
- [ ] Resumen muestra subtotal + envío + total correctamente
- [ ] Botón "Pagar" incluye el total con envío
- [ ] Submit sin completar campos → validación en frontend

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

- [ ] Página carga sin login (pública)
- [ ] Muestra nombre de la tienda
- [ ] Logo visible si está configurado
- [ ] Descripción visible si está configurada
- [ ] Links de Instagram/Facebook si están configurados
- [ ] Categorías listadas como links clickeables
- [ ] `<title>` en el `<head>` es el nombre de la tienda
- [ ] JSON-LD con schema de tienda en el HTML

### Autenticación de cliente

- [ ] Registro con email nuevo → 201
- [ ] Registro con email duplicado → 409
- [ ] Login de cliente → sesión activa
- [ ] Logout → redirige al storefront (no al admin)

---

## 4. Pruebas de seguridad básicas

### Aislamiento de tenants

- [ ] Login en admin de tienda1 → NO puede ver productos de otro tenant
- [ ] Llamar `/api/products` sin sesión → 401
- [ ] Llamar `/api/orders` con tenantId de otro tenant en headers → sin datos ajenos

### Headers del proxy

- [ ] `x-tenant-slug` presente en cada request al storefront
- [ ] `x-cart-session-id` presente en cada request (cookie persistente)

---

## 5. Pruebas de integración automáticas

```bash
cd ~/landaetastudio-saas
pnpm test
```

- [ ] 195 tests pasando
- [ ] 0 tests fallando

```bash
pnpm build
```

- [ ] 3 builds exitosos (storefront, admin, superadmin)
- [ ] 0 errores de TypeScript

---

## Resumen de resultados

| Área              | Total ítems | ✅ OK | ❌ Falla |
| ----------------- | ----------- | ----- | -------- |
| Superadmin        | 15          |       |          |
| Admin             | 35          |       |          |
| Storefront        | 35          |       |          |
| Seguridad         | 5           |       |          |
| Tests automáticos | 2           |       |          |
| **Total**         | **92**      |       |          |

---

_Checklist generado en Abril 2026 — Pre Fase 5_
