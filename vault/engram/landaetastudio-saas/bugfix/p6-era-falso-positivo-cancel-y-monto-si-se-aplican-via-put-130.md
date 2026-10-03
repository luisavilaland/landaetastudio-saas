---
id: 130
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:00:47"
updated_at: "2026-10-03 22:00:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "P6 era falso positivo: cancel y monto si se aplican via PUT"
---

# P6 era falso positivo: cancel y monto si se aplican via PUT

**What**: El spike T0 concluyo que PUT /preapproval/{id} era read-only despues del primer cobro (P6). Re-test del 2026-10-03 con configuracion consistente lo REFUTA: cancelar funciona (200 + GET devuelve cancelled) y mutar transaction_amount tambien (200 + GET devuelve el monto nuevo).

**Why**: El spike corrio con el token de Test-002 (3360257364) mientras la URL del webhook y el secret en Vercel eran de la cuenta plataforma real (42922495). Token de una cuenta, secret de otra: las mutaciones se ejecutaban con un token que no era del recurso y devolvian 2xx sin aplicar nada.

**Where**: docs/superpowers/specs/2026-10-02-spike-t0-resultado.md (seccion Resultados finales), docs/superpowers/specs/2026-10-01-fase2-design.md, docs/superpowers/plans/2026-10-01-fase2.md

**Learned**: (1) REGLA DE ORO: MP_PLATFORM_ACCESS_TOKEN y MP_PLATFORM_WEBHOOK_SECRET tienen que ser de la MISMA cuenta, y la URL del webhook tiene que estar registrada en esa misma cuenta. Con la cadena consistente, H1 resulto CONFIRMADA (3 payloads reales, 1s de latencia) y P6 resulto FALSO. Dos conclusiones opuestas de un mismo error de setup. (2) COMO DISTINGUIR UN 2XX QUE APLICO: version y last_modified que NO se mueven = MP descarto el campo (notification_url). Si se mueven, MP proceso el payload, pero un no-op (status authorized sobre authorized) tambien los mueve, asi que no prueban que el valor haya cambiado: para eso hay que hacer GET. (3) live_mode SOLO viene en el topic payment; los topics de suscripcion no incluyen el campo, asi que el guard live_mode === false del design solo aplica a payment y hay que tratar ausente como distinto de false. (4) next_payment_date NO cambia ni al pausar ni al cancelar: no sirve como indicador de si la suscripcion va a cobrar.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
