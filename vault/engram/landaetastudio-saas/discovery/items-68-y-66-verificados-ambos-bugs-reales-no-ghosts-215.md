---
id: 215
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/verificacion-items-68-y-66
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:01:04"
updated_at: "2026-10-08 19:01:04"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Items 68 y 66 verificados: ambos bugs reales, no ghosts"
---

# Items 68 y 66 verificados: ambos bugs reales, no ghosts

**What**: Verificacion read-only de los items 68 y 66. Ambos son bugs REALES, no ghosts. Item 66 tiene 2 call sites (admin + storefront), no 1.

**Why**: Luis pidio confirmar si existen hoy en codigo antes de gastar un PR. Ambos figuraban como "verificado en codigo: no".

**Where**: item 68 -> `apps/admin/app/api/subscriptions/preapproval/route.ts` L262-331 vs `plan/route.ts` L260-309. Item 66 -> `packages/commerce/src/redis.ts` L106-111, `apps/admin/lib/subscriptions/handlers.ts` L137-139, `apps/storefront/app/api/checkout/preference/route.ts` L28-30.

**Learned**:
- **Item 68 (ALTA, dinero).** POST /preapproval manda `transactionAmount` y devuelve `init_point` con un presence-check (L283), sin GET a MP. El PUT de `/plan` SI verifica (L264 `getPreapproval`, L268 lee `transaction_amount`, L274-287 devuelve 502 si no coincide, L304 gatea el write). Asimetria en el mismo repo y la misma preocupacion. `getPreapproval` YA EXISTE y esta exportado (`mp-subscriptions.ts:212`), con doc que dice que un 2xx de MP no prueba que la operacion se aplico. Los 35 tests del archivo no mencionan `getPreapproval` ni verifican monto: el test L184 "manda el precio en la moneda de MP" asserta el ARGUMENTO enviado (`mock.calls[0]`), no lo aplicado. `mp-amounts.ts` documenta que PR #189 shipped un cobro 100x en ESTE endpoint.
- **Item 66 (MEDIA-ALTA).** `redisPexpire` devuelve `Promise<void>` y descarta el `null` de `safeRun`, asi que un pexpire fallido es indistinguible de uno exitoso a nivel de tipos: estruturalmente no verificable. El `count === 1` hace que ningun request posterior reintente el TTL, asi que la clave queda sin TTL para siempre y el 429 es permanente (deberia expirar a los 60s). Agrava: el `redisIncr` de la MISMA funcion SI se verifica (L132 fail-open), solo el write del TTL no. El test de storefront hace `mockRedisPexpire.mockResolvedValue('OK')` mockeando un contrato que la implementacion no tiene: es el punto ciego del item 61.
- El item 66 NO es solo de admin: `apps/storefront/lib/redis.ts:7` re-exporta la MISMA funcion `void` y `checkout/preference/route.ts:29` tiene el mismo patron. Alcance: 2 apps.
- NO se bajo a}~ el repo. `develop` en `1090c85` intacto.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-discovery]]
