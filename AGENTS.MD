# AGENTS.md – saas-ecommerce

## Arquitectura y restricciones innegociables

- **Multi-tenant por columna**: toda tabla de negocio tiene `tenantId`. Nunca hagas queries sin filtrar por tenant, salvo en superadmin.
- **Precios siempre en centavos (integer)**: dividir entre 100 solo para mostrar. El backend recibe y trabaja con integers.
- **Fechas en UTC**: timestamps en BD siempre en UTC. Mostrar en zona local solo en frontend.
- **Migraciones de DB inmutables**: ante un cambio de schema, genera una nueva migración con `pnpm db:generate`. Jamás modifiques migraciones existentes.
- **Slug de producto**: regenerar SKU de variante si cambia el slug; asegurar sluggificación consistente en create/edit.
- **Auth**: NextAuth v5 con JWT, `tenantId` en claims. No uses middleware que dependa de `getServerSession` en runtime; usa el token.
- **Carrito anónimo**: cookie `cart_session_id` + Redis; 7 días TTL. Sin autenticación requerida.
- **Imágenes**: usar `@repo/storage` (MinIO local / R2 en prod). Siempre subir con FormData y obtener URL pública.
- **Webhook MercadoPago**: idempotencia con `payment_id` para evitar duplicados.
- **RLS (Row Level Security)**: activado en todas las tablas de negocio. Toda query debe ejecutarse dentro de un contexto `withTenantContext(tenantId)` que establece `app.tenant_id` para PostgreSQL.
- **AUTH_SECRET obligatorio**: sin fallback hardcoded. La app no arranca si la variable no está configurada.
- **CSRF protection**: manejado automáticamente por NextAuth v5 en producción. No se debe desactivar explícitamente en `next.config.ts`.
- **Validación de variables de entorno**: Zod valida todas las variables críticas al iniciar la app (`packages/validation/src/env.ts`). Si falta alguna en producción, la app falla inmediatamente con un error claro.

## Comandos obligatorios (Definition of Done)

Antes de considerar cualquier tarea como finalizada, el código debe ejecutar sin errores:

```bash
pnpm lint        # eslint + prettier
pnpm typecheck   # tsc --noEmit en todas las apps y paquetes
pnpm build       # next build en las tres apps
pnpm test        # vitest (todos los tests existentes)
```

Si alguno de estos scripts no existe en la raíz, créalo en package.json con turbo run <script> y verifica que cada app/package tenga definido el script correspondiente:

- lint: `eslint .` (o el que corresponda)
- typecheck: `tsc --noEmit`
- build: `next build`
- test: `vitest run`

⚠️ IMPORTANTE: ignoreBuildErrors DEBE ser false en next.config.ts. El build debe fallar si hay errores de tipo. Esto es crítico para detectar regresiones en CI/CD. Nunca usar `ignoreBuildErrors: true`.

**Ubicación de los tests:**
- Lógica de negocio: coloca el test en una carpeta `__tests__/` junto al módulo (ej. `packages/commerce/src/__tests__/cart.test.ts`).
- Endpoints: `__tests__/` junto al archivo de ruta (ej. `apps/admin/app/api/products/__tests__/route.test.ts`).
- Componentes: `__tests__/` junto al componente.
- Tests end-to-end (opcional): en `e2e/` en la raíz.

Si la tarea involucra migraciones: ejecutar pnpm db:generate y pnpm db:migrate y verificar que el seed pnpm db:seed no falle.

Si la tarea es un endpoint nuevo: agregar test de integración con los casos de éxito, error 401/403, y validación de tenant.

Si la tarea incluye lógica de negocio nueva, se debe incluir al menos un test unitario o de integración.

⚠️ **Validación de entorno**: verificá que las variables de entorno necesarias estén configuradas según el entorno (desarrollo o producción). En producción, la app no arrancará si falta alguna variable crítica (`packages/validation/src/env.ts`).

