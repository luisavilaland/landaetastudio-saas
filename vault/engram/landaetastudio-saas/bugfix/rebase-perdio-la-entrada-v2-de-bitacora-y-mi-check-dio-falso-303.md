---
id: 303
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 16:07:32"
updated_at: "2026-10-14 16:07:32"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Rebase perdio la entrada v2 de bitacora y mi check dio falso verde"
---

# Rebase perdio la entrada v2 de bitacora y mi check dio falso verde

**What**: Al rebasear audit/fase3-midphase-v2 sobre develop (tras mergear #257), la resolucion del conflicto de `vault/02_Bitacora/bitacora.md` tomo la version del HEAD parcial, que todavia no tenia la entrada v2. La entrada de la segunda auditoria desaparecio del historial sin aviso. Restaurada en el commit d546f21.
**Why**: Merge de #257 y #258, que ambos tocaron bitacora.md y deuda-tecnica.md.
**Where**: vault/02_Bitacora/bitacora.md, commits b33480f (con la perdida) y d546f21 (restore).
**Learned**:
- **El check de verificacion dio FALSO VERDE.** Busque `c.includes('segunda pasada')` y dio true, pero la frase tambien aparece en una entrada vieja de Fase 1 (L3613). La entrada v2 NO estaba. **Un grep por frase no es un check: la frase puede existir en otro lado del archivo.** Verificar por heading exacto o por conteo de entradas.
- **Resolucion de conflicto por blob, no por marcadores.** En vez de editar los `<<<<<<<`, tome `origin/develop:p` + la seccion `## 107.` del commit applied. Determinista y sin riesgo de marcadores huerfanos.
- **La primera resolucion de `deuda-tecnica.md` perdio las correcciones de los items 98 y 100**, porque construi el archivo como `ours + cola(107-113)` y las correcciones de 98/100 vivian ANTES del item 103 en el blob de #258, fuera de la cola extraida. Tuve que hacer un segundo splice de las secciones 98 y 100. **Al resolver un conflicto, verificar cada cambio del commit, no solo el bloque en conflicto** — git solo marca el conflicto, pero el commit puede traer cambios que se aplican en limpio y aun asi quedar pisados por tu reconstruccion.
- **Regla general**: tras un rebase con conflictos, verificar el estado FINAL contra el commit original commit por commit (que cambios introdujo), no solo que "resolví el conflicto" y que "git status está limpio".
- `pnpm test` post-rebase: 889/889, skipped=0, 78 archivos. Turbo con `--force`: 18/18, 0 cacheadas, 2m46s.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
