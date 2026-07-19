# ADR-003: Precios en centavos (integer)

**Fecha:** 2026-04-22
**Contexto:** Elegir representación de precios en el sistema. Alternativas: float/decimal en la base de datos vs integer en centavos.

## Decisión

Todos los precios se almacenan como enteros en centavos (`integer` en PostgreSQL). El frontend divide entre 100 solo para mostrar el precio formateado. El backend recibe y trabaja siempre con enteros.

Esto elimina los errores de redondeo propios de floats, es práctica estándar en eCommerce, y evita problemas de comparación.

## Estado

**Aceptada**

- ✅ Schema: `price: integer("price")` en `product_variants`, `shipping_methods`, `total: integer("total")` en `orders`, `unitPrice: integer("unitPrice")` en `order_items`
- ✅ Frontend: `(cents / 100)` en `variant-selector.tsx`, `product-card.tsx`, `cart-list.tsx`, `checkout/page.tsx`, etc

## Consecuencias

- El backend nunca recibe ni devuelve decimales — todo es integer
- El frontend es responsable del formateo visual
- Validación Zod en centavos: `price > 0` como entero