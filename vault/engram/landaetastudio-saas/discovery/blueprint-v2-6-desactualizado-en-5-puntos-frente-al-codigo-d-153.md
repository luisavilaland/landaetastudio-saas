---
id: 153
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 00:36:57"
updated_at: "2026-10-05 00:36:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Blueprint v2.6 desactualizado en 5 puntos frente al codigo de Fase 2"
---

# Blueprint v2.6 desactualizado en 5 puntos frente al codigo de Fase 2

**What**: `docs/superpowers/specs/2026-09-blueprint-v2.6.md` quedo atrasado respecto del codigo en 5 puntos verificables de Fase 2. Ademas estima la Fase 2 en "3-4 dias" mientras el plan real `docs/superpowers/plans/2026-10-01-fase2.md` la estima en 10.

**Why**: El blueprint se escribio antes del spike T0 y no se toco cuando el spike refuto tres de sus supuestos. Es la causa raiz de items de deuda que siguen abiertos (35, 37, 9).

**Where**: `docs/superpowers/specs/2026-09-blueprint-v2.6.md`

**Learned** (contradicciones verificadas una por una contra el codigo):
- L104 "(6 estados)" y la tabla L106-113: el codigo tiene **7** (`paused` incluido) y el transversal ya dice "(7 estados)".
- L258 webhook en `/api/webhooks/mercadopago/subscriptions/:tenantId`: imposible, MP registra una URL literal sin path templating. El codigo expone la ruta sin `:tenantId` y resuelve el tenant por `mpPreapprovalId`. Es el item 37 de deuda, abierto.
- L260 eventos `preapproval.created` / `preapproval.canceled`: esos nombres no existen. Los topics reales son `subscription_preapproval`, `subscription_authorized_payment`, `payment`. Es el item 35, abierto.
- L229-231 schema con `tenant_id` / `plan_id` / `mp_preapproval_id`: el schema real es camelCase. Es el item 9, abierto.
- L255 Fase 2 "3-4 dias" vs las 10 del plan vigente.
- `vault/05_Specs/arquitectura.md` dice "Ultima revision: 2026-09-17" y su seccion "Blueprint vigente" no indexa el plan/spec/design de Fase 2.

Conclusion operativa: el blueprint no sirve como fuente de verdad para construir. La cadena real es transversal (spec) -> design -> plan. Actualizar el blueprint es una tarea con nombre propio, no un retoque.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
