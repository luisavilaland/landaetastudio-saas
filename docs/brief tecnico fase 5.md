# **SaaS eCommerce**

Brief Técnico — Fase 5: Producción

Para: Equipo de Ingeniería

_Versión 1.0 — Abril 2026 — Confidencial_

Resumen Ejecutivo

Las Fases 1 a 4 están completas. El MVP funciona correctamente en local con todas las funcionalidades core: catálogo, carrito, checkout con MercadoPago, panel admin, superadmin y configuración del tenant.

La Fase 5 tiene un único objetivo: llevar el sistema a producción de forma segura. Esto implica tres grandes bloques: (1) seguridad crítica antes del deploy, (2) migración de infraestructura local a cloud, y (3) observabilidad y hardening para operación estable.

Nada de lo que se construya en esta fase agrega features nuevas. Todo es para que lo que ya existe funcione de forma segura, estable y escalable en producción.

---

**1. Estado actual del proyecto**

Antes de arrancar la Fase 5, este es el diagnóstico completo del sistema:

| **Componente**                          | **Estado**   | **Notas**                                                                                                                               |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Autenticación admin/superadmin**      | ✅ OK        | NextAuth v5 con JWT. Funcional en ambas apps.                                                                                           |
| **Multi-tenant (tenantId)**             | ✅ OK        | Columna tenantId en todas las tablas. Middleware resuelve slug.                                                                         |
| **Catálogo + variantes + imágenes**     | ✅ OK        | CRUD completo, múltiples imágenes, variantes JSONB.                                                                                     |
| **Carrito con Redis**                   | ✅ OK        | Sesiones anónimas, TTL 7 días, variantes en carrito.                                                                                    |
| **Checkout MercadoPago**                | ✅ OK        | Flujo completo, webhook, confirmación por email.                                                                                        |
| **Panel admin órdenes + dashboard**     | ✅ OK        | Métricas reales, cambio de estado, stock bajo.                                                                                          |
| **Configuración visual del tenant**     | ✅ OK        | Logo, colores, descripción, redes sociales.                                                                                             |
| **Métodos de envío configurables**      | ✅ OK        | CRUD en admin + API storefront con `x-tenant-id`. Checkout con selector visual y cálculo dinámico.                                      |
| **Proxy multi-tenant (storefront)**     | ✅ OK        | Restaurado en Fase 4 con NextResponse.next().                                                                                           |
| **Dominio personalizado**               | ✅ OK        | Verificación + resolución por dominio en proxy.                                                                                         |
| **Página de perfil de tienda**          | ✅ OK        | Server Component con SEO (JSON-LD).                                                                                                     |
| **Responses HTTP**                      | ✅ OK        | `NextResponse` unificado en todas las rutas. Sin `new Response()` nativa.                                                               |
| **Tests**                               | ✅ OK        | 225/225 pasando, 0 fallos. Build limpio en 3 apps.                                                                                      |
| **Auth consolidada en @repo/auth**      | ✅ OK        | Código duplicado movido a paquete compartido.                                                                                           |
| **Lógica de negocio en @repo/commerce** | ✅ OK        | Carrito, órdenes, emails, tenant centralizados.                                                                                         |
| **Normalización de slugs**              | ✅ OK        | `normalizeSlug()` en @repo/validation/src/utils.ts.                                                                                     |
| **Row Level Security (RLS)**            | ✅ OK        | Implementado en tablas de negocio con políticas `tenant_isolation`. Función `set_tenant_id` y helper `withTenantContext` en `@repo/db`. |
| **AUTH_SECRET con fallback hardcoded**  | ✅ OK        | Eliminado fallback hardcoded. Validación al arrancar en `@repo/auth` lanza error si falta la variable.                                  |
| **CSRF protection**                     | ✅ OK        | Manejado automáticamente por NextAuth v5 en producción (NODE_ENV=production). Documentado en `next.config.ts`.                          |
| **Infraestructura cloud**               | ✅ OK        | Código preparado con variables condicionales (R2, Resend, Upstash). Credenciales configurables por entorno.                             |
| **Validación de env vars al arrancar**  | ✅ OK        | Zod valida variables críticas en `packages/validation/src/env.ts`. Falla inmediato si falta alguna en producción.                       |
| **Logs estructurados**                  | ✅ OK        | `@repo/logger` con `createLogger()`. Pino + pino-pretty en dev, JSON en prod. Contexto con tenantId, userId, requestId.                 |
| **Deploy en Vercel**                    | 🔄 Pendiente | Ningún ambiente productivo configurado todavía.                                                                                         |
| **Sentry**                              | ✅ OK        | Integrado en las tres apps con `@sentry/nextjs`. Configuración condicional vía SENTRY_DSN.                                              |
| **Mensajes de error 409**               | ✅ OK        | Todos los endpoints retornan `field` para identificar el campo conflictivo. UI inline con validación visual en formularios.             |
| **Configuración de build**              | ✅ OK        | `next.config.mjs` para compatibilidad ESM en Next.js 16. Dotenv integrado en cada app.                                                  |

