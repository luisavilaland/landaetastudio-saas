# ADR-006: No usar MedusaJS

**Fecha:** 2026-04-22
**Contexto:** El blueprint original consideraba usar MedusaJS como librería de dominio para lógica de eCommerce.

## Decisión

Se optó por implementar la lógica directamente en TypeScript dentro de `packages/commerce`, manteniendo el control total y evitando el acoplamiento a un framework de eCommerce. La lógica de carrito, órdenes y precios es lo suficientemente simple y específica como para no justificar una dependencia externa adicional.

## Estado

**Aceptada**

- ✅ Cero referencias a `medusa` o `medusajs` en cualquier `package.json`
- ✅ Lógica de negocio implementada en `@repo/commerce`

## Consecuencias

- Todo el código de dominio es propio, sin depender de APIs externas
- Mayor libertad para adaptar la lógica a necesidades específicas del proyecto
- Responsabilidad total del mantenimiento de la lógica de negocio
