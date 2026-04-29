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

## Fase 4 – Dominio Personalizado y Perfil de Tienda ✅

### Sub-fase 0: Configuración Visual del Tenant

#### API Admin - Settings
- ✅ GET /api/store/settings → retorna configuración actual del tenant
- ✅ PUT /api/store/settings → actualiza logo, colores, descripción, contacto y redes sociales
- ✅ Endpoint corregido: frontend apuntaba a /api/store/settings (correcto) pero el archivo existía solo en /api/config/settings (fix aplicado en Fase 4)

#### UI Admin - Página de Configuración (/store/settings)
- ✅ Acceder a /store/settings → carga sin error JSON
- ✅ Formulario muestra campos: logo, color primario, secundario, acento, fuente, descripción, email, teléfono, Instagram, Facebook
- ✅ Guardar configuración → respuesta 200 y mensaje de éxito

### Sub-fase 3: Dominio Personalizado

#### Resolución de Dominio en Proxy (proxy.ts)
> ✅ Proxy restaurado en Fase 4. NextResponse.next() funciona correctamente con Turbopack en Next.js 16.2.4. Matcher optimizado para excluir rutas estáticas (_next/static, imágenes).

- ✅ Proxy activo: logs [Proxy] visibles en consola para cada request
- ✅ Matcher optimizado: rutas /_next/static/* excluidas del proxy
- ✅ Caso 1.1: Acceder vía tienda1.lvh.me:3000 → resolver tenant
- ✅ Caso 1.2: customDomain en BD → resolver al tenant correcto
- ✅ Caso 1.3: Dominio inexistente → devuelve 404 (corregido en Fase 4)
- ✅ Caso 1.4: Logs [Proxy] visibles en consola con Hostname, Path y Tenant Slug

#### API Superadmin - Gestión de Tenant
- ✅ Caso 2.1: PUT /api/tenants/[id] con customDomain: "mitienda.com" → respuesta 200 con campo actualizado
- ✅ Caso 2.2: Enviar customDomain con formato inválido (ej. http://mitienda.com) → respuesta 400
- ✅ Caso 2.3: Asignar un customDomain que ya tiene otro tenant → respuesta 409 Conflict
- ✅ Caso 2.4: Enviar customDomain: "" (vacío) → el campo se setea a null en BD
- ✅ Caso 2.5: GET /api/tenants/[id] → respuesta incluye campo customDomain

#### API Pública de Verificación
- ✅ Caso 3.1: GET /api/domain-check?domain=disponible.com → devuelve { available: true }
- ✅ Caso 3.2: GET /api/domain-check?domain=dominio-ya-usado.com → devuelve { available: false }
- ✅ Caso 3.3: Sin parámetro domain → devuelve 400 con mensaje de error

#### UI Admin - Página de Dominio (/store/domain)
- ✅ Caso 4.1: Acceder a /store/domain → carga correctamente con datos del tenant
- ✅ Caso 4.2: Ingresar dominio válido y guardar → actualiza customDomain del tenant
- ✅ Caso 4.3: Ingresar dominio inválido (con http://) → validación Zod rechaza con error 400
- ✅ Caso 4.4: Hacer click en "Verificar ahora" → verifica disponibilidad vía /api/domain-check
- ✅ Caso 4.5: Instrucciones de DNS se muestran correctamente en la página
- ✅ Caso 4.6: El enlace "Dominio" aparece en el header del dashboard

#### Redis Cache (Opcional - Si se implementa en Fase 5)
- Caso 5.1: Tras configurar dominio, verificar que se cachea en Redis con TTL 1 hora
- Caso 5.2: Cambiar dominio → invalidar caché anterior

### Sub-fase 4: Página de Perfil de Tienda

#### Página Pública de Perfil (/perfil)
- ✅ Caso 6.1: Acceder a /perfil → mostrar nombre de la tienda
- ✅ Caso 6.2: Si settings.logoUrl existe → mostrar logo
- ✅ Caso 6.3: Si settings.storeDescription existe → mostrar descripción
- ✅ Caso 6.4: Si settings.contactEmail existe → mostrar en sección "Contacto" con link mailto:
- ✅ Caso 6.5: Si settings.contactPhone existe → mostrar teléfono
- ✅ Caso 6.6: Si settings.socialLinks.instagram existe → mostrar link a Instagram
- ✅ Caso 6.7: Si settings.socialLinks.facebook existe → mostrar link a Facebook
- ✅ Caso 6.8: Verificar que las categorías se muestren como links clickeables
- ✅ Caso 6.9: Si no hay categorías → la sección no debe aparecer

#### SEO y Metadatos
- ✅ Caso 7.1: Verificar que el <title> de la página sea el nombre de la tienda
- ✅ Caso 7.2: Verificar que <meta name="description"> contenga la descripción de la tienda
- ✅ Caso 7.3: Inspeccionar el JSON-LD en el HTML → debe contener Store schema con name, description, url, logo (si existe), email, telephone
- ✅ Caso 7.4: Verificar que la URL en JSON-LD use el subdominio correcto

#### Navegación
- ✅ Caso 8.1: Verificar que en el navbar aparezca el enlace "Perfil"
- ✅ Caso 8.2: Click en "Perfil" en navbar → redirige a /perfil
- ✅ Caso 8.3: Verificar que en el footer aparezca "Sobre la tienda"
- ✅ Caso 8.4: Click en "Sobre la tienda" en footer → redirige a /perfil

#### Renderizado sin autenticación
- ✅ Caso 9.1: Acceder a /perfil sin estar logueado → la página debe cargar igual (es pública)
- ✅ Caso 9.2: Verificar que no haya redirecciones al login

#### Pruebas de Integración (BD requerida)
Nota: Estos tests requieren BD disponible. Documentado en TESTING.md.

- ✅ Caso 10.1: Tests unitarios de customDomainSchema → deben pasar (18 tests en packages/validation)
- 🔄 Caso 10.2: Tests de integración de superadmin domain → bloqueados por conexión a BD (esperado: 4 tests fallan)
- ✅ Caso 10.3: Tests de metadatos de perfil → deben pasar (3 tests en apps/storefront/app/perfil)

### Resumen de Verificación Rápida (Smoke Tests)

| # | Prueba | Comando/Acción |
|---|--------|-------------------|
| 1 | Resolución por subdominio | Acceder a tienda1.lvh.me:3000 |
| 2 | Página de perfil carga | Acceder a tienda1.lvh.me:3000/perfil |
| 3 | Enlace en navbar funciona | Click en "Perfil" en tienda |
| 4 | UI admin dominio carga | Login admin → /store/domain (carga correctamente) |
| 5 | Guardar dominio válido | Login admin → /store/domain → ingresar dominio → guardar |
| 6 | API domain-check | `curl "localhost:3001/api/domain-check?domain=test.com"` → `{ available: true/false }` |
| 7 | Metadatos SEO | Inspeccionar `<head>` en /perfil |
| 8 | Configuración visual carga sin error | Login admin → /store/settings → verificar que carga el formulario |
| 9 | Proxy activo en storefront | Verificar logs [Proxy] en terminal al acceder a localhost:3000 |
| 10 | Proxy dominio inexistente | Acceder con dominio inexistente → devuelve 404 |

---

## Pendientes 🔄

### Flujo E2E Completo de Compra con MercadoPago
- 🔄 **BLOQUEANTE para producción** — Flujo E2E completo con MercadoPago pendiente de verificación
- Problema: cuenta de comprador de prueba en sandbox no disponible
- Pasos para verificar cuando esté disponible:
  1. Agregar producto al carrito en storefront
  2. Completar checkout con datos de envío
  3. Pagar con tarjeta de prueba de MercadoPago sandbox
  4. Verificar que la orden cambia a estado "confirmed"
  5. Verificar que llega email de confirmación
  6. Verificar que el stock se descuenta correctamente

### Problemas Conocidos (Known Issues)

#### Tests Fallando (16 tests preexistentes)
- **Estado**: 🔄 Pendiente de fix
- **Tests preexistentes (16)**:
   - **Archivo**: `apps/admin/app/api/categories/[id]/__tests__/route.test.ts` (3 tests)
     - `should regenerate slug when name changes`
     - `should return 409 when regenerated slug already exists for tenant`
     - `should keep provided slug if name doesn't change`
   - **Archivo**: `apps/admin/app/api/shipping/__tests__/route.test.ts` (5 tests)
   - **Archivo**: `apps/admin/app/api/shipping/__tests__/[id].test.ts` (8 tests)
- **Error**: `Cannot find module 'next/server' imported from next-auth/lib/env.js`
- **Causa**: Vitest + next-auth@5.0.0-beta.31 incompatibilidad con la estructura de módulos en pnpm
- **Solución propuesta**: Migrar tests a Jest o esperar actualización de next-auth stable

#### Error de Build (favicon.ico)
- **Estado**: 🔄 Pendiente de investigación
- **Error**: `TypeError: Cannot read private member #state from an object whose class did not declare it` en `/favicon.ico`
- **Impacto**: Afecta builds de admin y superadmin
- **Causa**: Probablemente bug de Next.js 16.2.4 con favicon.ico
- **Workaround**: No bloquea desarrollo (lint y typecheck pasan)

---

## Notas
- Última actualización: 29 de abril de 2026 — Fase 4 completada. Documentación actualizada con fixes de proxy, domain-check, /store/domain y dashboard.
- Total de pruebas automatizadas: 175 (160 pasando, 15 fallando por next-auth beta)
- Fase 4 completada: Dominio Personalizado + Página de Perfil
- Problemas críticos pendientes:
  - Tests fallantes por next-auth beta (15 tests)
  - Build falla por favicon.ico (Next.js 16.2.4 bug)
  - Flujo E2E MercadoPago pendiente de verificación