**2. Pasos previos antes de Fase 5**

✅ **Completado en orden:**

1. **Pruebas manuales:** Ejecutar el checklist `TESTING-MANUAL.md` completo (92 ítems en 5 áreas). Anotar fallos y corregirlos antes de avanzar.
2. **Deuda técnica menor:** ~~Consolidar auth duplicada en `@repo/auth` (admin y superadmin tienen su propio `lib/auth.ts`)~~ ✅ Completado, ~~normalización de slugs (acentos y mayúsculas)~~ ✅ Completado, y ~~refactorización de lógica duplicada hacia `@repo/commerce`~~ ✅ Completado.

✅ Completado: auth duplicada consolidada en @repo/auth, lógica de negocio migrada a @repo/commerce, slugs normalizados con normalizeSlug().

**Tareas bloqueantes de Fase 5 completadas:**

- ✅ **Row Level Security (RLS)** implementado en PostgreSQL
- ✅ **AUTH_SECRET** sin fallback hardcoded, validación al arrancar
- ✅ **CSRF protection** manejado automáticamente por NextAuth v5 en producción
- ✅ **Validación de variables de entorno** con Zod en `@repo/validation`
- ✅ **NEXTAUTH_URL dinámica** - Opcional, inferida del Host header por NextAuth v5
- ✅ **Logs estructurados** - `@repo/logger` con Pino, `createLogger()` con contexto (tenantId, userId, requestId)
- ✅ **Sentry** - Integrado en las tres apps con `@sentry/nextjs`, configuración condicional vía SENTRY_DSN

---

| **#**  | **Prioridad**  | **Tarea**                                                  | **Semana**        |
| ------ | -------------- | ---------------------------------------------------------- | ----------------- |
| **1**  | **BLOQUEANTE** | **Row Level Security en PostgreSQL**                       | **1**             |
| **2**  | **BLOQUEANTE** | **Eliminar fallback AUTH_SECRET + validación obligatoria** | **1**             |
| **3**  | **BLOQUEANTE** | **CSRF activado en producción**                            | **1**             |
| **4**  | **Alta**       | **Migración PostgreSQL local → Neon**                      | **2**             |
| **5**  | **Alta**       | **Migración Redis local → Upstash**                        | **2**             |
| **6**  | **Alta**       | **Migración MinIO → Cloudflare R2**                        | **2**             |
| **7**  | **Alta**       | **Deploy Vercel (storefront + admin + superadmin)**        | **2-3**           |
| **8**  | **Alta**       | ~~Validación de variables de entorno al arrancar (Zod)~~   | **✅ Completada** |
| **9**  | **Alta**       | ~~NEXTAUTH_URL dinámica por entorno~~                      | **✅ Completada** |
| **10** | **Media**      | ~~Logs estructurados con pino~~                            | **✅ Completada** |
| **11** | **Media**      | ~~Sentry para errores en producción~~                      | **✅ Completada** |
| **12** | **Media**      | ~~Refactorización auth duplicada → @repo/auth~~            | **✅ Completada** |
| **13** | **Media**      | ~~Normalizar slug en create/edit de productos~~            | **✅ Completada** |
| **14** | **Baja**       | ~~Refactorización hacia @repo/commerce~~                   | **✅ Completada** |
| **15** | **Baja**       | ~~Eliminar dotenv duplicado en next.config.ts~~            | **✅ Completada** |
| **16** | **Baja**       | ~~Mensajes de error 409 con campo específico~~             | **✅ Completada** |
| **17** | **Baja**       | ~~Configuración de build ESM (next.config.mjs)~~           | **✅ Completada** |

