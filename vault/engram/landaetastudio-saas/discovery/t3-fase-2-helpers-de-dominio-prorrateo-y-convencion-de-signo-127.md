---
id: 127
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 18:25:39"
updated_at: "2026-10-03 18:25:39"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "T3 Fase 2: helpers de dominio, prorrateo y convencion de signos"
---

# T3 Fase 2: helpers de dominio, prorrateo y convencion de signos

**What**: T3 de Fase 2 creo tres funciones puras y un cliente HTTP en packages/commerce: derivePermissions (matriz de 6 estados x 6 permisos), calculateProration (formula de prorrateo con now inyectable) y classifyMpEvent (clasificador de topics de MP), mas mp-subscriptions (wrapper de fetch). 31 tests nuevos, total 517 en 61 archivos.

**Why**: T3 del plan de Fase 2 (issue 167). Son la base de T4 (endpoints) y T5 (webhook). Ninguna toca DB ni red, asi que se testean sin mocks.

**Where**: packages/commerce/src/subscription-permissions.ts, subscription-proration.ts, mp-webhook-events.ts, mp-subscriptions.ts, y sus 3 suites en __tests__/

**Learned**: (1) CONVENCION DE SIGNOS DEL PRORRATEO: proratedAmountCents NEGATIVO = el tenant DEBE una diferencia (upgrade); POSITIVO = el tenant tiene saldo a favor (downgrade). Es lo que dice la formula (precioActual - precioNuevo) x diasRestantes/diasPeriodo y las notas del transversal seccion 5. (2) Tres contradicciones entre plan, prompt y transversal, resueltas a favor del transversal: el prompt decia que negativo era saldo a favor (incorrecto, su propia formula y la tabla del plan dicen lo contrario); el plan decia que con periodo completo el prorrateo es 0 (falso: con 30/30 el resultado es el precio completo, solo da 0 si el precio no cambia); y el prompt pedia clampar a 0 el periodo vencido mientras el plan pedia error de dominio (implementado: throw, porque un 0 silencioso se lee como no hay nada que cobrar y el endpoint confirmaria un cambio de plan no cobrado). (3) canCancel y canReactivate NO son transcripcion de la tabla del seccion 2: esa tabla no tiene fila para cancelar ni reactivar. Se derivaron del detalle por estado: cancelar solo desde active, reactivar desde cancelled y expired, y abandoned NO reactiva porque su boton es Completar pago (flujo de alta). (4) classifyMpEvent es deliberadamente el UNICO lugar del codigo donde se fijan los literales de topic de MP, para que T5 los actualice en un commit dedicado. Devuelve UNKNOWN en vez de lanzar. (5) En este repo, NUNCA escribir .md con cmdlets de PowerShell: Get-Content -Raw mas WriteAllText aplico doble encoding a README, SETUP, TESTING y TESTING-MANUAL. Se revirtio con git checkout y se rehizo con la herramienta de edicion.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
