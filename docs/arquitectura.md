# Decisiones de arquitectura – saas-ecommerce

## ¿Por qué multi-tenant con columna tenantId?

Usamos una única base de datos compartida con columna `tenantId` en todas las tablas de negocio. Esto simplifica la gestión de datos y las migraciones, y nos permite aislar a cada comercio mediante Row Level Security cuando pasemos a producción. La alternativa de bases de datos separadas por tenant añadiría complejidad operativa innecesaria para un MVP.

## ¿Por qué NextAuth con JWT en lugar de sesiones de base de datos?

Las sesiones de BD generan una consulta extra en cada petición. Con JWT, el token viaja en la cookie y contiene los claims necesarios (`tenantId`, `role`), lo que evita accesos constantes a la base de datos y simplifica la resolución multi-tenant en el middleware.

## ¿Por qué precios en centavos (integer)?

Eliminamos los errores de redondeo propios de floats. Es una práctica estándar en eCommerce. El frontend divide entre 100 solo para mostrar el precio formateado.

## ¿Por qué R2 (Cloudflare) y MercadoPago?

Usamos Cloudflare R2 como storage de imágenes (S3-compatible). En desarrollo se puede usar MinIO local como alternativa. MercadoPago es el gateway de pago más extendido en Uruguay y Argentina.

## ¿Por qué Redis para el carrito y no PostgreSQL?

El carrito requiere lecturas/escrituras muy frecuentes y un TTL automático para limpiar sesiones abandonadas. Redis ofrece latencia sub-milisegundo para operaciones clave-valor y expiración automática a los 7 días sin carga para PostgreSQL. Esto nos permite mantener la base de datos principal dedicada a datos transaccionales.

## ¿Por qué no se usó MedusaJS?

El blueprint original consideraba usar MedusaJS como librería de dominio. Durante la implementación, el equipo decidió que la lógica de carrito, órdenes y precios era lo suficientemente simple y específica como para no justificar una dependencia externa adicional. Se optó por implementarla directamente en TypeScript dentro de `packages/commerce` (por crear), manteniendo el control total y evitando el acoplamiento a un framework de eCommerce.

## Estructura de monorepo

Separamos las apps en `storefront`, `admin` y `superadmin` porque cada una tiene su propio dominio de negocio y políticas de seguridad. Los paquetes compartidos (`db`, `storage`, `auth`, `validation` y `commerce`) evitan duplicar lógica de acceso a datos o reglas de negocio.

## ¿Por qué validación con Zod en toda la API?

Elegimos Zod para validar todos los endpoints porque ofrece tipos TypeScript automáticos, errores estructurados y consistencia en toda la API. Los schemas se definen en `@repo/validation` y se reutilizan en múltiples endpoints.

## ¿Por qué búsqueda server-side con ILIKE?

Para la Fase 3, optamos por ILIKE en PostgreSQL en lugar de un motor de búsqueda externo (como Meilisearch o Algolia). Esto simplifica la arquitectura, no añade dependencias adicionales y es suficiente para el MVP con un catálogo pequeño/medio.

## ¿Por qué variantes con JSONB?

Las variantes usan un campo JSONB (`options`) para almacenar combinaciones de atributos (talle, color, etc.) sin necesidad de tablas adicionales para atributos. Esto ofrece flexibilidad total: cada producto puede tener diferentes atributos sin cambiar el schema.

## ¿Por qué imágenes múltiples con tabla product_images?

La tabla `product_images` permite múltiples imágenes por producto, con soporte para galería, ordenamiento por `position` y eliminación individual. Usa MinIO (S3-compatible) para almacenamiento.

## ¿Por qué métodos de envío configurables por tenant?

Implementamos los métodos de envío como una tabla independiente (`shipping_methods`) vinculada a `tenantId`. Esto permite que cada comercio configure sus propias opciones (envío estándar, express, retiro en tienda) con precios y descripciones personalizadas. La validación de Zod en `@repo/validation` asegura consistencia en la API.

## ¿Por qué configuración visual del tenant en JSON?

La configuración visual (logo, colores, fuente, redes sociales) se almacena en una tabla `store_settings` vinculada al tenant. Usamos campos específicos para logo, colores (primary, secondary, accent) y redes sociales (JSONB para flexibilidad). Esto evita tener que modificar el schema para agregar nuevas redes sociales o campos de configuración.

