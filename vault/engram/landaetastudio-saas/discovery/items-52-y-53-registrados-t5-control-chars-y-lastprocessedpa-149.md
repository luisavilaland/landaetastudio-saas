---
id: 149
type: discovery
project: landaetastudio-saas
scope: project
topic_key: deuda/items-52-53-t5
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 23:50:50"
updated_at: "2026-10-04 23:50:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Items 52 y 53 registrados (T5): control chars y lastProcessedPaymentId"
---

# Items 52 y 53 registrados (T5): control chars y lastProcessedPaymentId

**What**: Items 52 y 53 registrados en `vault/03_Deuda/deuda-tecnica.md` (PR `chore/deuda-items-52-53`).

**Why**: Hallazgos de T5 que quedaron documentados en el codigo y la bitacora pero no en el registro central.

**Where**: `vault/03_Deuda/deuda-tecnica.md`, `vault/02_Bitacora/bitacora.md`

**Learned**:
- **Item 52**: el scan del item 40 solo cubre CJK y U+FFFD. Los caracteres de control (U+0000-U+0008, U+000B-U+001F) NO estan cubiertos, y en T5 tres de ellos **reemplazaron letras** (`approved` -> BEL+pproved, `validateEnv()` -> VT+alidateEnv). El archivo sigue siendo UTF-8 valido, asi que lint/tsc/vitest/prettier los pasaron con 682 tests en verde. Los encontro el hook GGA. Mitigacion: enumerar codepoints con `[int]$c`, nunca regex — un regex reporto como CJK la flecha U+2192 porque la consola la renderiza como basura.
- **Item 53**: el titulo propuesto "lastProcessedPaymentId sin uso" era **FALSO** y no se registro asi. La columna SI se usa: el handler la escribe para eventos `payment` (L522) y la lee como guarda de pago duplicado (L501), con test que lo cubre. Lo que no ocurre es que la activacion por `subscription_preapproval` guarde el invoiceId, porque su `data.id` es el id del PREAPPROVAL. Registrar el titulo corto habria invitado a borrar el campo o la guarda — el modo de fallo del item 38 invertido (esta vez codigo contra doc).
- **Decision de Luis (2026-10-04)**: solo convergencia de estado; la idempotencia es por construccion. Alternativa descartada: guardar el invoiceId con `GET /authorized_payments/search?preapproval_id={id}` en cada evento, que cuesta una llamada a MP para guardar un dato que nadie lee. Fase 3: cron de reconciliacion si hace falta auditoria.
- **BOM**: `bitacora.md` TIENE BOM UTF-8 (239 187 191); `deuda-tecnica.md` NO lo tiene. Al reescribir con `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` se **quita el BOM** y eso muestra como modificacion de la linea 1. Verificar el BOM antes y despues de cualquier reescritura de un `.md` con acentos.
- `WriteAllText` tambien introduce CRLF si el texto tiene `\r\n`; hay que normalizar a LF y volver a poner el BOM si correspondia.
- **Tercera vez** que cae en la trampa de citar CJK literal al explicar el scan de CJK (memoria 114, punto 6). El scan lo detecta al escribir el item que lo describe.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-deuda]]
