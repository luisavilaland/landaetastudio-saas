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

Si la tarea involucra migraciones: ejecutar pnpm db:generate y pnpm db:migrate y verificar que el seed pnpm db:seed no falle.

Si la tarea es un endpoint nuevo: agregar test de integración con los casos de éxito, error 401/403, y validación de tenant.

Si la tarea incluye lógica de negocio nueva, se debe incluir al menos un test unitario o de integración.

**Prioridad única (conflicto de diseño)**
Si hay que elegir entre rendimiento y legibilidad, gana la legibilidad (código explícito). Pero si la legibilidad se usa para justificar una consulta N+1, gana el rendimiento: usa joins o carga eager.

El código debe ser autodocumentado; comentarios solo para el "por qué", no el "qué".

## Convenciones de código y linter automático

- Nombres de tabla y columna en camelCase (Drizzle). No snake_case.
- Variables de entorno: cargadas con dotenv en development. En producción, inyectarlas sin fallback visible. No hardcodear valores como NEXTAUTH_URL.
- Rutas API: todas bajo app/api/, no uses pages router.
- Componentes de React: funciones nombradas, preferir Server Components salvo interactividad.

**Reglas automáticas (asegúrate de que ESLint y Prettier las cubran; si no, añádelas):**

- import/order
- @typescript-eslint/no-unused-vars
- react-hooks/rules-of-hooks

## Cómo probar flujos multi-tenant y webhook

- Subdominios locales: tenant1.lvh.me:3000. Para probar resolución de tenant, lanza el servidor con pnpm dev y usa ese host.
- Webhook simulado: POST /api/webhooks/mercadopago con header x-test-order-id=<orderId> y body {"type":"payment","data":{"id":"123456789"}} (approved) o "000000" (rejected).
- Seed de datos: pnpm db:seed resetea la BD con datos de prueba.

## Herramientas de desarrollo (uso por el agente)

- pnpm para gestión de dependencias y monorepo.
- Turborepo: correr turbo run lint typecheck build para validación global.
- Docker: solo levantar servicios con docker-compose up -d. El agente no debe modificar la configuración de contenedores.
- **Git**: no ejecutes comandos git (commit, push, merge, rebase) a menos que el usuario los solicite explícitamente. Puedes mostrar los cambios sugeridos para que el usuario decida.

## Estructura mínima de referencia

- Lógica de negocio actual en apps/storefront/lib y apps/admin/lib.
- Plan de migración: cuando se cree packages/commerce (Fase 5), la lógica de carrito, órdenes, precios y descuentos se moverá progresivamente a ese paquete. Mientras tanto, mantenla en las libs de cada app, pero no dupliques lógica entre storefront y admin.
- Cada app (storefront, admin, superadmin) solo expone UI y endpoints, la lógica pesa en paquetes.