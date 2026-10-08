---
id: 217
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/item-68-h-f2-6-y-regla-202-de-plan
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:22:08"
updated_at: "2026-10-08 19:22:08"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Item 68: H-F2-6 (no H-F2-2) y /plan devuelve 202, no 502, cuando falla el GET"
---

# Item 68: H-F2-6 (no H-F2-2) y /plan devuelve 202, no 502, cuando falla el GET

**What**: Al proponer el fix del item 68 aparecieron dos hechos que cambian el plan original: (1) el ref correcto es H-F2-6, no H-F2-2. (2) /plan NO devuelve 502 cuando falla el GET de verificacion: devuelve 202.

**Why**: El brief proponia "si getPreapproval falla o verifiedAmount es null -> 502, regla de /plan". La decision (502) es correcta para /preapproval, pero la regla citada dice lo contrario.

**Where**: `apps/admin/app/api/subscriptions/plan/__tests__/route.test.ts` L345, L389, L399. `apps/admin/app/api/subscriptions/preapproval/__tests__/route.test.ts` L33-36 (PLAN.priceUyu = 4900), L132-143 (beforeEach).

**Learned**:
- **Ref: item 68 es H-F2-6.** H-F2-2 es el item 64 (`El dataId de la firma se lee solo del body`), ya resuelto el 2026-10-07. El brief traia `fix/h-f2-2-...` en el nombre de rama, el commit y el body del PR. Usado H-F2-6 en el issue #226.
- **`/plan` ante un GET fallido devuelve 202, NO 502.** Tests que lo prueban: L389 `getPreapproval` rejects -> 202 ("el PUT ya salio bien"); L399 devuelve `{}` sin `transaction_amount` -> 202; L345 rejects -> 202 + NO escribe planId. Osea: en /plan la regla "null no permite afirmar nada" significa **no escribir en DB**, no "devolver 502".
- **La divergencia 502 en /preapproval es CORRECTA y deliberada, no una copia.** En /plan la escritura a MP ya salio: un 502 diria al tenant "tu cambio fallo" cuando si salio, y eso es mentir. En /preapproval nada es usable todavia: entregar `initPoint` con monto no verificado ES el bug. El tenant todavia no pago, puede reintentar, y MP no cobra hasta que hace clic. 502 sin `initPoint` es la respuesta honesta.
- **El fix crea una nueva ruta de huerfano en MP.** Si la verificacion falla y no se escribe `mpPreapprovalId` (por "no escribir en DB"), el preapproval ya creado en MP queda huerfano: es el mismo caso que la rama `finalized === 0` (L309-326), que loguea error explicito y devuelve 409. La rama de mismatch debe loguear el huerfano tambien. La reserva `pending:<id>` sigue viva hasta su TTL de 5 min, asi que el reintento del tenant da 409 "reintenta en unos minutos": comportamiento ya diseñado y correcto.
- **Detalle de test critico:** el `beforeEach` (L132-143) necesita `getPreapproval: vi.fn()` en el mock de L25 y un default `mockResolvedValue({ transaction_amount: 49 })` (toMpAmount(4900) = 49). Sin ese default, `verifiedAmount` queda `null` en los 35 tests existentes y todos pasan a 502.
- Nota: L137 hace `vi.mocked(redisPexpire).mockResolvedValue(undefined)`, que si refleja el contrato real (void). Contrasta con el test de storefront que hace `mockResolvedValue('OK')` mockeando un contrato inexistente (evidencia del item 66).

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-discovery]]
