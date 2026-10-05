---
id: 157
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 01:50:19"
updated_at: "2026-10-05 01:50:19"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Items 54 y 55 de deuda registrados (PR #196) y me inyecte CJK al escribir"
---

# Items 54 y 55 de deuda registrados (PR #196) y me inyecte CJK al escribir

**What**: Items 54 y 55 de deuda tecnica registrados en `vault/03_Deuda/deuda-tecnica.md` (append, 131 lineas, 0 borrados). Commit `21136fc`, PR #196 abierto y **NO mergeado** (espera review). Incluye los 2 exports de Engram que quedaban pendientes.

**Why**: El humano decidio arrancar la auditoria mid-phase sin bloquearse por el working tree, pero registrar antes los 2 hallazgos estructurales que aparecieron al hacerlo.

**Where**: `vault/03_Deuda/deuda-tecnica.md` (items 54 y 55 al final), `vault/engram/**`

**Learned**:
- **Me inyecte CJK en mi propia escritura al appendar.** Escribi `自动` en el item 55 (donde debia decir "automatizacion") y un texto corrupto (`Paksobe`). El escaneo por codepoint lo agarro: 3 CJK en L2087. Es exactamente el modo de fallo del item 52, autoinfligido. **Leccion operativa: el scan de codepoints hay que correrlo SIEMPRE despues de escribir, no solo antes de commitear.** Y hay que correrlo sobre el archivo, no confiar en que la herramienta de edicion es segura: `edit`/`write` no introducen mojibake, pero el modelo que genera el texto si puede meter CJK.
- Al corregir un typointendo uno nuevo (`seDado`). Cada edicion correctiva es una nueva oportunidad de corromper. Verificar dos veces.
- `gh pr create` **si** soporta `--body-file`; `gh issue close` **no**. Asimetria real de la CLI 2.101.0.
- Passar un body multilinea por `--body $var` **falla**: PowerShell lo parte en argumentos y gh lo rechaza con `unknown arguments`. Usar siempre `--body-file`.
- El `U+FFFD` de L501 en `deuda-tecnica.md` es **preexistente**, es el residuo que documenta el item 26. No corregirlo: es evidencia, no un defecto vivo.
- Verificacion append-only que funciono: `git diff --stat` dio `131 insertions(+), 0 deletions(-)` y el grep de `^-` solo matcheo el header `--- a/...`. Regex a mejorar: `^-(?!-{3})` matchea `--- a/` porque tras el primer `-` quedan `-- ` (dos guiones + espacio), no tres guiones.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
