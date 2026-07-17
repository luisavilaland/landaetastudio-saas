# ADR-007: Estructura de monorepo

**Fecha:** 2026-04-22
**Contexto:** Definir la organización del código fuente del proyecto.

## Decisión

Usamos un monorepo con Turborepo y pnpm, separando las apps en `storefront`, `admin` y `superadmin` porque cada una tiene su propio dominio de negocio y políticas de seguridad. Los paquetes compartidos (`db`, `storage`, `auth`, `validation`, `commerce`, `logger`) evitan duplicar lógica de acceso a datos o reglas de negocio.

## Estado

**Aceptada**

- ✅ 3 apps en `apps/`: `storefront`, `admin`, `superadmin`
- ✅ 6 paquetes en `packages/`: `auth`, `commerce`, `db`, `logger`, `storage`, `validation`
- ✅ `pnpm-workspace.yaml` incluye `apps/*` y `packages/*`
- ✅ Turborepo configurado con pipelines de `lint`, `typecheck`, `build`, `test`

## Consecuencias

- Cada app tiene su propio deploy en Vercel con change detection
- Los paquetes compartibles evitan código duplicado
- Turborepo cachea builds y tests para eficiencia