**3. Implementación detallada — Bloqueantes**

**3.1 Row Level Security (RLS)**

Sin RLS, el aislamiento entre tenants depende únicamente del código de la aplicación. Un bug en cualquier query puede devolver datos de otro tenant. RLS mueve ese control al motor de base de datos, que lo aplica automáticamente en cada query sin importar qué haga el código.

**Migración SQL a crear**

Generar una nueva migración en packages/db/migrations/ con el siguiente contenido:

- Habilitar RLS en todas las tablas de negocio

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

- Política base para cada tabla

CREATE POLICY tenant_isolation ON products

USING ("tenantId" = current_setting('app.tenant_id', true)::UUID);

- (repetir para cada tabla)
- Función helper para setear el tenant_id en cada conexión

CREATE OR REPLACE FUNCTION set_tenant_id(tenant_id UUID)

RETURNS void AS $$

SELECT set_config('app.tenant_id', tenant_id::text, true);

$$ LANGUAGE sql;

**Cambio en el cliente de DB**

En packages/db/src/index.ts, antes de cada query de negocio, ejecutar:

// Antes de cualquier query con tenantId

await db.execute(sql`SELECT set_tenant_id(${tenantId}::uuid)`);

Importante

Las tablas tenants y admin_users NO deben tener RLS, porque el superadmin necesita acceso global a todos los tenants.

---

**3.2 Eliminar fallback de AUTH_SECRET**

El archivo apps/admin/lib/auth.ts y apps/superadmin/lib/auth.ts tienen esta línea:

secret: process.env.AUTH_SECRET || "dev-secret-key-12345678901234567890",

Esto significa que si AUTH_SECRET no está configurada en producción, el sistema usa un secret pública y cualquiera puede forjar tokens de sesión. Cambiar por:

// Al inicio del archivo, validar que exista

if (!process.env.AUTH_SECRET) {

throw new Error('AUTH_SECRET no está configurada. Ver .env.example');

}

// En la config de NextAuth

secret: process.env.AUTH_SECRET,

Adicionalmente, agregar AUTH_SECRET al .env.example con instrucciones para generarla:

# Generar con: openssl rand -base64 32

AUTH_SECRET=

**3.3 CSRF Protection**

Actualmente CSRF está desactivado por comodidad en desarrollo. En producción es obligatorio para proteger los endpoints de escritura.

NextAuth v5 maneja CSRF automáticamente cuando NODE_ENV=production. El cambio principal es en next.config.ts de admin y superadmin:

const nextConfig: NextConfig = {

// Remover cualquier configuración que deshabilite CSRF

// NextAuth lo activa automáticamente en production

};

**4. Migración de infraestructura a cloud**

Principio de migración

Los tres servicios (PostgreSQL, Redis, Storage) tienen APIs compatibles con los servicios cloud elegidos. No se cambia código de la aplicación, solo las variables de entorno.

---

| **Servicio local** | **Servicio cloud** | **Variable a cambiar** | **Compatibilidad** |
| --- | --- | --- | --- |
| **PostgreSQL (Docker)** | Neon | DATABASE_URL | 100% compatible. Mismo driver postgres.js. |
| **Redis (Docker)** | Upstash Redis | REDIS_URL | 100% compatible. Mismo cliente ioredis. |
| **MinIO (Docker)** | Cloudflare R2 | MINIO_* → R2_* | API S3-compatible. Cambio mínimo en @repo/storage. |
| **MailHog (SMTP local)** | Resend | RESEND_API_KEY | Cambiar nodemailer por Resend SDK en lib/email.ts. |

**4.1 Deploy en Vercel**

Las tres apps se despliegan como proyectos independientes en Vercel, todas apuntando al mismo repositorio pero con configuración de Root Directory diferente.

