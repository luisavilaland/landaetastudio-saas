# ADR-010: Variantes con JSONB

**Fecha:** 2026-04-22
**Contexto:** Modelar variantes de producto (talle, color, etc.) que pueden tener atributos diferentes por producto.

## Decisión

Las variantes usan un campo JSONB (`options`) para almacenar combinaciones de atributos sin necesidad de tablas adicionales para atributos. Esto ofrece flexibilidad total: cada producto puede tener diferentes atributos sin cambiar el schema. Cada variante tiene su propio SKU, stock y precio independientes.

## Estado

**Aceptada**

- ✅ Schema: `options: jsonb("options").default({})` en `dbProductVariants` (`packages/db/src/schema.ts:57`)
- ✅ Cada variante tiene `sku`, `stock`, `price` propios

## Consecuencias

- No hay tabla de atributos fija — cada producto define sus propias dimensiones
- Consultas por atributos específicos requieren acceso a JSONB (menos eficiente que columnas normalizadas)
- Validación de atributos específicos es responsabilidad del frontend
