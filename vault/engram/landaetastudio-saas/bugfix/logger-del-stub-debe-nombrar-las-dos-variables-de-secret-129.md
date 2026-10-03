---
id: 129
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 19:23:59"
updated_at: "2026-10-03 19:23:59"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Logger del stub debe nombrar las dos variables de secret"
---

# Logger del stub debe nombrar las dos variables de secret

**What**: El logger.error del stub de suscripciones deia MERCADOPAGO_WEBHOOK_SECRET not configured cuando el secret activo ya era MP_PLATFORM_WEBHOOK_SECRET ?? MERCADOPAGO_WEBHOOK_SECRET. Corregido a un mensaje que nombra las dos variables.

**Why**: T5 diagnostica con ese log. Si devolviera 503, el mensaje apuntaba a una sola variable e hacia investigar el lado equivocado: revisar MERCADOPAGO_WEBHOOK_SECRET en Vercel cuando el problema podia ser MP_PLATFORM_WEBHOOK_SECRET.

**Where**: apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts, rama chore/fix-webhook-subscriptions-secret, PR 187

**Learned**: (1) Un mensaje de diagnostico es parte del contrato del modulo, no decoracion: cuandoCambias QUE variable lee el codigo, el mensaje tiene que cambiar con ella, o actively manda a leer el log equivocado. (2) El body del 503 se dejo intacto ("Webhook not configured") a proposito: es la respuesta publica y nombra la condicion, no la variable. Solo cambia el log interno. El test existente asserta ese body y sigue verde; los tests nofellaron y el contador quedo en 523 porque el cambio es un string. (3) Al verificar note que la bitacora tiene dos entradas historicas (L976-977) que mencionan un artefacto CJK que ya fue corregido en SECURITY.md: son registro del fix, no mojibake activo, y no se tocan.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
