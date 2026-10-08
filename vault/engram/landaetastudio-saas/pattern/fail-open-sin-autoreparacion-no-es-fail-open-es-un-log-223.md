---
id: 223
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/fail-open-sin-autoreparacion-no-es-fail-open
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 20:09:12"
updated_at: "2026-10-08 20:09:12"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Fail-open sin autoreparacion no es fail-open, es un log"
---

# Fail-open sin autoreparacion no es fail-open, es un log

**What**: Patron: "fail-open" no es una decision, es una condicion que hay que distinguir de "degradar sin verificar nada". Fail-open sin mecanismo de autoreparacion deja el bug intacto: solo lo hace visible.

**Why**: El item 66 cerro con esta distincion. La propuesta original (loguear el fallo y aceptar la key sin TTL) sounds a fail-open y en realidad es un fail-open de un solo request: la clave sigue sin TTL, el contador sigue subiendo y el 429 permanente ocurre igual.

**Where**: `apps/admin/lib/subscriptions/handlers.ts:137-153`, `apps/storefront/app/api/checkout/preference/route.ts:28-42`. Contraste con `handlers.ts:129-135`, que si degrada correctamente porque el camino de fallo **no deja estado colgando**.

**Learned**:
- **La pregunta que separa fail-open real de fail-open cosmetico: "que queda colgando despues de dejar pasar este request?"** Si la respuesta es "un estado que nadie va a corregir", no es fail-open: es fail-open de un request con fail-closed para todos los siguientes. El fix del item 66 fue `redisDel` justamente para que el estado no quedara colgando.
- **Un degrade que deja estado sin TTL, sin expiracion o sin reconciliacion es un fail-closed diferido**, aunque el request actual pase. El codigo lo decia sin decirlo: el docstring de `handlers.ts:114-118` ya reconocia que el rate limit es "proteccion, no funcionalidad critica", y el item estaba en contradiccion directa con eso.
- **El mecanismo de autoreparacion debe existir aunque el caller no pueda hacer nada.** Prefijar el TTL a la operacion que crea la clave es la forma barata; borrar la clave es la forma cuando el TTL ya se fijo por separado y fallo.
- **Relacion con H-F2-6 (item 68):** ahi la divergencia fue al reves — `/plan` NO debe degradar a error porque la escritura ya salio, y `/preapproval` SI porque nada se entrego todavia. El criterio unico en los dos casos es "que se pierde si no se afirma nada": plata ya cobrada vs un link de pago sin verificar.
- **Corolario de tests:** un degrade que nadie observa es indistinguible de no tener degrade. Por eso los tests tienen que afirmar el efecto (la clave se borra, el proximo request reintenta), no solo que se devuelve `true`.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
