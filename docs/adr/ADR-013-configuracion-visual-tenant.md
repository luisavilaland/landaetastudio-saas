# ADR-013: Configuración visual del tenant

**Fecha:** 2026-05-15
**Contexto:** Permitir que cada comercio personalice la apariencia de su tienda (logo, colores, tipografía, redes sociales).

## Decisión

La configuración visual se almacena como un campo `settings` de tipo JSONB directamente en la tabla `tenants`. Contiene `logoUrl`, `primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`, `storeDescription`, `contactEmail`, `contactPhone`, y un objeto JSONB `socialLinks` para redes sociales (Instagram, Facebook).

## Estado

**Aceptada — ver discrepancia**

- ✅ Implementado: `settings: jsonb("settings").default({})` en tabla `tenants` (`packages/db/src/schema.ts:11`)
- ✅ API en `apps/admin/app/api/store/settings/route.ts` y `config/settings/route.ts`
- ⚠️ La documentación original menciona una tabla separada `store_settings` que nunca se creó — la implementación real usa un JSONB inline en `tenants`. Esta ADR refleja la implementación real, no la documentación desactualizada.

## Consecuencias

- No hay schema fijo para la configuración visual — agregar nuevos campos es trivial
- La configuración viaja con el tenant, sin joins adicionales
- Sin tabla extra, pero el JSONB puede crecer con el tiempo