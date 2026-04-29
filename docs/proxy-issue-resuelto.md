# Problema del proxy con Turbopack – pendiente de resolver

## Problema

El archivo `apps/storefront/proxy.ts` (middleware de Next.js) falla con el error:

```
TypeError: NextResponse.next is not a function
```

Este error ocurre al intentar usar `NextResponse.next()` o `NextResponse.rewrite()` dentro del proxy con Turbopack (Next.js 16.2.4).

## Intentos fallidos

1. **NextResponse.next()** – API estándar de middleware, falla con "is not a function"
2. **NextResponse.rewrite(url)** – Mismo error
3. **request.nextUrl.clone() + NextResponse.next({ request: {...} })** – Error de sintaxis inválida
4. **Response nativa del Web API** – Crea bucle infinito porque el proxy se llama a sí mismo
5. **fetch(request.nextUrl.clone())** – Mismo problema de bucle infinito
6. **Renombrar proxy.ts a middleware.ts** – Next.js 16 depreca el nombre "middleware" en favor de "proxy"
7. **Forzar runtime: 'nodejs'** – No resuelve el problema
8. **Exportar como middleware** – Next.js requiere que la función se llame "proxy" en archivo "proxy.ts"

## Solución temporal aplicada

- **Archivo proxy.ts renombrado** a `proxy.ts.bak` (desactivado)
- **Resolución de tenant movida** a `page.tsx` usando `headers()` + consulta directa a `dbTenants`
- El código actual en `page.tsx` extrae el tenant desde el header `host`:
  ```tsx
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const tenantSlug = host.includes(".") ? host.split(".")[0] : "default";
  ```

## Funcionalidades afectadas

- **Dominio personalizado (customDomain)**: No disponible sin el proxy
- **Redis cache de dominio**: No se puede implementar
- **Header x-tenant-slug**: No se pasa automáticamente
- **Header x-tenant-id**: No se pasa automáticamente
- **Header x-cart-session-id**: No se establece en proxy
- **Logging de requests**: Reducido

## Plan de recuperación

1. Probar el servidor **sin Turbopack**: `next dev --no-turbo` (ver si el problema es Turbopack específicamente)
2. Esperar actualización de Next.js que solucione el bug
3. Implementar un patrón alternativo de middleware que no use `NextResponse.next()`
4. Considerar usar Edge Config o API routes para la resolución de tenant

## Fecha y versión

- **Fecha**: 28/04/2026
- **Next.js**: 16.2.4
- **Turbopack**: Habilitado por defecto en dev