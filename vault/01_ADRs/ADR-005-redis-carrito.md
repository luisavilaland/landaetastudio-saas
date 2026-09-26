# ADR-005: Redis para el carrito en lugar de PostgreSQL

**Fecha:** 2026-04-22
**Contexto:** Elegir almacenamiento para el carrito de compras. Alternativas: PostgreSQL vs Redis.

## Decisión

Usamos Redis para el carrito (Upstash en producción, Redis local en desarrollo). El carrito requiere lecturas/escrituras muy frecuentes y un TTL automático para limpiar sesiones abandonadas. Redis ofrece latencia sub-milisegundo para operaciones clave-valor y expiración automática a los 7 días sin carga para PostgreSQL.

Las sesiones de carrito son anónimas mediante cookie `cart_session_id`, sin autenticación requerida.

## Estado

**Aceptada**

- ✅ `redisClient` definido en `packages/commerce/src/redis.ts` usando ioredis
- ✅ Operaciones de carrito en `packages/commerce/src/cart.ts` con TTL de 7 días (`60 * 60 * 24 * 7`)
- ✅ Sesión anónima vía cookie `cart_session_id`
- ✅ `REDIS_URL` validado por Zod en `packages/validation/src/env.ts`

## Consecuencias

- El carrito sobrevive a cierres de sesión del navegador (7 días)
- PostgreSQL no se carga con operaciones transitorias del carrito
- Redis es una dependencia operativa adicional que debe estar disponible
