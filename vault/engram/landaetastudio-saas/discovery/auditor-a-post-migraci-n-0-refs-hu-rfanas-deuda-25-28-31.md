---
id: 31
type: discovery
project: landaetastudio-saas
scope: project
topic_key: docs/post-migration-audit
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 14:14:09"
updated_at: "2026-09-26 14:14:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría post-migración: 0 refs huérfanas + deuda 25-28"
---

# Auditoría post-migración: 0 refs huérfanas + deuda 25-28

**What**: Auditoría post-migración al vault. Resultado: **0 referencias huérfanas** en zonas editables. Se registraron los items de deuda 25-28 en `deuda-tecnica.md` y la entrada de hito del 2026-09-26 en la bitácora. PR #144.
**Why**: El pre-flight del PR #143 solo cubrió las refs a la bitácora; faltaba el barrido del resto de archivos.
**Where**: `vault/03_Deuda/deuda-tecnica.md` (+76), `vault/02_Bitacora/bitacora.md` (+33). Commit `f4d35c5`, branch `chore/docs-post-migration-audit`.
**Learned**:
- **0 huérfanas.** Los 46 matches de paths viejos caen en: bitácora (24, append-only), `vault/engram/` (12, tool-managed), `docs/superpowers/` (8, lo lee Paseo), `vault/README.md` (2, referencias negativas intencionales). El pre-flight del #143 ya los había cubierto. Esta PR no modifica ningún path.
- **Formato real de `deuda-tecnica.md`**: headings `## N.` (23 de 24; el item 17 es el único outlier con `###`), y campos **Estado / Impacto / Mitigación / Urgencia** (los más usados: 12/12/8/14). El draft de la tarea pedía `### N.` con Estado/Riesgo/Mitigación/Severidad/Reevaluar — se siguió el archivo, no el draft, porque la instrucción era "respetando el formato de items existentes". Max item previo = 24.
- **Encoding del vault verificado a nivel de bytes (30 .md)**: todos UTF-8 válido. Solo `bitacora.md` tiene mojibake, con 6 ocurrencias = 1 residual (`â¬` L1289) + 5 citas intencionales. `deuda-tecnica.md` está limpio de mojibake — lo que se ve como `migraci??n` en la consola de Windows es render de terminal, NO del archivo. **Siempre verificar bytes, no texto de consola.**
- Al agregar los items 25-28, `deuda-tecnica.md` pasó a tener 2 ocurrencias de `â¬` y 1 de U+FFFD: todas citas intencionales del bug documentado.
- Scanner: `git grep -n -I -E <patrón>` sobre todos los tipos de archivo es más confiable que el `grep -rn --include=...` de la tarea. **Validar siempre el scanner con un control positivo** (buscar algo que sí existe) antes de reportar "0 matches" — un grep mal armado devuelve 0 igual.
- `gh pr checks` mapea checks CANCELLED a "fail" con exit 8: hay que leer `statusCheckRollup.conclusion`.
- PR #144 abierto contra develop. NO mergeado.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-docs]]
