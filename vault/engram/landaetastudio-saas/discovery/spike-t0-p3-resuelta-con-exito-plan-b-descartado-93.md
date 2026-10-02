---
id: 93
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 16:07:41"
updated_at: "2026-10-02 16:07:41"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0: P3 resuelta con exito, plan B descartado"
---

# Spike T0: P3 resuelta con exito, plan B descartado

**What**: Spike T0 — P3 RESUELTA con el mejor resultado posible. `/authorized_payments/{id}` devuelve **tanto `preapproval_id` como `external_reference`**. Plan B (tabla `subscription_payments`) queda DESCARTADO. P2 y P5 confirmadas negativas. P1 sigue pendiente por falta de acceso a logs de Vercel.

**Why**: P3 era el riesgo #1 de Fase 2: si el invoice no expuesto ningun vinculo con la suscripcion, los cobros recurrentes no se podian enrutar a un tenant.

**Where**: Preapproval `32f3e2a8575d4797a7841d98390e52bc`, invoice `7032493379`, payment `182015873998`. PR #178 abierto.

**Learned**:
1. **P3 = SI, con ambos campos.** `GET /authorized_payments/7032493379` devuelve `preapproval_id` Y `external_reference`. Aplica la rama de coste 0 del design §2.1: `preapproval_id` → lookup local en `subscriptions.mpPreapprovalId` → tenantId, **sin llamada de red adicional**. `external_reference` queda como verificacion cruzada.
2. **Plan B DESCARTADO.** La tabla `subscription_payments` NO se necesita. Era el escenario de riesgo del design (+1 dia, +1 migracion). La unica migracion de Fase 2 sigue siendo el indice unico parcial sobre `subscriptions."mpPreapprovalId"` — que ahora esta doblemente justificado: ademas de integridad, es el mecanismo de resolucion de tenant.
3. **Como encontrar el invoice sin webhook**: `GET /authorized_payments/search?preapproval_id={id}` devuelve el listado con `id`, `status`, `external_reference` y un `payment` anidado. Ese endpoint es la via de discovery; `/preapproval/{id}/authorized_payments` y `/preapproval/{id}/last_payment` dan **404**.
4. **Payload del invoice confirmado**: `type: "recurring"`, `status: "processed"`, `payment.status: "approved"`, `payment.status_detail: "accredited"`, `transaction_amount: 100.00 UYU`, `payment_method_id: "card"`. Son los datos que el handler de T5 necesita para la transicion a `active`.
5. **P2 y P5 CONFIRMADAS negativas** (obs 92): `notification_url` no persiste ni por POST (201) ni por PUT (200). MP acepta el campo con 2xx y lo descarta en silencio. Es el peor caso posible y ya esta documentado.
6. **LIMITE OPERATIVO NUEVO**: sin `VERCEL_TOKEN` y sin `.vercel/` link, **no se pueden leer los logs de Vercel**. El stub escribe en `/tmp` (efimero e inaccesible) y loguea via `@repo/logger` (que solo se ve en el dashboard). **Consecuencia para el diseno del stub: un capture stub en Vercel es ciego para el agente.** Un spike futuro debe escribir en un destino recuperable (o leer logs con token).
7. **El pago NO se puede automatizar con Playwright**: MP usa SecureField tokenizado en tarjeta (el CVV queda `invalid` con input programatico, porque la validacion corre sobre un token que solo se genera con keystrokes reales) y valida el digito verificador de CI uruguayo en el documento (`1.234.567-8` rechazado; el check digit de 1234567 es 5, no 8). El pago lo completo Luis a mano. **Automatizar el checkout de MP es una muralla anti-bot intencional.**
8. **Estado final de T0**: 3 de 4 preguntas respondidas. P2=NO, P3=SI (optimo), P5=NO, P1 pendiente de leer logs de Vercel.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
