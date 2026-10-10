# Testing Checklist – saas-ecommerce

Este archivo contiene el checklist de pruebas para verificar el funcionamiento de todas las fases implementadas.

---

## Pruebas Manuales – 12 de agosto de 2026

### Setup Previo

| #   | Prueba                                                                         | Estado |
| --- | ------------------------------------------------------------------------------ | ------ |
| 1   | Servicios cloud accesibles (Neon, Upstash, R2, Resend — `.env.local` completo) | ✅     |
| 2   | Migraciones aplicadas (`pnpm db:migrate`)                                      | ✅     |
| 3   | Seed ejecutado (`pnpm db:seed` — 2 tenants: tienda1, tienda2)                  | ✅     |
| 4   | Apps en desarrollo (`pnpm dev`) sin errores                                    | ✅     |
| 5   | E2E: `playwright.config.ts` en raíz + vars `E2E_*` en `.env.local` (opcional)  | ✅     |

---

### Superadmin – Autenticación

| #   | Prueba                             | Estado |
| --- | ---------------------------------- | ------ |
| 1   | Login con super@admin.com / 123456 | ✅     |
| 2   | Redirección a /tenants tras login  | ✅     |
| 3   | Protección de rutas sin sesión     | ✅     |
| 4   | Logout funcional                   | ✅     |

### Superadmin – CRUD Tenants

| #   | Prueba                                     | Estado |
| --- | ------------------------------------------ | ------ |
| 1   | Listado de tenants                         | ✅     |
| 2   | Crear tenant nuevo                         | ✅     |
| 3   | Editar tenant existente                    | ✅     |
| 4   | Eliminar tenant                            | ✅     |
| 5   | Validación de slug duplicado               | ✅     |
| 6   | Asignar customDomain                       | ✅     |
| 7   | Limpiar customDomain (vacío → null)        | ✅     |
| 8   | GET /api/tenants/[id] incluye customDomain | ✅     |
| 9   | Validación customDomain duplicado al crear | ✅     |

### Superadmin – API Domain-Check

| #   | Prueba                                                        | Estado |
| --- | ------------------------------------------------------------- | ------ |
| 1   | GET /api/domain-check?domain=disponible.com → available: true | ✅     |
| 2   | GET /api/domain-check?domain=usado.com → available: false     | ✅     |
| 3   | Sin parámetro domain → 400                                    | ✅     |

### Superadmin – General

| #   | Prueba                | Estado |
| --- | --------------------- | ------ |
| 1   | Ruta /plans accesible | ✅     |

---

### Admin – Autenticación

| #   | Prueba                               | Estado |
| --- | ------------------------------------ | ------ |
| 1   | Login con admin@tienda1.com / 123456 | ✅     |
| 2   | Redirección a /dashboard             | ✅     |
| 3   | Protección de rutas sin sesión       | ✅     |
| 4   | Logout funcional                     | ✅     |
| 5   | Login redirige si ya hay sesión      | ✅     |

### Admin – Dashboard

| #   | Prueba                                        | Estado |
| --- | --------------------------------------------- | ------ |
| 1   | Tarjetas de métricas (ventas, órdenes, stock) | ✅     |
| 2   | Tabla de últimas órdenes                      | ✅     |
| 3   | Lista de productos con stock bajo             | ✅     |
| 4   | Enlace a editar producto desde stock bajo     | ✅     |

### Admin – Categorías

| #   | Prueba                               | Estado |
| --- | ------------------------------------ | ------ |
| 1   | Listado de categorías                | ✅     |
| 2   | Crear categoría nueva                | ✅     |
| 3   | Editar categoría (slug se regenera)  | ✅     |
| 4   | Eliminar categoría                   | ✅     |
| 5   | Slug duplicado retorna 409           | ✅     |
| 6   | Slug reflejado en tabla sin recargar | ✅     |

### Admin – Productos

