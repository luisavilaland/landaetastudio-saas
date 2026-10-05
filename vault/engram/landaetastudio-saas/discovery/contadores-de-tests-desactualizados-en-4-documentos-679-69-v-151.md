---
id: 151
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 00:35:35"
updated_at: "2026-10-05 00:35:35"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Contadores de tests desactualizados en 4 documentos: 679/69 vs 678/68 real"
---

# Contadores de tests desactualizados en 4 documentos: 679/69 vs 678/68 real

**What**: Los 4 documentos que llevan el contador de tests (README.md L515, SETUP.md L454, TESTING.md L295/L331, TESTING-MANUAL.md L225) dicen **679 tests en 69 archivos**. La medicion real es **678 tests en 68 archivos**. Descuadre de +1 en ambos numeros, en los 4 archivos.

**Why**: Incumple la regla "DoD extendido - actualizar contadores" de AGENTS.md. La ultima entrada de bitacora de T5 registra 670/68; los docs dicen 679/69. Alguien ajusto el numero a mano sin correr `pnpm test`.

**Where**: README.md, SETUP.md, TESTING.md, TESTING-MANUAL.md

**Learned**:
- La regla de conteo real: 83 archivos `*.test.ts`/`*.spec.ts` en `apps/`+`packages/`+`e2e/`. Los 15 de `e2e/` corren con Playwright, no con vitest. 83 - 15 = 68, que es exactamente lo que vitest reporta. Con esa aritmetica se puede detectar un contador erroneo sin correr la suite.
- Un doc puede estar desactualizado y aun asi "verse" bien: 679 es plausible, 69 tambien. Solo el contraste con la salida real lo delata.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
