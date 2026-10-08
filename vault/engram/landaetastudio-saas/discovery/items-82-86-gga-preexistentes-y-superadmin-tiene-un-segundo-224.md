---
id: 224
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/items-82-86-gga-preexistentes
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 20:34:10"
updated_at: "2026-10-08 20:34:10"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Items 82-86: GGA preexistentes, y superadmin tiene un segundo cliente Redis"
---

# Items 82-86: GGA preexistentes, y superadmin tiene un segundo cliente Redis

**What**: Registrados los items 82-86 (violaciones de GGA preexistentes que bloquearon el commit del PR #229). Al verificarlos contra el codigo, el planteo original del reporte era erroneo en 3 de 5 y aparecio un problema que nadie habia registrado.

**Why**: GGA revisa archivos completos, no diffs, asi que estas 5 van a bloquear cualquier commit futuro que toque esos archivos y van a parecer hallazgos nuevos cada vez.

**Where**: `vault/03_Deuda/deuda-tecnica.md` L3328-3440. Archivos:GGA senalo → `apps/storefront/app/api/checkout/preference/route.ts:211,295`, `packages/commerce/src/redis.ts:6,8`, `apps/storefront/lib/redis.ts:2`.

**Learned**:
- **El item 85 estaba planteado al reves.** El reporte decia "el export de `redisClient` permite a los consumers hacer operaciones directas". Pero `packages/commerce/src/index.ts:30-32` dice explicitamente que el cliente crudo **NO** se reexporta del barrel, a proposito, para evitar exactamente eso. Y **ningun consumer de commerce usa `redisClient` directamente**. La exportacion existe solo porque la facade de storefront lo reexporta del deep path.
- **El problema real, sin registrar: `apps/superadmin` tiene un SEGUNDO cliente Redis.** `apps/superadmin/lib/redis.ts` crea su propio `new Redis()` con `lazyConnect: true` pero **sin `enableOfflineQueue: false` y sin `whenReady`**, y `app/api/tenants/route.ts:99` lo usa directo (`await redisClient.del(...)`). Esta en try/catch, asi que no rompe el alta, pero reproduce el problema que AGENTS.md describe: en cold-start serverless el primer comando se rechaza mientras el socket conecta, la invalidacion de cache falla y queda solo un `logger.error`. **El cache de un tenant recien creado puede quedar desactualizado sin que nadie lo note.** Por eso lo subi a MEDIA.
- **El fix propuesto para el item 84 era incorrecto.** Decia "throw en produccion si falta REDIS_URL", pero eso contradice dos reglas de AGENTS.md: la de Redis ("si Redis cae: degradar, nunca 500 — fail-open para rate limits") y la de Progresividad ("el codigo nunca debe fallar por falta de un servicio externo"). El fallback es coherente con el proyecto; lo que falta es el **silencio**, no el fallback. Fix correcto: `logger.warn` cuando se usa el fallback. Ademas el fallback esta duplicado (commerce **y** superadmin), no es 1 lugar.
- **Los items 85 y 86 son el mismo cambio**: quitar `redisClient` de la facade de storefront (85) es lo que permite que storefront importe directo de `@repo/commerce` (86).
- `payer: any` no es solo cosmetico: el objeto se **muta** (`payer.phone = {...}`) y se pasa a MP. Con `any`, una propiedad mal nombrada llega al payload de MP sin error de tipo.
- `catch (fetchError: any)` hides a real bug: en el siguiente linea se lee `fetchError.name === 'AbortError'`. Con `any`, si el rejection no es un `Error`, `.name` no existe, da `false`, y el timeout se reporta como error generico.
- GGA reporto ademas 3 observaciones no bloqueantes (duplicacion de `rateLimitKey`, CI hardcodeado en el payer, `MERCADOPAGO_ACCESS_TOKEN` leido directo). NO se registraron: son hipotesis sobre intencion, no hallazgos verificados.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-discovery]]
