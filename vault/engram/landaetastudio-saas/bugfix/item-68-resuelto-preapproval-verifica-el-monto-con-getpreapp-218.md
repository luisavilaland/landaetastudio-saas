---
id: 218
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/item-68-preapproval-verifica-monto
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:37:58"
updated_at: "2026-10-08 19:37:58"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 68 resuelto: /preapproval verifica el monto con getPreapproval"
---

# Item 68 resuelto: /preapproval verifica el monto con getPreapproval

**What**: Item 68 (H-F2-6) resuelto. `POST /api/subscriptions/preapproval` ahora llama `getPreapproval` despues de `createPreapproval`, compara `transaction_amount` contra `toMpAmount(plan.priceUyu)` y devuelve `502` sin `initPoint` si no coincide o si no se pudo verificar. 4 tests nuevos, verificados en rojo sin el fix. Severidad subida de MEDIUM a ALTA.

**Why**: El endpoint mandaba el monto a MP y devolvia el link de pago con un presence-check (L283), sin GET. Un 2xx de MP no prueba que el campo haya quedado aplicado, y este endpoint ya habia shipped un cobro 100x en #188/#189.

**Where**: `apps/admin/app/api/subscriptions/preapproval/route.ts` (+69), `apps/admin/app/api/subscriptions/preapproval/__tests__/route.test.ts` (+99), `vault/03_Deuda/deuda-tecnica.md` item 68, `vault/02_Bitacora/bitacora.md`, issue #226.

**Learned**:
- **La divergencia 502 vs 202 con `/plan` es deliberada y documentada en el codigo.** `/plan` ante un GET fallido devuelve 202 + no escribe en DB, porque la escritura a MP ya salio y un 502 diria "tu cambio fallo" cuando si salio. `/preapproval` devuelve 502 sin `initPoint` porque el tenant todavia no pago y entregarle el link con monto sin verificar ES el bug. Mismo patron, semantica opuesta. Copiar `/plan` al pie de la letra habria reintroducido el bug.
- **El impacto de no verificar no es solo el monto: crea un huerfano en MP.** Al no escribir `mpPreapprovalId` (por "no afirmar lo no verificado"), el preapproval ya creado queda huerfano. Se loguea con el id explicito, igual que la rama `finalized === 0`. La reserva `pending:<id>` sigue viva hasta su TTL de 5 min, asi que el reintento del tenant da 409 "reintenta en unos minutos".
- **Los 4 tests se probaron en rojo:** con `git stash push` solo del route.ts, los 4 fallan y con el fix pasan. Sin ese chequeo no se sabe si prueban algo.
- **El default del `beforeEach` era el riesgo real:** `getPreapproval` con `{ transaction_amount: 49 }` (`PLAN.priceUyu = 4900` -> `toMpAmount`). Sin ese default los 34 tests previos pasaban a 502.
- **Test D no se escribio porque ya existia** (L200, "manda el precio en la moneda de MP") y asserta `transactionAmount: 49`. Duplicarlo habria sido ruido.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