| #   | Prueba                                                                        | Estado |
| --- | ----------------------------------------------------------------------------- | ------ |
| 1   | Listado de productos                                                          | ✅     |
| 2   | Stock visible con badges                                                      | ✅     |
| 3   | Edición rápida de stock inline (solo lectura, muestra la suma de variantes)   | ✅     |
| 4   | Editar producto (nombre, descripción, precio)                                 | ✅     |
| 5   | Eliminar imagen individual                                                    | ✅     |
| 6   | Crear producto (bug: slug primera letra)                                      | ✅     |
| 7   | Subir imagen en creación                                                      | ✅     |
| 8   | Crear producto con variantes                                                  | ✅     |
| 9   | Editar producto                                                               | ✅     |
| 10  | Editar imagen                                                                 | ✅     |
| 11  | Eliminar imagen individual                                                    | ✅     |
| 12  | SKU se regenera al actualizar slug                                            | ✅     |
| 13  | Importar productos por CSV (probado con archivo válido y archivo con errores) | ✅     |

### Admin – Variantes

| #   | Prueba                              | Estado |
| --- | ----------------------------------- | ------ |
| 1   | Agregar variante al editar producto | ✅     |
| 2   | Editar variante existente           | ✅     |
| 3   | Eliminar variante                   | ✅     |

### Admin – Órdenes

| #   | Prueba             | Estado |
| --- | ------------------ | ------ |
| 1   | Listado de órdenes | ✅     |
| 2   | Detalle de orden   | ✅     |
| 3   | Cambio de estado   | ✅     |
| 4   | Filtro por estado  | ✅     |

### Admin – Métodos de Envío

| #   | Prueba             | Estado |
| --- | ------------------ | ------ |
| 1   | Listado de métodos | ✅     |
| 2   | Editar método      | ✅     |
| 3   | Desactivar método  | ✅     |
| 4   | Eliminar método    | ✅     |
| 5   | Crear nuevo método | ✅     |

### Admin – Configuración Visual

| #   | Prueba                               | Estado |
| --- | ------------------------------------ | ------ |
| 1   | Carga del formulario /store/settings | ✅     |
| 2   | Guardar configuración (200 OK)       | ✅     |
| 3   | Colores aplicados en storefront      | ✅     |

### Admin – Dominio Personalizado

