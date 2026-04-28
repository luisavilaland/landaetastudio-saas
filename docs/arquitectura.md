# Decisiones de arquitectura – saas-ecommerce

## ¿Por qué multi-tenant con columna tenantId?

Usamos una única base de datos compartida con columna `tenantId` en todas las tablas de negocio. Esto simplifica la gestión de datos y las migraciones, y nos permite aislar a cada comercio mediante Row Level Security cuando pasemos a producción. La alternativa de bases de datos separadas por tenant añadiría complejidad operativa innecesaria para un MVP.

## ¿Por qué NextAuth con JWT en lugar de sesiones de base de datos?

Las sesiones de BD generan una consulta extra en cada petición. Con JWT, el token viaja en la cookie y contiene los claims necesarios (`tenantId`, `role`), lo que evita accesos constantes a la base de datos y simplifica la resolución multi-tenant en el middleware.

## ¿Por qué precios en centavos (integer)?

Eliminamos los errores de redondeo propios de floats. Es una práctica estándar en eCommerce. El frontend divide entre 100 solo para mostrar el precio formateado.

## ¿Por qué MinIO local y MercadoPago?

MinIO emula la API de S3, lo que nos permite probar subida de imágenes sin salir de localhost. MercadoPago es el gateway de pago más extendido en Uruguay y Argentina, y ofrece excelente sandbox para desarrollo.

## ¿Por qué Redis para el carrito y no PostgreSQL?

El carrito requiere lecturas/escrituras muy frecuentes y un TTL automático para limpiar sesiones abandonadas. Redis ofrece latencia sub-milisegundo para operaciones clave-valor y expiración automática a los 7 días sin carga para PostgreSQL. Esto nos permite mantener la base de datos principal dedicada a datos transaccionales.

## ¿Por qué no se usó MedusaJS?

El blueprint original consideraba usar MedusaJS como librería de dominio. Durante la implementación, el equipo decidió que la lógica de carrito, órdenes y precios era lo suficientemente simple y específica como para no justificar una dependencia externa adicional. Se optó por implementarla directamente en TypeScript dentro de `packages/commerce` (por crear), manteniendo el control total y evitando el acoplamiento a un framework de eCommerce.

## Estructura de monorepo

Separamos las apps en `storefront`, `admin` y `superadmin` porque cada una tiene su propio dominio de negocio y políticas de seguridad. Los paquetes compartidos (`db`, `storage` y proximamente `commerce`) evitan duplicar lógica de acceso a datos o reglas de negocio.

## ¿Por qué validación con Zod en toda la API?

Elegimos Zod para validar todos los endpoints porque ofrece tipos TypeScript automáticos, errores estructurados y consistencia en toda la API. Los schemas se definen en `@repo/validation` y se reutilizan en múltiples endpoints.

## ¿Por qué búsqueda server-side con ILIKE?

Para la Fase 3, optamos por ILIKE en PostgreSQL en lugar de un motor de búsqueda externo (como Meilisearch o Algolia). Esto simplifica la arquitectura, no añade dependencias adicionales y es suficiente para el MVP con un catálogo pequeño/medio.

## ¿Por qué variantes con JSONB?

Las variantes usan un campo JSONB (`options`) para almacenar combinaciones de atributos (talle, color, etc.) sin necesidad de tablas adicionales para atributos. Esto ofrece flexibilidad total: cada producto puede tener diferentes atributos sin cambiar el schema.

## ¿Por qué imágenes múltiples con tabla product_images?

La tabla `product_images` permite múltiples imágenes por producto, con soporte para galería, ordenamiento por `position` y eliminación individual. Usa MinIO (S3-compatible) para almacenamiento.

## Convenciones clave

- **Nombres en camelCase** para columnas y tablas en Drizzle, porque es el idioma que habla TypeScript. Drizzle maneja la traducción a snake_case en la BD si fuera necesario, pero mantenemos consistencia con el código.
- **Migraciones inmutables**: una vez generadas, no se editan. Esto garantiza historial limpio y cero conflictos en equipo.
- **Carrito anónimo en Redis**: permite a los clientes usar el carrito sin crear cuenta. La sesión expira a los 7 días; el TTL de Redis se encarga automáticamente de la limpieza.
- **Validación Zod**: toda la API usa schemas de `@repo/validation` para validar inputs (create, update, delete).
- **Búsqueda**: se implementa con ILIKE en PostgreSQL, sin dependencias externas en esta fase.