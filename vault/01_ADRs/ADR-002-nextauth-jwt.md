# ADR-002: NextAuth con JWT en lugar de sesiones de base de datos

**Fecha:** 2026-04-22
**Contexto:** Elegir estrategia de sesión para NextAuth v5. Alternativas: JWT (token en cookie) vs sesiones de base de datos (sesión en DB, consulta en cada request).

## Decisión

Usamos JWT con `session: { strategy: "jwt" }` en las tres configuraciones de auth (storefront, admin, superadmin). El token contiene los claims necesarios (`tenantId`, `role`) y se verifica sin consultar la base de datos en cada request.

Esto elimina una consulta extra por petición y simplifica la resolución multi-tenant en el middleware.

## Estado

**Aceptada**

- ✅ Configuraciones en `packages/auth/src/index.ts` (admin + superadmin) y `apps/storefront/lib/auth.ts` — todas con `strategy: "jwt"`
- ✅ JWT callbacks inyectan `tenantId` y `role` en el token

## Consecuencias

- No hay sesiones persistentes en DB — revocar acceso requiere esperar expiración del JWT o rotar AUTH_SECRET
- El token no debe contener datos sensibles (solo IDs y roles)
- `AUTH_SECRET` es obligatorio y validado por Zod al arrancar
