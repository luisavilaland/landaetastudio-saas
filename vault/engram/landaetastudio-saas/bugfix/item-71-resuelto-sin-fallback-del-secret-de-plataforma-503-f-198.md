---
id: 198
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-07 16:36:38"
updated_at: "2026-10-07 16:36:38"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 71 resuelto: sin fallback del secret de plataforma, 503 fail-closed"
---

# Item 71 resuelto: sin fallback del secret de plataforma, 503 fail-closed

**What**: Resuelto el item 71 (H-F2-9). En `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` se eliminó `process.env.MP_PLATFORM_WEBHOOK_SECRET ?? process.env.MERCADOPAGO_WEBHOOK_SECRET` y quedó `process.env.MP_PLATFORM_WEBHOOK_SECRET ?? null` con 503 si falta. Log: `MP_PLATFORM_WEBHOOK_SECRET not configured`. Se cambió el test `cae al secret del tenant si el de plataforma NO esta configurado` (que esperaba 200) por `503 si falta el secret de plataforma aunque exista el del tenant`, que además afirma que `getPreapproval` y `getPayment` no se llamaron. ADR-023 corregido: `MP_PLATFORM_WEBHOOK_SECRET` figuraba como `Vercel (storefront)` y el handler vive en `apps/admin`.

**Why**: Bypass cross-tenant. `MERCADOPAGO_WEBHOOK_SECRET` es el secret del flujo de órdenes de tienda — el mismo valor que el tenant pega en su onboarding. Con el fallback, quien conociera el secret de su propio tenant firmaba webhooks que el handler de plataforma aceptaba, rompiendo la separación de ADR-023. Decisión de Luis: sin fallback, fail-closed, 503 para que MP reintente.

**Where**: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (líneas 104-125), `.../__tests__/handler.test.ts` (describe 'firma'), `vault/01_ADRs/ADR-023-dos-flujos-mp.md`, `vault/03_Deuda/deuda-tecnica.md` item 71, `vault/02_Bitacora/bitacora.md`. Rama `fix/h-f2-9-platform-secret-no-fallback` desde `develop` @ `7342f3d`.

**Learned**: (1) **El 503 ya existía** (líneas 117-125) y el handler de `MP_PLATFORM_ACCESS_TOKEN` 60 líneas más abajo ya usaba el patrón correcto `?? null` + 503. El fix real fueron 4 líneas: hacer que el secret se pareciera al token, no inventar una convención. Leer el archivo entero antes de escribir el plan evita planear un bloque de 12 líneas donde solo hay una línea que cambiar. (2) **TDD demostró el bug**: el test nuevo falló con `expected 200 to be 503` — ese 200 *era* el fallback. Un test que consagra el comportamiento inseguro, borrado y reemplazado por el que exige el comportamiento correcto, convierte una debilidad en una prueba. Contador 705 sin cambio (-1/+1). (3) **El diagnóstico del item de deuda estaba invertido**: decía "el código está bien; el ADR está incompleto", con el argumento plausible de que el fallback mitigaba un 401 real en dev/preview. Era falso: la mitigación cubría un problema menor mientras dejaba abierto un bypass cross-tenant. Se corrigió el item preservando el diagnóstico original como historial. (4) El comentario del código justificaba el fallback como decisión deliberada ("no se puede expresar en el schema") — un comentario que racionaliza una debilidad es más peligroso que la debilidad, porque la legitima ante el próximo que la lea.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
