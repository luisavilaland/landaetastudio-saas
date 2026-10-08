---
id: 207
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 13:14:23"
updated_at: "2026-10-08 13:14:23"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Mojibake en test: GGA excluye *test.ts y no hay red para archivos de test"
---

# Mojibake en test: GGA excluye *test.ts y no hay red para archivos de test

**What**: Corregido doble encoding UTF-8→cp1252 en `apps/admin/app/api/subscriptions/preapproval/__tests__/route.test.ts`: 14 caracteres corruptos (`dueÃ±o`→`dueño`, `dueÃ±a`→`dueña`, `reintentÃ¡`→`reintentá`, `â€"`×11→`—`) y BOM eliminado. Commit `e5737c2` en el PR #222. Corregido por Node reconstruyendo los bytes cp1252 y re-decodificando como UTF-8, con assertions que abortaban si quedaba mojibake o si el buffer no era UTF-8 válido.

**Why**: Detectado por Luis en el review de #222. El archivo seguía siendo UTF-8 **válido**, así que ESLint, tsc, vitest y prettier no lo ven: los 727 tests pasaban con el mojibake presente. El test de `payerEmail` afirmaba contra `'dueÃ±o@tenant.com'` y pasaba igual, porque el mock y la aserción compartían la misma cadena corrupta.

**Where**: `apps/admin/app/api/subscriptions/preapproval/__tests__/route.test.ts`. Origen: un `Get-Content -Raw` sin `-Encoding UTF8` seguido de `Set-Content -Encoding UTF8`, mío, para hacer un reemplazo puntual.

**Learned**: (1) **GGA NO cubre archivos de test.** `.gga:40` tiene `EXCLUDE_PATTERNS="*test.ts,*spec.ts,*d.ts,..."` y al commitar el fix el hook respondió literalmente *"No matching files staged for commit"*. La memoria obs 142 afirma que "GGA es el único control que detecta doble encoding" — eso es cierto para código de producción (el mojibake que GGA detectó antes estaba en `preapproval/route.ts`) pero **deja los tests sin ninguna red**. Es un gap real: los tests son justamente donde un string corrupto queda consagrado por una aserción. (2) **La corrupción UTF-8 sobrevive a todos los checks automáticos por definición**: si los bytes son UTF-8 válido, nada tiene qué quejarse. Por eso la verificación tiene que ser por codepoints, no por grep — un grep no distingue `Ã±` (2 chars) de `ñ` (1 char). (3) **Me diagnosticé el mismo error y volví a caerlo.** Horas antes detecté que `Get-Content` sin `-Encoding UTF8` deforma UTF-8 (por eso un chequeo de CJK me dio falso "0 caracteres"), lo documenté, y después usé exactamente esa secuencia para editar. Conocer la causa no previene el error: previene el que lo va a buscar, si después uno seTIME de verificar. (4) **Comparar `git show` a través de PowerShell por pipe da lecturas falsas**: el pipe decodifica y recodifica con el codepage de consola. Con eso medí 34 U+FFFD "nuevos" en `bitacora.md` que en realidad son preexistentes en `develop` (0 vs 34 era artefacto de medición). Para comparar bytes hay que escribir a archivo. (5) `bitacora.md` tiene 34 U+FFFD + 9 mojibake y `deuda-tecnica.md` 1 + 2 — **preexistentes en develop, idénticos**. No introductions, no los toqué: son contenido histórico en archivos append-only.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
