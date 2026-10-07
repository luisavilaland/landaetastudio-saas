---
id: 199
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-07 16:37:00"
updated_at: "2026-10-07 16:37:24"
revision_count: 2
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Un ?? entre secrets de scope distinto en un gate de seguridad es un bypass de frontera, no una degradación tolerable"
---

# Un ?? entre secrets de scope distinto en un gate de seguridad es un bypass de frontera, no una degradación tolerable

**What**: Patrón reutilizable del proyecto. En un punto donde un valor de entorno es un *gate de seguridad* y existe más de una variable con nombre parecido (una propia del scope, otra de un scope vecino), un `??` entre las dos no es "degradación tolerable": es una caída de frontera. La forma correcta es fail-closed con el código de status que le corresponde al dominio — 503 para infraestructura/configuración ausente (el proveedor reintenta), 401 para firma inválida (no reintentar). Y el análogo ya presente en el mismo archivo es la mejor especificación: cuando el código nuevo puede copiar el patrón de una línea de arriba, no hay debate.

**Why**: El item 71 fue exactamente esto. `MP_PLATFORM_WEBHOOK_SECRET ?? MERCADOPAGO_WEBHOOK_SECRET` hacía que el secret del tenant validara webhooks de la plataforma. El plan original de T5 (§8.1) ya pedía 503; la implementación agregó el fallback "para que dev y preview no dieran 401", y el item de deuda lo justificó como decisión deliberada durante dos semanas.

**Where**: Patrón general. Casos concretos del repo: `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (secret de plataforma y access token de plataforma, ambos `?? null` + 503); el contraste es `apps/storefront/app/api/webhooks/mercadopago/route.ts`, que usa `MERCADOPAGO_WEBHOOK_SECRET` y rechaza si falta — nunca cae a otra variable.

**Learned**: (1) **La degradación es una decisión de negocio de seguridad, no un default de robustez.** Ante la duda en un gate: fallar, no degradar. Un 503 que reintenta es recuperable; un 200 firmado con el secret equivocado es una vulnerabilidad silenciosa que nadie va a reportar. (2) **503 vs 401 no es cosmético.** 503 = "tu infraestructura no está lista, reintentá" → MP reintenta solo. 401 = "tu firma es inválida" → no reintentás y tapás un bug de configuración con un error de seguridad. Confundirlos convierte un fix de seguridad en una pérdida de eventos. (3) **Un test que consagra el comportamiento inseguro es peor que ningún test**: el `cae al secret del tenant... → 200` llevaba dos semanas protegiendo el fallback como regresión, y su comentario condicionaba a un lector futuro a no tocarlo. Cuando un test documenta algo que el ADR prohíbe, el test es el error, no el ADR. (4) **Un comentario que racionaliza una debilidad la legitima.** "El fallback no se puede expresar en el schema, que exige min(1)" era una explicación técnicamente verificable y una justificación de decisión en la misma frase. La primera mitad era cierta; la segunda convertía un descuido en arquitectura. (5) Corolario de proceso: cuando el hallazgo de una auditoría y una decisión de producto chocan, hay que corregir el artefacto. Un item de deuda que dice "el código está bien, el ADR está incompleto" y queda sin revisar convierte un bypass en precedente escrito.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
