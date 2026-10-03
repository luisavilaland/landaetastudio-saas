---
id: 112
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 04:21:32"
updated_at: "2026-10-03 04:21:32"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "seed.ts trunca 10 de 13 tablas: subscriptions y tenant_mp_config quedan fuera"
---

# seed.ts trunca 10 de 13 tablas: subscriptions y tenant_mp_config quedan fuera

**What**: `packages/db/seed.ts` ejecuta `TRUNCATE TABLE ... CASCADE` sobre **10 de las 13 tablas** del baseline. Quedan fuera **tres**: `subscriptions`, `tenant_mp_config` y `shipping_methods`.

**Why**: Inventariar las tablas del TRUNCATE durante el diagnostico del item 44 (CI/dev comparten base) revelo que el TRUNCATE es parcial y lo que deja afuera es exactamente la tabla que Fase 2 va a usar.

**Where**: `packages/db/seed.ts`, `vault/03_Deuda/deuda-tecnica.md` item 46.

**Learned**:

1. **Las 10 que SI se truncan:** `plans`, `order_items`, `orders`, `product_variants`, `product_images`, `products`, `categories`, `customers`, `admin_users`, `tenants`.

2. **Las 3 que NO:** `subscriptions`, `tenant_mp_config`, `shipping_methods`. **`subscriptions` es la de Fase 2.**

3. **Impacto: tests flaky en T4/T5.** Las suscripciones creadas por los tests no se limpian entre runs, asi que un test puede leer filas residuales de una corrida anterior. Falsos positivos (el test pasa porque encontro una suscripcion vieja en vez de la que acaba de crear) y falsos negativos (falla por conflicto de datos previos y se reintenta sin causa real). **Tests flaky son peores que un fallo claro** porque entrenan al equipo a reintentar sin investigar.

4. **Un TRUNCATE parcial es mas peligroso que uno ausente, porque es silencioso.** No falla, no avisa, y deja la base en un estado que nadie declaro. Misma clase de problema que el item 44 pero sin senal.

5. **Mitigacion preferida: centralizar.** Agregar `subscriptions` y `tenant_mp_config` al TRUNCATE de `seed.ts` (evaluar tambien `shipping_methods`) mantiene la garantia "dejar la base como estaba" en un solo lugar. La alternativa - que cada spec de T4/T5 limpie en su `beforeAll` - es menos invasiva pero depende de que cada test nuevo se acuerde.

6. **No es bug hoy:** no hay suscripciones reales en la base. Se vuelve relevante antes de T4 (endpoints de suscripciones).

7. **Correccion de un dato que circulaba mal:** el numero de tablas truncadas es **10**, no 13. Las 13 son el total de tablas del baseline. Verificado con grep sobre `seed.ts`. Importa porque el registro permanente de deuda no debe arrastrar el numero equivocado.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
