---
id: 138
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 23:29:46"
updated_at: "2026-10-03 23:29:46"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "Items 48 y 49 de deuda, item 38 marcado como superado"
---

# Items 48 y 49 de deuda, item 38 marcado como superado

**What**: Se registraron los items 48 y 49 de deuda tecnica en `vault/03_Deuda/deuda-tecnica.md` (PR #190, commit `e6f0ffc`, 162 adiciones / 1 eliminacion). El item 38 quedo marcado como superado.

**Why**: Los 2 hallazgos de T4 que no entran en el PR #189 por ser deuda, no codigo.

**Where**: `vault/03_Deuda/deuda-tecnica.md`

**Learned**:
- **Item 38 ya existia** ("Estado `paused` de MercadoPago no modelado", 2026-10-01) y CONTRADECE lo que T4 implemento: decia "no soportado en Fase 2", "el webhook registra `warn` y no transiciona", "esperar a Fase 3 para definir la semantica". La regla anti-duplicacion de AGENTS.md prohibe crear un item duplicado: se marco el 38 como superado SIN borrar su registro.
- **Por que no es cosmético**: si quien escriba T5 sigue el item 38 al pie de la letra, ignora `paused`. Pero T4 ya emite la transicion via `POST /pause` (nuestra API, no el panel de MP). Resultado: el tenant ve `active` para siempre mientras MP no cobra. Falla silenciosa, exactamente la divergencia que el 38 queria evitar.
- **La decision de producto de `paused` NO esta en ningun documento normativo**: sale del review de aprobacion de #188. Por eso vale la pena registrarla explicitamente.
- Item 48 (conversion centavos <-> unidad de moneda) es nuevo y no duplicaba nada. La correccion fue done a mano con `/100` en 2 endpoints; la helper `centsToMpAmount` en `@repo/commerce` sigue sin hacerse.
- **Tooling**: la herramienta `edit` no lograba matchear en el EOF de `deuda-tecnica.md` (si matcheaba en el medio del archivo). Workaround que funciono y respeta el item 40 del mismo archivo: redactar el texto acentuado con la herramienta `write` en un temporal y concatenar a nivel de bytes con `[System.IO.File]::WriteAllBytes`, sin recodificar el contenido existente. Despues, `prettier --write` + scan CJK/FFFD + `format:check`.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
