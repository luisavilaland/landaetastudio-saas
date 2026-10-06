---
id: 180
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 20:03:14"
updated_at: "2026-10-06 20:03:14"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Corregido drift de topics de MP en SETUP.md (3→4)"
---

# Corregido drift de topics de MP en SETUP.md (3→4)

**What**: Corregido drift en `SETUP.md` L175: la sección "MercadoPago plataforma (Fase 2)" listaba 3 topics para suscribir en el panel de MP, pero el código clasifica 4. Eran dos errores, no uno.

**Why**: Quien configurara el webhook siguiendo el documento se suscribía a 3 de 4 topics y se perdía `subscription_preapproval_plan`. El drift lo encontró la mini auditoría de T7 pero quedó sin corregir por la regla de alcance de #203.

**Where**: `SETUP.md` L175, `packages/commerce/src/mp-webhook-events.ts` (referencia), `vault/02_Bitacora/bitacora.md`

**Learned**:
- La lista autoritativa de topics es el union type `MpTopic` + los mapas `TOPIC_BY_TYPE` / `TOPIC_BY_ACTION` en `packages/commerce/src/mp-webhook-events.ts`. Salir de ahí, nunca de memoria.
- Error 1: `subscription_preapproval_plan` faltaba por completo en el doc.
- Error 2 (no detectado en el reporte original): `payment` estaba etiquetado `(legacy)` y NO lo es. Tiene handler propio `handlePayment(dataId, action, liveMode, token)` y es el único topic que necesita `live_mode` y `action`. Se quitó la etiqueta.
- `subscription_preapproval_plan` se acepta pero NO escribe estado: avisa que el plan cambió, no la suscripción. El handler devuelve `{ ignored: true }` y loguea `warn`.
- `UNKNOWN` NO es un topic que se suscriba: es el fallback tolerante de `classifyMpEvent` ante una combinación type/action no reconocida. Registra `warn` y responde 200 sin escribir. Nunca lanza.
- Patrón general: un doc que resume un enum queda desactualizado en silencio y sin test que lo detecte. La mitigación es anclar el doc al código en el mismo PR.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
