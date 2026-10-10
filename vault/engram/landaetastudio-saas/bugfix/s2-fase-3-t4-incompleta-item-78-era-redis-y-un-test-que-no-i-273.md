---
id: 273
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/s2-platform-host-items-65-67
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 00:02:50"
updated_at: "2026-10-10 00:02:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "S2 Fase 3: T4 incompleta, item 78 era Redis, y un test que no importa lo que prueba"
---

# S2 Fase 3: T4 incompleta, item 78 era Redis, y un test que no importa lo que prueba

**What**: S2 del plan de Fase 3 implementado en el PR #240. T1 (`PLATFORM_HOST` en el proxy) + T6 (items 65 y 67). 3 hallazgos no estaban en el plan. Tests 759 → 768.

**Why:** S2 arranca primero por decisión de Luis: 3 h contra 10 h, no toca datos de producción, y cumple la deuda explícita de la auditoría de Fase 2 (items 65/67) que pidió cerrarse antes de que exista la UI.

**Where:** `apps/storefront/proxy.ts`, `apps/admin/.../subscriptions/preapproval/route.ts`, `apps/admin/.../webhooks/mercadopago/subscriptions/route.ts`, `packages/validation/src/env.ts`, `apps/storefront/__tests__/proxy-platform-host.test.ts` (nuevo).

**Learned**:
- **T4 del plan estaba incompleta y no lo sabíamos.** De los cuatro caminos de resolución del proxy, **solo dos consultan la DB**. La cookie `tenant-slug`, `localhost → tienda1` y `DEFAULT_TENANT_SLUG` asignan tenant **sin tocar la base**: sin verificar existencia, sin verificar `status`, y con `tenantId` en `null`. **Filtrar por status solo los lookups de dominio y subdominio deja el agujero abierto**: un tenant `pending` sigue resolviendo por cookie y su tienda queda accesible. Hoy no es brecha (el storefront es público) pero lo es en cuanto exista el primer `pending`. Recomendación para S1: validar los slugs de los fallbacks contra la DB (camino frío, no cuesta en el caliente).
- **La excepción de plataforma va AL PRINCIPIO del proxy, no "antes de los fallbacks".** Si fuera después, un `tenant-slug` de una visita previa resolvería un tenant en el host de plataforma y la landing mostraría esa tienda. El host de plataforma no tiene tenant por definición. Además `PLATFORM_HOST` se valida como host **sin esquema ni puerto**, porque se compara contra el `host` ya sin puerto: `https://app.example.com` sería un fallo silencioso.
- **El item 78 NO era un test de DB.** El título decía DB y asumía Neon desde hacía meses. Es `redis.test.ts`, y el timeout viene de `await import('@sentry/nextjs')` **dentro del `catch` de degradación** de `redisDown()`. Aislado 2.44 s, en la suite completa 6863 ms. Se importa Sentry para después no llamarlo (la guarda de L57 evita la llamada, no el import). **La hipótesis de `whenReady` se verificó y se descartó**: el mock pone `status = 'ready'`.
- **La acción que faltaba en el item 78 era una sola: correr la suite guardando el output a archivo** para leer la línea `FAIL`. Repetir un test que flakea sin capturar su nombre no produce información. Eso es lo que lo dejó abierto meses.
- **Un test puede mentir sobre si existe cobertura, no solo sobre la garantía.** `apps/storefront/__tests__/proxy.test.ts` son 24 líneas que reimplementan la resolución con `split('.')` y assertan sobre la copia: **pasaría en verde si se borrara `proxy.ts` entero**. Es el item 62 con un caso nuevo. Regla: un test cuyo nombre dice probar una unidad tiene que **importar esa unidad**.
- **Cuando un fix rompe tests que estaban verdes, leer el test antes de "arreglarlo".** Los 2 tests del item 67 usaban `external_reference: 'tenant-42'` — una ficción que solo podía existir porque nadie validaba; producción setea un UUID real. Fallaron **bien**: eran la prueba de que el bug llevaba meses activo.
- **El caso 65 del plan era distinto al que resultó.** El plan decía "cambiar un test que consagra la forma equivocada"; el test no afirmaba que `initPoint` faltara, **simplemente no lo mencionaba**. Eso es peor: no hay una aserción que contradiga al código, hay una ausencia.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
