---
id: 128
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 19:04:31"
updated_at: "2026-10-03 19:04:31"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Bug: el stub de suscripciones validaba con el secret del tenant"
---

# Bug: el stub de suscripciones validaba con el secret del tenant

**What**: El stub del webhook de suscripciones en apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts verificaba la firma contra MERCADOPAGO_WEBHOOK_SECRET (secret del TENANT, Flujo B) en vez de MP_PLATFORM_WEBHOOK_SECRET (secret de PLATAFORMA, Flujo A). Fix: MP_PLATFORM_WEBHOOK_SECRET ?? MERCADOPAGO_WEBHOOK_SECRET, con fallback al del tenant para dev/preview.

**Why**: Los webhooks de suscripciones llegan de la cuenta de plataforma y se firman con el secret de plataforma. Con el equivocado, un webhook que SI llega produce 401 Invalid signature, indistinguible de no-llego mirando access logs. Eso invalidaba la medicion de T5 (H1 vs H3) y obligaba a gastar un pago real sin poder concluir nada.

**Where**: apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts (linea del secret), y el suite nuevo en subscriptions/__tests__/route.test.ts (6 casos). Rama chore/fix-webhook-subscriptions-secret.

**Learned**: (1) El bug llevaba dias en develop sin ser observable porque en el spike T0 el stub corria en un preview domain donde nunca llego ningun webhook: la linea nunca se ejecuto contra una firma real. Un stub nunca ejercitado es codigo sin verificar, por mas que tenga tests de forma. (2) La asercion que lo atrapa: con ambos secrets configurados, una firma hecha con el secret del TENANT debe dar 401. Antes daba 200. Esa inversion (200 donde debia ser 401) es la firma exacta de un secret equivocado. (3) Verificacion del stub en produccion antes del fix: POST sin x-significate 401 Missing signature, POST con firma invalida 401 Invalid signature, POST con body mayor a 100 KB 413, GET 405. O sea H1 tiene su precondicion cumplida: el endpoint existe y responde en admin.landaetastudio.com, un dominio de produccion real. (4) Los dos secrets viven en el mismo proyecto de Vercel perofirmando flujos distintos: MERCADOPAGO_WEBHOOK_SECRET para ordenes de tienda del tenant, MP_PLATFORM_WEBHOOK_SECRET para suscripciones de la plataforma. Confundirlos es el error de arquitectura mas probable al tocar webhooks.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
