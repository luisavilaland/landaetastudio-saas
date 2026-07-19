# ADR-016: NextResponse en lugar de new Response() nativa

**Fecha:** 2026-05-03
**Contexto:** Decidir la API de respuesta HTTP para las rutas API de Next.js. Alternativas: `NextResponse` de Next.js vs `new Response()` nativa del navegador.

## Decisión

Todas las rutas API usan `NextResponse.json()` de Next.js. `NextResponse` integra manejo de cookies, headers específicos de Next.js, y es la forma recomendada por el framework. Se eliminaron todos los helpers `jsonResponse` con headers JSON manuales y se unificó todo con la API de Next.js. Los helpers locales que simplemente envuelven `NextResponse.json()` son aceptables para evitar repetición de código.

## Estado

**Aceptada**

- ✅ 100% de rutas API usan `NextResponse.json()` — cero usos de `new Response()`
- ✅ Algunas rutas tienen helpers `jsonResponse` locales que envuelven `NextResponse.json()`

## Consecuencias

- Consistencia en todas las rutas API
- Las cookies y headers de Next.js se manejan sin configuración adicional
- Sin riesgo de mezclar APIs de respuesta