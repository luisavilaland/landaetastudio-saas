# ADR-018: Consolidación de NextAuth en @repo/auth

**Fecha:** 2026-05-15
**Contexto:** Durante la Fase 4 se detectó que la configuración de NextAuth v5 estaba duplicada en `apps/admin/lib/auth.ts` y `apps/superadmin/lib/auth.ts`, diferenciándose solo en el rol validado.

## Decisión

Se consolidó en `@repo/auth` creando funciones factory `createAdminAuth()` y `createSuperadminAuth()` que centralizan la lógica. Las apps ahora reexportan desde el paquete mediante imports como `export { handlers, auth } from "@repo/auth"` (admin) y alias para superadmin (`superadminHandlers`, `superadminAuthFn`).

## Estado

**Aceptada**

- ✅ `packages/auth/src/index.ts` con `createAdminAuth()` y `createSuperadminAuth()`
- ✅ `apps/admin/lib/auth.ts` reexporta desde `@repo/auth`
- ✅ `apps/superadmin/lib/auth.ts` reexporta con aliases
- ✅ Tests importan desde `@repo/auth`

## Consecuencias

- Elimina duplicación de configuración de auth
- Cambios en NextAuth se hacen en un solo lugar
- Cada app recibe la configuración específica para su rol