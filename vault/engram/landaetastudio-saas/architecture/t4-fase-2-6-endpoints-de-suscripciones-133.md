---
id: 133
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:35:10"
updated_at: "2026-10-03 22:35:10"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "T4 Fase 2: 6 endpoints de suscripciones"
---

# T4 Fase 2: 6 endpoints de suscripciones

**What**: Se implementaron los 6 endpoints de suscripciones de Fase 2 (T4) en `apps/admin/app/api/subscriptions/`: `POST /preapproval`, `GET /`, `POST /cancel`, `POST /pause`, `POST /resume`, `PUT /plan`. Los tres de mutacion comparten `apps/admin/lib/subscriptions/mutate.ts`.

**Why**: T4 del plan de Fase 2. El scope humano (6 endpoints con pause/resume) es mas nuevo que el design/plan mergeados en develop, que aun describen 5 endpoints con `reactivate`.

**Where**:
- `apps/admin/app/api/subscriptions/{preapproval,route,cancel,pause,resume,plan}`
- `apps/admin/lib/subscriptions/{handlers.ts,mutate.ts}`
- tests: 13 + 26 + 25 + 28 = 92 casos en admin

**Learned**:
- `cancel` devuelve 202 (asincrono): el estado local lo escribe el webhook, no el endpoint. Escribirlo en el handler daria estado optimista que puede no llegar.
- `preapproval` guarda el `mpPreapprovalId` en una **2da transaccion explicita**: si fallara, MP ya tiene el preapproval y la DB no lo sabria.
- Doble click en `preapproval` -> 409 con el preapproval existente, no crear otro (evita suscripciones huerfanas en MP).
- `PUT /plan` devuelve **402** en upgrade con el monto a cobrar; la UI arma el checkout. Meter cobro tarjeta a tarjeta en el endpoint seria una operacion financiada fuera de alcance.
- 619 tests / 66 archivos (baseline develop: 523/62).

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