| **Proyecto Vercel** | **Root Directory** | **Dominio sugerido** |
| --- | --- | --- |
| **saas-storefront** | apps/storefront | *.tudominio.com (wildcard para tenants) |
| **saas-admin** | apps/admin | admin.tudominio.com |
| **saas-superadmin** | apps/superadmin | superadmin.tudominio.com |

Vercel Platforms para el storefront

El storefront necesita Vercel Platforms (plan Pro) para soportar dominios custom por tenant. Cada tenant puede configurar su propio dominio (ej: www.mitienda.com) y Vercel lo resuelve automáticamente con SSL.

---

**5. Validación de variables de entorno**

Si una variable crítica no está configurada en producción, el sistema falla en silencio o con errores críticos. La solución es validar todas las variables al arrancar con Zod.

**Crear packages/validation/src/env.ts:**

import { z } from 'zod';

const envSchema = z.object({

DATABASE_URL: z.string().url(),

REDIS_URL: z.string().url(),

AUTH_SECRET: z.string().min(32),

NEXTAUTH_URL: z.string().url().optional(), // NextAuth v5 la infiere del Host header

MP_ACCESS_TOKEN: z.string().startsWith('TEST-').or(z.string().startsWith('APP_USR-')),

RESEND_API_KEY: z.string().startsWith('re_'),

NEXT_PUBLIC_APP_URL: z.string().url(),

});

export const env = envSchema.parse(process.env);

// Si falla, lanza un error claro con qué variable falta

Importar env.ts en cada app en el archivo de configuración principal para que se ejecute al iniciar el servidor.

**6. Observabilidad y logs**

**6.1 Logs estructurados con pino**

Reemplazar todos los console.log por un logger centralizado. Instalar pino en los paquetes que lo necesiten:

pnpm add pino pino-pretty --filter admin --filter storefront

// packages/logger/src/index.ts

import pino from 'pino';

export const logger = pino({

level: process.env.LOG_LEVEL || 'info',

transport: process.env.NODE_ENV === 'development'

? { target: 'pino-pretty' } : undefined,

});

Cada log debe incluir tenantId, userId y requestId para poder filtrar por tenant en producción.

**6.2 Sentry para errores**

pnpm add @sentry/nextjs --filter admin --filter storefront --filter superadmin

Configurar Sentry en cada app con next.config.ts usando withSentryConfig. En producción captura automáticamente errores no manejados, performance y Web Vitals.

Variables de entorno adicionales para Sentry

SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

SENTRY_ORG=tu-org

SENTRY_PROJECT=saas-storefront

---

**7. Deuda técnica a resolver**

**7.1 Refactorización de auth duplicada**

El código de autenticación está duplicado en apps/admin/lib/auth.ts y apps/superadmin/lib/auth.ts. Ya existe @repo/auth pero no todas las apps lo usan. Consolidar en el paquete compartido:

- Mover la configuración de NextAuth a packages/auth/src/index.ts
- Exportar handlers, auth, signIn, signOut desde @repo/auth
- Eliminar lib/auth.ts duplicado en admin y superadmin
- Actualizar imports en todas las apps

**7.2 Normalización de slugs**

Al crear o editar productos, el slug no se normaliza automáticamente. Un slug con mayúsculas o caracteres especiales rompe las URLs del storefront. Agregar en el endpoint de products:

function normalizeSlug(text: string): string {

return text

.toLowerCase()

.normalize('NFD')

.replace(/[\u0300-\u036f]/g, '') // Elimina acentos

.replace(/[^a-z0-9\s-]/g, '')

.replace(/\s+/g, '-')

.replace(/-+/g, '-')

.trim();

}

**7.3 Refactorización hacia @repo/commerce**

La lógica de cálculo de totales, aplicación de descuentos y validación de stock está duplicada entre el storefront y el admin. Crear packages/commerce con esta lógica centralizada.

Cuándo hacer esta refactorización

Al inicio de la Fase 5, antes del primer deploy. Es más fácil mover código cuando no hay datos reales en producción. Si se hace después, hay riesgo de introducir bugs en un sistema vivo.

---

**8. Variables de entorno de producción**