**Prioridad única (conflicto de diseño)**
Si hay que elegir entre rendimiento y legibilidad, gana la legibilidad (código explícito). Pero si la legibilidad se usa para justificar una consulta N+1, gana el rendimiento: usa joins o carga eager.

El código debe ser autodocumentado; comentarios solo para el "por qué", no el "qué".

## Convenciones de código y linter automático

- Nombres de tabla y columna en camelCase (Drizzle). No snake_case.
- Variables de entorno: cargadas con dotenv en development. En producción, inyectarlas sin fallback visible. No hardcodear valores como NEXTAUTH_URL.
- Rutas API: todas bajo app/api/, no uses pages router.
- Componentes de React: funciones nombradas, preferir Server Components salvo interactividad.
- Responses HTTP: usar `NextResponse` (nunca `new Response()` nativa). El helper `jsonResponse` es aceptable si envuelve `NextResponse.json`.
- **Logs**: usar el logger de `@repo/logger` en lugar de `console.log`. Crear instancias con `createLogger('nombre-modulo')`. En desarrollo se formatea con `pino-pretty`; en producción usa JSON estándar. Incluir contexto relevante (tenantId, userId, requestId) cuando esté disponible.

**Reglas automáticas (asegúrate de que ESLint y Prettier las cubran; si no, añádelas:**

- import/order
- @typescript-eslint/no-unused-vars
- react-hooks/rules-of-hooks

## Cómo probar flujos multi-tenant y webhook

- Subdominios locales: tenant1.lvh.me:3000. Para probar resolución de tenant, lanza el servidor con pnpm dev y usa ese host.
- Webhook simulado: POST /api/webhooks/mercadopago con header x-test-order-id=<orderId> y body {"type":"payment","data":{"id":"123456789"}} (approved) o "000000" (rejected).
- Seed de datos: pnpm db:seed resetea la BD con datos de prueba.
- Pruebas manuales: ejecutar `TESTING-MANUAL.md` con 92 ítems organizados en 5 áreas (Superadmin, Admin, Storefront, Seguridad, Tests automáticos).

## Herramientas de desarrollo (uso por el agente)

- pnpm para gestión de dependencias y monorepo.
- Turborepo: correr turbo run lint typecheck build para validación global.
- Docker: solo levantar servicios con docker-compose up -d. El agente no debe modificar la configuración de contenedores.
- **Git**: no ejecutes comandos git (commit, push, merge, rebase) a menos que el usuario los solicite explícitamente. Puedes mostrar los cambios sugeridos para que el usuario decida.

## Estructura mínima de referencia

- Lógica de negocio centralizada en `packages/commerce` (carrito, productos, emails, tenant, Redis).
- Cada app (storefront, admin, superadmin) solo expone UI y endpoints, la lógica pesada en paquetes.
- Paquetes actuales: `@repo/db`, `@repo/storage`, `@repo/auth`, `@repo/validation`, `@repo/commerce` – Validación Zod compartida para toda la API.
- `normalizeSlug` está centralizado en `@repo/validation/src/utils.ts` para asegurar consistencia en slugs de productos y categorías.

## Mantenimiento de la documentación

- **AGENTS.md:** si durante una tarea descubres que una restricción, comando o convención importante no está documentada aquí, proponme añadirla al finalizar la tarea. Si es evidente (ej. se ha creado un script `pnpm storybook`), puedes actualizar este archivo directamente y notificármelo.
- **README.md y SETUP.md:** si la tarea implica cambios que afectan al setup inicial, endpoints, usuarios de prueba, o cualquier información visible para desarrolladores humanos, sugiéreme los cambios necesarios. No los apliques sin mi confirmación.
- **docs/arquitectura.md:** si la tarea introduce o modifica una decisión de arquitectura (nuevo servicio, cambio en la estrategia de datos, remplazo de una herramienta), sugiere actualizar este documento. No lo modifiques sin confirmación.
- **.gitignore:** mantenlo actualizado sin preguntar si generas archivos temporales, artefactos de build o dependencias que no deban comitearse (ej. `.turbo`, `coverage/`, `test-results/`). Si tienes dudas, consulta.
