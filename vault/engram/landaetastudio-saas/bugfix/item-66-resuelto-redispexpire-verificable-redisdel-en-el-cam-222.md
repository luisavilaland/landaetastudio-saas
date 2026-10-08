---
id: 222
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/item-66-redis-pexpire-verificable
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 20:08:59"
updated_at: "2026-10-08 20:08:59"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 66 resuelto: redisPexpire verificable + redisDel en el camino de fallo"
---

# Item 66 resuelto: redisPexpire verificable + redisDel en el camino de fallo

**What**: Item 66 (H-F2-4) resuelto. `redisPexpire()` paso de `Promise<void>` a `Promise<boolean>` en `packages/commerce/src/redis.ts`, copiando la forma de `redisPing` (`result === 1`). En el camino de `false`, los 2 call sites hacen `redisDel` de la clave. Item 66 de MEDIUM a MEDIA-ALTA y a RESUELTO.

**Why**: La funcion descartaba el resultado de `safeRun`, asi que un `pexpire` fallido era indistinguible de uno exitoso a nivel de tipos. La clave quedaba sin TTL, el contador subia sin reintento (el `count === 1` no se repite) y se llegaba a un 429 permanente por IP con ventana de 60s.

**Where**: `packages/commerce/src/redis.ts`, `apps/admin/lib/subscriptions/handlers.ts:137-153`, `apps/storefront/app/api/checkout/preference/route.ts:28-42`, `packages/commerce/src/redis.test.ts` (nuevo), los 2 tests de call site, `vault/03_Deuda/deuda-tecnica.md` (items 66, 80, 81), issue #228.

**Learned**:
- **Fail-open sin autoreparacion no es fail-open, es solo un log.** Log + fail-open en el camino de fallo deja pasar ESE request pero no deshace nada: `count === 1` no se repite, nadie reintenta el TTL, la clave sigue sin vencimiento y el 429 permanente ocurre igual. Lo que hace falta es `redisDel`, para que el siguiente request vuelva a ver `count === 1` y reintente. Degradacion aceptable: el rate limit puede no aplicarse. Degradacion inaceptable: el tenant bloqueado para siempre. El item decia "fail-closed es un DoS construido a proposito" y la propuesta original del brief (solo loguear) era exactamente eso.
- **`apps/admin/tsconfig.json` excluye `**/__tests__/**`, y los mocks son `vi.fn()` sin tipar.** Por eso `mockResolvedValue('OK')` sobre una funcion `void` pasaba el DoD en verde: `tsc` nunca vio el contrato. Corregir los mocks es parte del fix; si no, quedan mentirosos y los tests pasan sin quejarse.
- **`redis.ts` no tenia NINGUN test** (11 archivos en `packages/commerce/src/__tests__`, ninguno suyo). `redisPing`, el patron a copiar, tampoco. La firma nueva no estaba verificada en ninguna parte.
- **`result === 1` mapea dos fallos distintos al mismo `false`:** ioredis devuelve `0` si la clave no existe, y `safeRun` devuelve `null` ante error. En los dos casos el TTL no quedo aplicado, que es lo unico que el caller necesita afirmar.
- **Detalle de mock que rompia tests:** el factory `vi.mock('@/lib/redis', ...)` de storefront no usa `...actual`, asi que al sumar `redisDel` al import de la route, `redisDel` quedaba `undefined` y llamarlo tiraba TypeError. Hay que agregarlo al factory.
- **Trazabilidad — segunda vez en dos PRs:** el hallazgo del item 66 es **H-F2-4**, no H-F2-7 (que es el item 69, doble POST concurrente, ya resuelto en #222). El brief traia H-F2-7. El mapeo item ↔ hallazgo esta en la tabla de `auditoria-fase2.md` y en la tabla de `deuda-tecnica.md` (~L2600); hay que leerlo antes de nombrar una rama. La anterior fue H-F2-2 en vez de H-F2-6.
- Verificacion en rojo: con el codigo fuente en `git stash`, 6 de los 11 tests nuevos fallan. Los 2 que NO fallan son los de "no borra cuando el TTL se aplico": sin el fix `redisDel` nunca se llama, asi que `not.toHaveBeenCalled()` pasa. Igual sirven, peroProtegen contra el error opuesto (borrar sin condiciones), no contra la ausencia del fix.
- DoD: 753/753 en 71 archivos (742 + 11).

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
