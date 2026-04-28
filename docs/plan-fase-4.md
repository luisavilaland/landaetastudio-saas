## Plan de Implementación – Fase 4: Autoservicio del Tenant

### Orden de ejecución
1. Métodos de envío configurables (migración + CRUD + integración checkout)
2. Configuración visual del tenant (logo, colores, fuentes)
3. Dominio personalizado (resolución en proxy + UI admin)
4. Página de perfil de tienda (pública, solo lectura)

### 1. Métodos de envío configurables
- **Base de datos:** Nueva tabla `shipping_methods` en `packages/db/src/schema.ts` con campos: id, tenantId, name, description, price (centavos), freeShippingThreshold, estimatedDaysMin, estimatedDaysMax, isActive, sortOrder. Índice en tenantId.
- **API endpoints (admin):** CRUD completo en `apps/admin/app/api/shipping/route.ts` y `[id]/route.ts`. Filtrar siempre por tenantId.
- **Validación:** Schemas `createShippingMethodSchema` y `updateShippingMethodSchema` en `@repo/validation`.
- **UI admin:** `apps/admin/app/shipping/page.tsx` con tabla, formulario crear/editar, eliminar con confirmación.
- **Integración checkout:** Modificar `apps/storefront/app/api/checkout/route.ts` para aceptar `shippingMethodId` y calcular costo. Guardar método en `orders.shippingDetails` (JSONB).
- **Redis:** Cachear métodos por tenant (`shipping:methods:<tenantId>`, TTL 1 hora). Invalidar al crear/editar/eliminar.
- **Testing:** Tests de integración para CRUD (éxito, 401/403, validación tenant, errores Zod). Test unitario para schemas.
- **Documentación:** Actualizar README (nuevos endpoints), SETUP (datos de prueba), arquitectura (decisión sobre Redis).

### 2. Configuración visual del tenant
- **Base de datos:** Sin cambios. Se usa `tenants.settings` (JSONB). Estructura: logoUrl, primaryColor, secondaryColor, accentColor, fontFamily, storeDescription, contactEmail, contactPhone, socialLinks.
- **API endpoints:** Modificar `PUT /api/tenants/[id]` en superadmin para aceptar `settings`. Nuevo endpoint en admin: `GET/PUT /api/store/settings`.
- **Validación:** `storeSettingsSchema` en `@repo/validation`.
- **UI admin:** `apps/admin/app/store/settings/page.tsx` con upload de logo, selectores de color, fuente, campos de contacto, vista previa.
- **Storefront:** Modificar `apps/storefront/app/layout.tsx` para leer settings e inyectar variables CSS (`--tenant-primary`, etc.).
- **Redis:** Cachear settings por tenant (`tenant:settings:<slug>`, TTL 1 hora). Invalidar al actualizar.
- **Testing:** Tests de integración para endpoints de settings. Test unitario del schema.
- **Documentación:** Actualizar README, arquitectura (JSONB + variables CSS).

### 3. Dominio personalizado
- **Base de datos:** Sin cambios. Se usa `tenants.customDomain` (ya existe).
- **Lógica:** Modificar `apps/storefront/proxy.ts` para resolver dominio personalizado. Redis para cachear mapeo `domain:<customDomain>` → `tenantSlug`.
- **API:** Modificar `PUT /api/tenants/[id]` en superadmin para validar y guardar `customDomain`. Invalidar caché al cambiar.
- **UI admin:** `apps/admin/app/store/domain/page.tsx` con campo para dominio, instrucciones DNS (CNAME), indicador de verificación.
- **Testing:** Tests unitarios para resolución de dominio en proxy. Tests de integración para endpoint de customDomain.
- **Documentación:** Actualizar README, SETUP (cómo probar localmente).

### 4. Página de perfil de tienda
- **UI storefront:** `apps/storefront/app/perfil/page.tsx` con nombre, logo, descripción, contacto, redes, categorías.
- **Navbar/Footer:** Agregar enlace en layout del storefront.
- **SEO:** Datos estructurados JSON-LD.
- **Caché:** ISR o Redis (TTL 1 hora).
- **Testing:** Test de integración/componente.
- **Documentación:** Actualizar README.

### Tareas transversales por sub-fase
- Migraciones: `pnpm db:generate` + `pnpm db:migrate` tras crear tabla shipping_methods.
- Seed: actualizar `packages/db/seed.ts` con métodos de envío de ejemplo y settings visuales.
- Validación: extender `@repo/validation` con nuevos schemas.
- Testing: tests unitarios (schemas) + tests de integración (endpoints).
- DoD: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`.
- Commits atómicos por sub-fase en formato conventional commits.
- Documentación: mantener sincronizados README, SETUP, arquitectura y AGENTS según reglas de mantenimiento.
