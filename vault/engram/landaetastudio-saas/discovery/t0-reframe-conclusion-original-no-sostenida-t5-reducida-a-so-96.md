---
id: 96
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 19:10:20"
updated_at: "2026-10-02 19:10:20"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "T0 reframe: conclusion original no sostenida, T5 reducida a sonda de 1 dia"
---

# T0 reframe: conclusion original no sostenida, T5 reducida a sonda de 1 dia

**What**: REFRAME del spike T0. La conclusion anterior ("MP no entrega webhooks de suscripciones por ninguna via") **no esta sostenida**. P1 vuelve a PENDIENTE. T5 no queda invalidada: se reduce a una sonda de 1 dia. T9 (polling) queda como fallback condicional.

**Why**: Luis completo el wizard "Configura tu integracion" pero el panel sigue en "ETAPA 1 DE 5", y el Flujo B funciona en `tienda1.landaetastudio.com` (dominio real). Eso abre la hipotesis de que MP no entrega a preview domains de Vercel.

**Where**:
- `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md` - reframe con tabla de hipotesis
- `docs/superpowers/plans/2026-10-01-fase2.md` - T5 = sonda (1 dia), T9 = fallback condicional, grafo y estimaciones
- `docs/superpowers/specs/2026-10-01-fase2-design.md` - §2.4 resuelto, §5.1 anotado, tabla de preguntas P1-P10, riesgos R1/R2

**Learned**:

1. **ERROR PROPIO QUE SE CORRIGE: el spike anterior concluyo H3 (MP no entrega nunca) sin descartar H1 ni H2.** Se asumio que el topic de suscripcion estaba suscrito en el panel de MP. **Esa asuncion nunca se verifico.** Confundir "no hubo entrega" con "no hay entrega posible" es un salto logico invalido. La ausencia de entrega esta verificada con control; la CAUSA no.

2. **Evidencia dura a favor de H1 (dominio importa):** `apps/storefront/app/api/webhooks/mercadopago/route.ts:234` es el **UNICO** punto donde una orden del storefront pasa a `confirmed`. No existe ruta sincronica de confirmacion - `back_urls` solo redirigen el navegador. Por lo tanto que el Flujo B funcione en `tienda1.landaetastudio.com` **implica** que MP entrega webhooks a dominios de produccion. La infraestructura de MP funciona; lo no probado es el scope de suscripciones en el dominio del admin.

3. **H2 no esta descartada y es la mas barata de probar:** no hay topic de suscripcion suscrito en el panel. El "ETAPA 1 DE 5" que reporto Luis es evidencia a favor. Si ningun topic esta activo, MP no envia nada **independientemente del dominio**. Se descarta con 5 minutos mirando el panel, antes de escribir una linea de T5.

4. **T5 se reduce de 2.5 dias a 1 dia.** El stub de captura YA existe. Para descartar H1 no hace falta el handler de 8 transiciones: alcanza con endurecer el stub (firma HMAC via `verifyMercadoPagoSignature`, limite de tamano de body, log sin PII sin persistir body crudo), deployar a `admin.landaetastudio.com`, apuntar el panel de MP ahi y pagar. Esa rebanada es reutilizable por T5.

5. **El stub actual NO es apto para produccion:** no verifica firma (cualquiera POSTea), no limita tamano de body (POST gigante a disco), loguea metadata sin restraint y escribe body crudo. Endurecerlo es pre-requisito, no opcional.

6. **Estimacion por escenarios:** webhook funciona = 10 dias (T9 no se construye). webhook falla = 12.5 dias (T9 completo).

7. **P2/P3/P5/P6 siguen firmes, sin cambio.** En particular P6 (PUT /preapproval/{id} de solo lectura post-cobro) deja cancel/reactivate/plan sin backend. Los 3 endpoints devuelven 202 pero la operacion NO ocurre. Anotado en §5.1 del design.

8. **Deuda que sigue pendiente:** dos preapprovals de test autorizados con cobro agendado el 2026-11-02 (`32f3e2a8575d4797a7841d98390e52bc` y `f7b02efc00cb4638a0fe25da2013018d`). Cancelar desde el panel de MP; la API no funciona.

9. **PR #178 sigue CONFLICTING** por `vault/engram/_sessions/ses_f087e3bfcffew6S7dZjBCkv3lW.md`. Resolucion propuesta: merge de develop a la branch + re-correr `pnpm vault:export` para que la herramienta regenere el archivo. No mergear a develop.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