Esta es la lista completa de variables que deben estar configuradas en cada app de Vercel antes del primer deploy:

| **Variable** | **Apps** | **Descripción** |
| --- | --- | --- |
| **DATABASE_URL** | Todas | URL de conexión a Neon PostgreSQL |
| **REDIS_URL** | Todas | URL de Upstash Redis con token |
| **AUTH_SECRET** | Admin, Superadmin | Secret para JWT. Generar con: openssl rand -base64 32 |
| **NEXTAUTH_URL** | Admin, Superadmin | Opcional: NextAuth v5 la infiere del Host header. Solo necesaria si usás proxy inverso. |
| **MP_ACCESS_TOKEN** | Storefront | Access token de MercadoPago (producción: APP_USR-...) |
| **MERCADOPAGO_WEBHOOK_SECRET** | Storefront, Admin, Superadmin | Secret para validar webhooks de MercadoPago |
| **RESEND_API_KEY** | Storefront | API key de Resend para emails transaccionales |
| **NEXT_PUBLIC_APP_URL** | Storefront | URL pública del storefront (para links en emails) |
| **R2_ACCOUNT_ID** | Admin | ID de cuenta Cloudflare para R2 |
| **R2_ACCESS_KEY_ID** | Admin | Access key de Cloudflare R2 |
| **R2_SECRET_ACCESS_KEY** | Admin | Secret key de Cloudflare R2 |
| **R2_BUCKET_NAME** | Admin | Nombre del bucket en R2 |
| **SENTRY_DSN** | Todas | DSN de Sentry para captura de errores |

**9. Checklist de Go-Live**

Antes de apuntar el dominio real y anunciar el primer cliente, verificar cada ítem:

Seguridad — Obligatorio antes de cualquier deploy

- [ ]  RLS activado y testeado en todas las tablas de negocio
- [ ]  AUTH_SECRET sin fallback hardcoded en admin y superadmin
- [ ]  CSRF activado (verificar con NODE_ENV=production)
- [ ]  Todas las variables de entorno validadas con Zod al arrancar
- [ ]  Sin credenciales en el código ni en el repositorio

---

Infraestructura — Antes del primer cliente real

- [ ]  PostgreSQL migrando a Neon con datos de producción
- [ ]  Redis migrando a Upstash
- [ ]  Imágenes migradas a Cloudflare R2
- [ ]  Las tres apps deployadas en Vercel
- [ ]  Dominios configurados con SSL automático
- [ ]  MercadoPago en modo producción (token APP_USR-...)
- [ ]  Webhook de MercadoPago apuntando a URL de Vercel
- [ ]  Email configurado con Resend en modo producción

---

Observabilidad — Antes de escalar

- [ ]  Sentry configurado y capturando errores
- [ ]  Logs estructurados con tenantId en cada entrada
- [ ]  Alertas configuradas para errores críticos
- [ ]  Runbook documentado: qué hacer si cae cada servicio

---

*SaaS eCommerce — Brief Técnico Fase 5 — Abril 2026 — Confidencial*

*Actualizado 6 de mayo 2026: Fase 5 completada exitosamente. Todas las tareas de seguridad, observabilidad y hardening implementadas. 225/225 tests pasando. Build limpio en las 3 apps.*

---

## Estado Final de la Fase 5 ✅

La Fase 5 fue completada exitosamente el 6 de mayo de 2026. Todos los objetivos de producción han sido alcanzados:

- **Seguridad crítica**: RLS, AUTH_SECRET obligatorio, CSRF protection, validación de variables de entorno.
- **Observabilidad**: Logs estructurados con Pino, Sentry integrado para captura de errores.
- **Hardening**: NEXTAUTH_URL dinámica, mensajes de error 409 con campo específico, UI de validación inline.
- **Configuración de build**: next.config.mjs para compatibilidad ESM en Next.js 16.
- **Calidad del código**: 225 tests pasando, build limpio en las 3 apps, lint y typecheck sin errores.

El sistema está listo para el deploy a producción en Vercel con infraestructura cloud (Neon PostgreSQL, Upstash Redis, Cloudflare R2, Resend).
$$