## ¿Por qué página de perfil de tienda pública?

La página `/perfil` es un Server Component que expone la información del tenant (nombre, logo, descripción, contacto, categorías) con metadatos SEO (JSON-LD). Esto mejora el SEO y permite que cada comercio tenga una presencia pública única. El proxy multi-tenant resuelve el tenant automáticamente por subdominio o dominio personalizado.

## ¿Por qué dominio personalizado con verificación?

Permitimos que cada tenant configure un dominio personalizado (ej. `tienda.com`) guardado en el campo `customDomain`. La verificación se hace vía API pública (`/api/domain-check`) y el proxy (`proxy.ts`) resuelve el tenant tanto por subdominio como por dominio personalizado. Esto ofrece flexibilidad total para comercios que ya tienen su propio dominio.

## ¿Por qué `NextResponse` en lugar de `new Response()` nativa?

Todas las rutas API usan `NextResponse` de Next.js en lugar de la API `new Response()` nativa del navegador. `NextResponse` integra manejo de cookies, headers específicos de Next.js (como `revalidatePath`), y es la forma recomendada por el framework. Se eliminaron todos los helpers `jsonResponse` con `JSON_HEADERS` manual y se unificó todo con la API de Next.js. El helper local `jsonResponse` es aceptable si simplemente envuelve `NextResponse.json()` para evitar repetición de código.

## ¿Por qué tests de "lógica pura" para endpoints?

Los tests de endpoints que importan directamente rutas de Next.js (`import { GET } from "../route"`) fallan con `next-auth@5.0.0-beta.31` porque el beta importa `next/server` sin la extensión `.js`, lo que vitest no resuelve. La solución fue reescribir los tests con patrón de "lógica pura": en lugar de importar la ruta, mockean las dependencias (`@repo/db`, `next/headers`, `drizzle-orm`) y verifican el comportamiento esperado. Esto elimina la incompatibilidad sin cambiar de test runner. Los tests de shipping (25) y categorías usan este patrón.

## Convenciones clave

- **Nombres en camelCase** para columnas y tablas en Drizzle, porque es el idioma que habla TypeScript. Drizzle maneja la traducción a snake_case en la BD si fuera necesario, pero mantenemos consistencia con el código.
- **Migraciones inmutables**: una vez generadas, no se editan. Esto garantiza historial limpio y cero conflictos en equipo.
- **Carrito anónimo en Redis**: permite a los clientes usar el carrito sin crear cuenta. La sesión expira a los 7 días; el TTL de Redis se encarga automáticamente de la limpieza.
- **Validación Zod**: toda la API usa schemas de `@repo/validation` para validar inputs (create, update, delete).
- **Búsqueda**: se implementa con ILIKE en PostgreSQL, sin dependencias externas en esta fase.

## ¿Por qué se consolidó NextAuth en @repo/auth?

Durante la Fase 4, detectamos que la configuración de NextAuth v5 estaba duplicada en `apps/admin/lib/auth.ts` y `apps/superadmin/lib/auth.ts`. Ambas configuraciones solo diferían en el rol validado (`"admin"` vs `"superadmin"`). Se consolidó en `@repo/auth` creando funciones `createAdminAuth()` y `createSuperadminAuth()` que centralizan la lógica, mientras que las apps ahora reexportan desde el paquete. Esto elimina la duplicación y facilita el mantenimiento.

## ¿Por qué la lógica de negocio se centralizó en @repo/commerce?

Originalmente la lógica de carrito, productos, emails y resolución de tenant estaba en `apps/storefront/lib/`. Esto representaba una deuda técnica ya que no había una ubicación clara para nueva lógica compartida. Se creó `packages/commerce` como parte de la preparación para la Fase 5, moviendo toda la lógica de negocio de storefront hacia este paquete centralizado. Las apps ahora reexportan desde `@repo/commerce`, eliminando la duplicación y preparando el proyecto para escalar.

## ¿Por qué se normalizan los slugs?

Se implementó la función `normalizeSlug()` en `@repo/validation/src/utils.ts` para asegurar que todos los slugs de productos y categorías sigan un formato consistente: minúsculas, sin acentos, espacios reemplazados por guiones, y limpieza de guiones duplicados o en extremos. Esto se aplica tanto en creación como en edición (regenerando el SKU de variantes si cambia el slug). La centralización en `@repo/validation` garantiza que toda la API use el mismo criterio de normalización.