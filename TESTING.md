# Testing Checklist – saas-ecommerce

Este archivo contiene el checklist de pruebas para verificar el funcionamiento de todas las fases implementadas.

---

## Fase 1 – Autenticación y Órdenes ✅

### Login de Admin
- ✅ Login de admin con admin@tienda1.com / 123456
- ✅ Redirección a /dashboard tras login exitoso
- ✅ Protección de rutas: redirección a login sin sesión en admin y superadmin

### Login de Superadmin
- ✅ Login de superadmin con super@admin.com / 123456
- ✅ Redirección a /tenants tras login exitoso

### Registro de Cliente
- ✅ Registro de cliente vía API con datos válidos (201)
- ✅ Registro de cliente duplicado retorna 409

### Login de Cliente
- ✅ Login de cliente en storefront
- ✅ Logout de cliente redirige al storefront (no al admin)

### Panel de Admin - Órdenes
- ✅ Listado de órdenes en panel de admin
- ✅ Detalle de orden en panel de admin
- ✅ Cambio de estado de orden desde panel de admin

---

## Fase 2 – Dashboard y Stock ✅

### Dashboard
- ✅ Dashboard con métricas (4 tarjetas: ventas del mes, órdenes pendientes, etc.)
- ✅ Tabla de últimas órdenes en dashboard
- ✅ Lista de productos con stock bajo en dashboard (enlace a editar)

### Gestión de Stock
- ✅ Badges de stock en tabla de admin (amarillo ≤ 5, rojo = 0)
- ✅ Edición rápida de stock inline en tabla de admin (se actualiza sin recargar)
- ✅ Badge "Agotado" y botón deshabilitado en storefront para productos sin stock
- ✅ Botón "Agregar al carrito" habilitado solo para productos con stock

---

## Fase 3 – Experiencia de Tienda Completa ✅

### Categorías
- ✅ CRUD de categorías en admin (crear, editar, eliminar)
- ✅ Slug de categoría se regenera al editar el nombre
- ✅ Slug actualizado se refleja en la tabla sin recargar la página
- ✅ Menú desplegable de categorías en storefront
- ✅ Filtro de productos por categoría (?category=slug)
- ✅ Asignación de categoría a producto en formulario de edición

### Imágenes Múltiples
- ✅ Subida de imágenes adicionales vía endpoint
- ✅ Galería de imágenes en página de detalle del storefront
- ✅ Imágenes visibles en formulario de edición de producto en admin
- ✅ Eliminación individual de imágenes

### Variantes Múltiples
- ✅ Selector de variante en página de detalle del storefront
- ✅ Cambio dinámico de precio y stock según variante seleccionada
- ✅ Agregar al carrito con variantId correcto
- ✅ Visualización de variante (atributos) en el carrito
- ✅ Cálculo de precio según variante en carrito

### Búsqueda
- ✅ Barra de búsqueda en storefront
- ✅ Resultados de búsqueda con productos coincidentes

### Carrito
- ✅ Imágenes visibles en el carrito
- ✅ Eliminar un ítem individual (ícono de papelera)
- ✅ Cambiar cantidad de un ítem (incrementar/decrementar)
- ✅ Vaciar carrito completo
- ✅ Eliminar ítem individual no vacía la página (persisten los demás ítems)
- ✅ Cambiar cantidad no vacía la página
- ✅ Refetch de ítems tras operaciones DELETE/PUT

### Validación Zod
- ✅ Endpoint de registro rechaza datos inválidos con 400 y array de errores estructurados

### UX / Seguridad
- ✅ Login redirige al dashboard si ya hay sesión iniciada
- ✅ Logout de superadmin redirige al login del propio superadmin
- ✅ Logout de cliente redirige al storefront (no al admin)

---

## Pendientes 🔄

### Flujo E2E Completo de Compra con MercadoPago
- 🔄 Flujo E2E completo de compra con MercadoPago (no se pudo probar por problemas con la cuenta de comprador de prueba)

### Problemas Conocidos (Known Issues)

#### Tests Fallando (3 tests en categories/[id])
- **Estado**: 🔄 Pendiente de fix
- **Archivo**: `apps/admin/app/api/categories/[id]/__tests__/route.test.ts`
- **Tests que fallan**:
  1. `should regenerate slug when name changes`
  2. `should return 409 when regenerated slug already exists for tenant`
  3. `should keep provided slug if name doesn't change`
- **Error**: `Cannot find module 'next/server' imported from next-auth/lib/env.js`
- **Causa**: Vitest + next-auth@5.0.0-beta.31 incompatibilidad con la estructura de módulos en pnpm
- **Workaround intentado**: Actualizar next-auth a latest beta, pero persiste
- **Solución propuesta**: Migrar tests a Jest o esperar actualización de next-auth stable

---

## Notas
- Última actualización: 28 de abril de 2026
- Total de pruebas automatizadas: 119 (116 pasando, 3 fallando)
- Los 3 tests fallando están relacionados con next-auth beta + vitest, no con la lógica de negocio
