# ADR-017: Tests de "lógica pura" para endpoints

**Fecha:** 2026-05-03
**Contexto:** Los tests de endpoints que importaban directamente rutas de Next.js (`import { GET } from "../route"`) fallaban con `next-auth@5.0.0-beta.31` porque el beta importa módulos de `next/server` sin extensión `.js`, que vitest no resuelve.

## Decisión

Los tests usan un patrón de "lógica pura": mockean las dependencias (`@repo/db`, `next/headers`, `drizzle-orm`, etc.) y verifican el comportamiento esperado. A partir de P1-1, la mayoría de los tests importan los handlers reales (`import { POST } from "../route"`) con mocks de dependencias.

**Nota 2026-07-17:** Esta ADR se actualiza. El patrón original buscaba no importar handlers reales, pero la experiencia mostró que importar los handlers reales con mocks produce tests más fieles al código de producción. Actualmente 13/22 archivos de test (59%) importan handlers reales — esto es una mejora, no una desviación.

## Estado

**Aceptada — ver discrepancia**

- ✅ Todos los tests mockean dependencias externas (`@repo/db`, `next/headers`, Redis, etc.)
- ✅ 22 archivos `__tests__/route.test.ts` en todo el proyecto
- ⚠️ La documentación de Fase 3.5 afirmaba que ningún test importaba handlers reales — 13/22 sí lo hacen, y es intencional (mejora sobre el patrón original, no deuda)

## Consecuencias

- Tests independientes del test runner y de la configuración de módulos
- Mockear `withTenantContext` directamente (no `db.transaction`) es el estándar actual
- Los tests ejercitan el código real del handler, no una réplica inline