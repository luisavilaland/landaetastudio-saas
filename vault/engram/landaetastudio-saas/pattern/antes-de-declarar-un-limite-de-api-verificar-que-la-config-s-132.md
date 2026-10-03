---
id: 132
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/verificar-config-de-cuenta-antes-de-declarar-limite-de-api
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 22:01:45"
updated_at: "2026-10-03 22:01:45"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Antes de declarar un limite de API, verificar que la config sea de una sola cuenta"
---

# Antes de declarar un limite de API, verificar que la config sea de una sola cuenta

**What**: Antes de concluir que un comportamiento de MercadoPago es un limite de la API, hay que descartar que el problema sea de configuracion: token y secret deben ser de la misma cuenta, y la URL del webhook debe estar registrada en esa misma cuenta.

**Why**: El spike T0 concluyo tres cosas que eran falsas (MP no entrega webhooks, H3; PUT preapproval inerte, P6; paused no funciona). Las tres se explican por una sola causa: creo los preaprovals con el token de Test-002 (3360257364) mientras la URL del webhook y el secret en Vercel eran de la cuenta plataforma real (42922495). Con la cadena consistente, todo funciono: H1 confirmada con 3 payloads reales en 1 segundo, y cancel y transaction_amount aplicando correctamente.

**Where**: Todo el spike T0 quedo invalidado por esta causa. Correccion en docs/superpowers/specs/2026-10-02-spike-t0-resultado.md (seccion Resultados finales 2026-10-03).

**Learned**: (1) Un resultado negativo de un spike no es evidencia hasta descartar el setup. El costo fue tres pagos de prueba y varias horas persiguiendo H3, una hipotesis que era falsa. (2) El sintoma de la mezcla es silencioso en las dos direcciones: 401 sin explicar si el secret es de otra cuenta, y 2xx que no aplican nada si el token es de otra cuenta. Ninguno de los dos dice cual es el problema. (3) SIGUIENTE PASO al fallar un spike: enumerar las variables de configuracion que definen la identidad de la cuenta (token, secret, URL registrada, application_id, collector_id) y verificar que todas apuntan al mismo lugar, antes de escribir una sola linea de codigo nuevo. (4) Verificar con GET, nunca confiar en el 2xx: version y last_modified que no se mueven indican que MP descarto el campo.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-pattern]]
