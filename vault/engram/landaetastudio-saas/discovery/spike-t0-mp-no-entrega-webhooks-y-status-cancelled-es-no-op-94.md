---
id: 94
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 17:59:24"
updated_at: "2026-10-02 17:59:24"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0: MP no entrega webhooks y status:cancelled es no-op silencioso"
---

# Spike T0: MP no entrega webhooks y status:cancelled es no-op silencioso

**What**: Spike T0 — Vercel Auth era la causa del bloqueo (resuelto por Luis). Con Auth off, MP **sigue sin entregar ningún webhook** ni para el pago ni para la cancelación. Y hallazgo crítico nuevo: **`PUT /preapproval/{id} {status: "cancelled"}` devuelve 200 pero NO hace nada**. Con `"canceled"` (1 L) → 400 inválido.

**Why**: T0 debía confirmar que la entrega de webhooks funciona. No funciona por ninguna vía probada.

**Where**: Preapproval `32f3e2a8575d4797a7841d98390e52bc` (quedó en `authorized`, no se pudo cancelar). Vercel preview `saas-admin-git-chore-spike-aacf8b-...`.

**Learned**:
1. **Vercel Auth SÍ bloqueaba los webhooks.** Luis lo desactivó. Verificado: POST anónimo al endpoint ahora devuelve **200**. Antes presumably rechazaba. Por eso los webhooks de MP no llegaban tras el pago de las 12:05.
2. **MP NO entrega webhooks de suscripciones por ninguna via probada.** Log completo del preview: solo 3 POSTs al endpoint, **los 3 mios** (2 self-check + 1 probe anónimo). Ni el pago (`status: authorized`, `charged_quantity: 1`, `last_charged_date: 12:05:11`) ni los dos PUT de cancelacion generaron entrega.
3. **HALLAZGO CRITICO: `PUT /preapproval/{id} {status: "cancelled"}` → HTTP 200 SIN EFECTO.** Verificado por GET posterior: `status` sigue `authorized` y `last_modified` no cambio (12:05:13). Con `"canceled"` (una sola L, como dice la doc de MP) → **400 "Invalid preapproval status param: canceled"**. **Ninguna de las dos grafias funciona.** Esto rompe el spec transversal §6 y el design §3.3, que ambos especifican `status: "cancelled"` para la cancelacion.
4. **Patron unificador del spike: MP devuelve 2xx y descarta el campo en silencio.** Confirmado en 3 casos independientes: `notification_url` en POST (201), `notification_url` en PUT (200 + sube version), `status: "cancelled"` en PUT (200). Ninguno toma efecto. **Un 2xx de MP no es evidencia de que la operacion se haya aplicado.siempre hay que verificar con GET.**
5. **Consecuencia para T5**: la cancelacion y la reactivacion (`PUT status`) **no son confiables** con este contrato. Si ni siquiera `cancelled` aplica, la API de MP para managing estado de preapprovals necesita re-investigacion antes de escribir el handler.
6. **Token de Vercel**: funciona con `--scope luis-avilas-projects-9a14c370` (por defecto apunta a `edgar-s-projects5` y falla). El scope correcto es obligatorio. Comando: `vercel logs <url> --scope luis-avilas-projects-9a14c370 --token $env:VERCEL_TOKEN --json`. El JSON de Vercel usa `requestPath`/`requestMethod` a nivel raiz (no `request.path`) y el detalle del log viene en el array `logs[]` con el mensaje como JSON string anidado.
7. **Vercel Auth desactivado en previews es un finding operativo**: cualquier preview deploy es publicamente accessible salvo que se active Vercel Auth. Para webhooks es lo correcto, pero es un vector de exposicion que conviene documentar.

**Estado de T0**: P1 = NO RESUELTA (no hay entrega). P2 = NO persiste. P3 = SI, optimo (`preapproval_id` + `external_reference`). P5 = NO persiste. P6 (nuevo) = `status: cancelled` no aplica.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