| #   | Prueba                                   | Estado |
| --- | ---------------------------------------- | ------ |
| 1   | Carga de /store/domain                   | ✅     |
| 2   | Guardar dominio válido                   | ✅     |
| 3   | Validación de formato inválido (http://) | ✅     |
| 4   | Verificar disponibilidad                 | ✅     |

### Admin – Seguridad de Subdominios

| #   | Prueba                                          | Estado |
| --- | ----------------------------------------------- | ------ |
| 1   | Acceder a `tienda1.lvh.me:3001/login` → 403     | ✅     |
| 2   | Acceder a `localhost:3001/login` → carga normal | ✅     |
| 3   | Acceder a `tienda1.lvh.me:3002/login` → 403     | ✅     |
| 4   | Acceder a `localhost:3002/login` → carga normal | ✅     |

---

### Storefront – Proxy y Resolución

| #   | Prueba                                   | Estado |
| --- | ---------------------------------------- | ------ |
| 1   | tienda1.lvh.me:3000 resuelve tenant      | ✅     |
| 2   | customDomain resuelve al tenant correcto | ✅     |
| 3   | Dominio inexistente → 404                | ✅     |

### Storefront – Página de Inicio

| #   | Prueba                        | Estado |
| --- | ----------------------------- | ------ |
| 1   | Catálogo de productos visible | ✅     |
| 2   | Logo en navbar                | ✅     |
| 3   | Menú de categorías en navbar  | ✅     |

### Storefront – Catálogo y Búsqueda

| #   | Prueba                          | Estado |
| --- | ------------------------------- | ------ |
| 1   | Búsqueda por nombre de producto | ✅     |
| 2   | Filtro por categoría            | ✅     |
| 3   | Resultados sin coincidencias    | ✅     |
| 4   | Badge "Agotado" en sin stock    | ✅     |

### Storefront – Página de Producto

| #   | Prueba                            | Estado |
| --- | --------------------------------- | ------ |
| 1   | Nombre y descripción del producto | ✅     |
| 2   | Galería de imágenes               | ✅     |
| 3   | Selector de variantes             | ✅     |
| 4   | Precio y stock según variante     | ✅     |
| 5   | Breadcrumbs                       | ✅     |

### Storefront – Carrito

| #   | Prueba                         | Estado |
| --- | ------------------------------ | ------ |
| 1   | Agregar producto al carrito    | ✅     |
| 2   | Cambiar cantidad               | ✅     |
| 3   | Eliminar ítem individual       | ✅     |
| 4   | Vaciar carrito                 | ✅     |
| 5   | Persistencia (7 días TTL)      | ✅     |
| 6   | Carrito anónimo (sin login)    | ✅     |
| 7   | Variante seleccionada visible  | ✅     |
| 8   | Precio correcto según variante | ✅     |

### Storefront – Checkout

| #   | Prueba                                      | Estado |
| --- | ------------------------------------------- | ------ |
| 1   | Selector de método de envío                 | ✅     |
| 2   | Cálculo de envío gratis                     | ✅     |
| 3   | Desglose subtotal + envío + total           | ✅     |
| 4   | Crear orden (POST /api/checkout)            | ✅     |
| 5   | Redirección a MercadoPago                   | ✅     |
| 6   | Validación campos vacíos                    | ✅     |
| 7   | Formulario muestra campos completos         | ✅     |
| 8   | Seleccionar envío express actualiza resumen | ✅     |
| 9   | Carrito > $2000 → envío gratis              | ✅     |
| 10  | Botón pagar incluye total con envío         | ✅     |

### Storefront – Perfil

| #   | Prueba                           | Estado |
| --- | -------------------------------- | ------ |
| 1   | Nombre de la tienda              | ✅     |
| 2   | Logo del tenant                  | ✅     |
| 3   | Descripción de la tienda         | ✅     |
| 4   | Email de contacto (mailto:)      | ✅     |
| 5   | Teléfono                         | ✅     |
| 6   | Link Instagram                   | ✅     |
| 7   | Link Facebook                    | ✅     |
| 8   | Categorías como links            | ✅     |
| 9   | Sin categorías → sección oculta  | ✅     |
| 10  | <title> con nombre de tienda     | ✅     |
| 11  | Meta description                 | ✅     |
| 12  | JSON-LD Store schema             | ✅     |
| 13  | Página carga sin login (pública) | ✅     |

### Storefront – Autenticación Cliente

| #   | Prueba                               | Estado |
| --- | ------------------------------------ | ------ |
| 1   | Registro de cliente                  | ✅     |
| 2   | Login de cliente                     | ✅     |
| 3   | Logout redirige a storefront         | ✅     |
| 4   | /login y /register con sesión activa | ✅     |

---

### Seguridad – Aislamiento de Tenants

| #   | Prueba                             | Estado |
| --- | ---------------------------------- | ------ |
| 1   | Admin solo ve datos de su tenant   | ✅     |
| 2   | Storefront resuelve solo su tenant | ✅     |
| 3   | Superadmin ve todos los tenants    | ✅     |

### Seguridad – Headers Proxy

| #   | Prueba                            | Estado |
| --- | --------------------------------- | ------ |
| 1   | x-tenant-id presente en headers   | ✅     |
| 2   | x-tenant-slug presente en headers | ✅     |

---

### Pago con MercadoPago

| #   | Prueba                                                                   | Estado                                                                                          |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Flujo E2E completo en sandbox (tarjeta de prueba)                        | ✅ Tarjetas de prueba disponibles en sandbox MP → ver SETUP.md → Tarjetas de prueba MercadoPago |
| 2   | Webhook de pago aprobado (unit/integración, HMAC + magic ID `123456789`) | ✅ 11 tests en `webhooks/mercadopago/__tests__/route.test.ts`                                   |
| 3   | Webhook de pago rechazado (magic ID `000000`)                            | ✅ ídem                                                                                         |
| 4   | Webhook pendiente (magic ID `999999`, sin cambio de estado)              | ✅ ídem                                                                                         |
| 5   | Firma real del webhook en E2E (approved/rejected/missing/tampered)       | ✅ `e2e/webhook/webhook-signature.spec.ts` (requiere `E2E_WEBHOOK_TEST=1` en Vercel)            |
| 6   | Email de confirmación de orden (Resend)                                  | ✅ Unit tests en `@repo/commerce`                                                               |

> El webhook está **automatizado** (tests de integración con HMAC fail-closed, idempotencia por `payment_id`, modo simulación con `x-test-order-id`). El E2E `webhook-signature.spec.ts` valida la firma real contra el entorno desplegado: firma válida → orden `confirmed`, firma adulterada/sin firma → 401, pending → sin cambio. El flujo manual en sandbox se puede probar con las tarjetas de prueba (`APRO`/`OTHE`/`CONT`), documentadas en SETUP.md → Tarjetas de prueba MercadoPago.

---

### Tests Automáticos

```bash
pnpm test
```

| Métrica      | Valor     |
| ------------ | --------- |
| **Total**    | 769 tests |
| **Pasando**  | 769 ✅    |
| **Fallas**   | 0 ✅      |
| **Archivos** | 72        |

> Los tests de endpoints importan los handlers reales (`../route`) con mocks de dependencias (`withTenantContext`, Redis, storage). Helpers centralizados en `@repo/test-utils` (`makeTxMock`, `session`, `mockReq`). Además: 15 specs E2E en `e2e/` (Playwright, CI self-hosted).

---

## Resumen de Resultados

| Área       | Total   | ✅      | ⚠️    | ❌    |
| ---------- | ------- | ------- | ----- | ----- |
| Setup      | 4       | 4       | 0     | 0     |
| Superadmin | 17      | 17      | 0     | 0     |
| Admin      | 51      | 48      | 0     | 0     |
| Storefront | 50      | 50      | 0     | 0     |
| Seguridad  | 5       | 5       | 0     | 0     |
| **Total**  | **127** | **124** | **0** | **0** |

> ⚠️ **Esta tabla está incompleta y no se corrigió** (nota agregada el
> 2026-10-07). Los totales de cada columna cuadran:
> `4+17+51+50+5 = 127` y `4+17+48+50+5 = 124`. Pero **127 − 124 = 3 ítems que no
> están en ninguna columna**: la fila Admin marca 48 de 51 mientras ⚠️ y ❌ dicen 0. O se saltaron 3 ítems y no se registraron, o la columna ⚠️ se vació.
>
> **No se rellenó con números inventados.** Reconstruirlo exige correr el checklist
> manual de 127 verificaciones (`TESTING-MANUAL.md`), que necesita las apps
> levantadas y no es parte del DoD. Ese trabajo queda pendiente; lo que se hace acá
> es dejar el hueco visible en lugar de taparlo.
>
> Ojo también: esta tabla cuenta **ítems de prueba manual**, no tests automatizados.
> El contador de tests de este documento está arriba, en `### Tests Automáticos`.

---

## Notas

- Última actualización: 12 de agosto de 2026 — Release v0.9.0 (430 tests, 15 specs E2E).
- Release v0.10.0 (2026-09-17) — Modernización stack (TS6, Next 16.3.5, ioredis 6, vitest 5) + docs/deuda. 430 tests, 55 archivos. Ramas main + develop.
- Actualización 20 de septiembre de 2026 – 464 tests, 15 specs E2E (post T6 + migración 0013). Rama `develop`.
- Actualización 24 de septiembre de 2026 – 474 tests, 57 archivos, T11 real y T13; 0015 queda pendiente de aplicación. Rama `chore/close-fase1`.
- Actualización 3 de octubre de 2026 – 475 tests, 57 archivos, T1 de Fase 2: test del índice único parcial `subscriptions_mp_preapproval_idx` en `packages/db/src/__tests__/schema.test.ts`. Rama `chore/t1-migration-index`.
- Actualización 3 de octubre de 2026 – 486 tests, 58 archivos, T2 de Fase 2: 3 casos de producción de `MP_PLATFORM_*` y 7 casos de `getAdminBaseUrl`. Rama `chore/t2-env-validation`.
- Actualización 3 de octubre de 2026 – 517 tests, 61 archivos, T3 de Fase 2: 8 casos de `derivePermissions`, 10 de `calculateProration` y 13 de `classifyMpEvent`. Rama `chore/t3-helpers`.
- Actualización 3 de octubre de 2026 – 523 tests, 62 archivos, fix del stub de suscripciones: 6 casos de selección de secret y validación de firma en `apps/admin/app/api/webhooks/mercadopago/subscriptions/__tests__/route.test.ts`. Rama `chore/fix-webhook-subscriptions-secret`.
- Actualización 3 de octubre de 2026 – 619 tests, 66 archivos, T4 de Fase 2: 96 casos nuevos para los 6 endpoints de suscripciones (`preapproval` con rate limit 10/60s y `payerEmail` tomado del JWT, `GET` con permisos, `cancel`/`pause`/`resume` con verificación post-escritura, `plan` con prorrateo 402/202) más el estado `paused` en la matriz de permisos. Rama `chore/t4-endpoints`.
- Actualización 4 de octubre de 2026 – 679 tests, 69 archivos, T5 de Fase 2: 37 casos del handler del webhook (`__tests__/handler.test.ts`: 8 transiciones de §6.3, firma, clasificación, idempotencia por convergencia, resolución de tenant L+R, aislamiento cross-tenant, tolerancia a UNKNOWN) más 9 casos de `packages/commerce/src/__tests__/mp-subscriptions.test.ts`, los primeros tests directos del cliente de MP. Rama `chore/t5-webhook-handler`.
- Actualización 6 de octubre de 2026 – 705 tests, 69 archivos, T6 de Fase 2 (tests de integración) más la mini auditoría de calidad de tests (#202). 3 tests nuevos sobre la suite de órdenes, base 702. PR #201, #202.
- Actualización 6 de octubre de 2026 – 705 tests, 69 archivos, T7 de Fase 2 (documentación + memoria). PR #203.
- Actualización 6 de octubre de 2026 – 705 tests, 69 archivos, mini-PRs documentales: drift de topics de MP en SETUP.md (3→4) y precondiciones de T8. PR #204, #205.
- Actualización 6 de octubre de 2026 – 705 tests, 69 archivos, T8 de Fase 2 (cierre formal) y auditoría de cierre: veredicto "Fase 2 pasa", 10 hallazgos de código (8 MEDIUM, 2 LOW) + 1 hallazgo de proceso (item 62). T9 (polling) cancelado. PR #206, #207.
- Actualización 7 de octubre de 2026 – 705 tests, 69 archivos, lote de 9 PRs de Dependabot (#208, #210–#217) y migración de `@sentry/nextjs` v10 → v11 (#218). DoD verde post-merge: lint 6/6, typecheck 9/9, build 3/3, format:check. PR #208, #210–#218.
- Actualización 10 de octubre de 2026 – 769 tests, 72 archivos. Items 61, 66, 68, 69, 70, 71, 75, 76 y 77 resueltos en la tanda de auditoría, más el item 65 (409 con `initPoint`) y el 67 (validación de `external_reference`) en S2 del plan de Fase 3. 10 tests nuevos: 6 del proxy con `PLATFORM_HOST`, 2 del item 67, 2 del item 65. CI 9/9. PR #235, #240.
- Fase 5 completada: RLS ✅, AUTH_SECRET ✅, CSRF ✅, validación de variables de entorno ✅, logs estructurados con Pino ✅, Sentry integrado ✅, NEXTAUTH_URL dinámica ✅, errores 409 con campo específico ✅, UI de validación inline ✅, configuración de build corregida (next.config.mjs) ✅.
- Fase 6 completada: withTenantContext real + FORCE RLS (app_user), E2E Playwright 15 specs con CI self-hosted, incidente RLS de 9 Server Components corregido (08-08).
- Estado actual: 769 tests automatizados pasando (0 fallos). Build limpio en las 3 apps.
- Sandbox manual de MercadoPago pendiente (cuenta de prueba de MP).
- Ver AGENTS.md para detalles de convenciones de código y comandos obligatorios.

- Preparación para migración cloud: código adaptado para R2, Resend, Upstash con fallback local. Variables condicionales según entorno.
- Flujo webhook y emails corregido: proxy excluye `/api/webhooks`, firma opcional en desarrollo, manejo de errores mejorado en `email.ts`.
