---
id: 111
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 04:14:04"
updated_at: "2026-10-03 04:14:04"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "Item 44 reclasificado a BAJA y checklist de go-live con trigger obligatorio"
---

# Item 44 reclasificado a BAJA y checklist de go-live con trigger obligatorio

**What**: Item 44 re-clasificado a **BAJA** por decision del humano (no hay clientes reales, los datos son regenerables con `pnpm db:seed`). Item 45 marcado **RESUELTO** por configuracion. Anadido recordatorio en la checklist de go-live (blueprint v2.6, Fase 10).

**Why**: El humano confirmo que en la etapa actual el riesgo es aceptable, y que el guard en `seed.ts` es defensa a futuro, no necesidad actual.

**Where**:
- `vault/03_Deuda/deuda-tecnica.md` - items 44 y 45 reescritos
- `docs/superpowers/specs/2026-09-blueprint-v2.6.md` L356-364 - Fase 10, item 8 nuevo

**Learned**:

1. **Decision del humano:** item 44 = BAJA durante desarrollo. No hay clientes reales. Los datos son regenerables. **Reevaluar obligatoriamente antes de: (a) primer tenant con datos reales, (b) cualquier deploy que reciba trafico.**

2. **Guard NO aplicado.** Es defensa a futuro. El fix preparado: `seed.ts` que refuse si el host es production y `CI=true`, salvo `ALLOW_PROD_SEED_IN_CI=true`.

3. **Por que el guard actual no sirve en CI:** hoy `seed.ts` solo chequea `NODE_ENV`, y **CI no setea `NODE_ENV`**. Por eso el guard pasaria en un runner. **Un guard por host resuelve el problema** (el host de Neon identifica la base con certeza, `NODE_ENV` no).

4. **CORRECCION DE DATO: son 10 tablas, no 13.** Verificado con grep. `seed.ts` hace `TRUNCATE TABLE` sobre exactamente 10: `plans`, `order_items`, `orders`, `product_variants`, `product_images`, `products`, `categories`, `customers`, `admin_users`, `tenants`. Las 13 son el total de tablas del baseline. El numero 13 circulaba en el encargo y en conversaciones previas; el registro permanente ya decía 10 y se mantuvo.

5. **Hallazgo colateral: 3 tablas NO se truncan** - `subscriptions`, `shipping_methods`, `tenant_mp_config`. **`subscriptions` es la relevante**: no se limpia entre runs de seed, asi que las suscripciones de pruebas de MP quedan persistidas en la base compartida. Puede generar confusion al depurar E2E de suscripciones (que es exactamente lo que vendra en Fase 2). **No es bug todavia** (hoy no hay suscripciones reales), pero conviene tenerlo en cuenta cuando T4/T5 creen filas.

6. **La checklist de go-live SI existe:** `docs/superpowers/specs/2026-09-blueprint-v2.6.md`, seccion **"Fase 10 - Go-live y checklist final"** (L356), lista numerada 1-7. El item 7 es "Primer cliente real onboardeado", que es exactamente el trigger del item 44. Se agrego como item 8 con redaccion "ANTES del punto 7" para no renumerar la lista.

7. **Item 45 resuelto por config, no por codigo.** Si alguien mueve uno solo de los dos secrets de base, el split reaparece con un sintoma que no parece de configuracion (una orden existe en una base y el webhook busca en otra). Queda documentado como decision consciente, no como bug corregido.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
