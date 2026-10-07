---
id: 194
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9301c36ffe7N3adq6c5qZH2y
created_at: "2026-10-07 15:39:42"
updated_at: "2026-10-07 15:39:42"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 219 abierto: saneamiento documental post-Fase 2"
---

# PR 219 abierto: saneamiento documental post-Fase 2

**What**: PR #219 "Docs: saneamiento post-Fase 2 (9 items, 8 commits, solo .md)" abierto contra `develop` desde `docs/saneamiento-post-fase2`. 15 archivos, 714 adiciones, 9 eliminaciones, **todos `.md`**. Verificado en GitHub que las cifras coinciden exactamente con el diff local. Commits: cb44708 (contadores 679→705), bbf0c49 (changelog append-only x3 archivos), b05225e (brief histórico), 082a220 (conteo auditoría #207), dc2d4cc (discrepancias 6 ADRs), a81ecb6 (items 63-71 + 72), bad0a9c (tabla manual TESTING.md), cf8d85e (bitácora + Engram).

**Why**: Contexto de reincorporación y registro verificable del PR. NO mergeado: la decisión de mergear es del dueño del proyecto.

**Where**: Rama `docs/saneamiento-post-fase2`, worktree Paseo en `~/.paseo/worktrees/0q5zj3gn/docs-saneamiento-post-fase2`. Archivos: `README.md`, `SETUP.md`, `TESTING.md`, `TESTING-MANUAL.md`, `vault/02_Bitacora/bitacora.md`, `vault/03_Deuda/deuda-tecnica.md`, `vault/04_Fases/auditoria-fase2.md`, `vault/05_Specs/arquitectura.md`, `vault/05_Specs/brief-tecnico-fase-5.md`, `vault/engram/`.

**Learned**: (1) El DoD completo se corrió con `pnpm install` real y `.env.local` copiado: lint 6/6, typecheck 9/9, test 705/705 en 69 archivos (18.25s), build 3/3, format:check verde. El AGENTS.md es explícito: una junction de `node_modules` entre worktrees da un typecheck que pasa sin ejecutar nada, y prettier ni siquiera resuelve `prettier-plugin-tailwindcss`. El install real toma ~48s y es la única forma de que el DoD sea evidencia. (2) Las cifras de GitHub (714/9/15) coinciden con el diff local: ese cruce es el control real, porque `gh` devuelve resultados contradictorios según el caso. (3) Verificar que un cambio es *aditivo* tiene una trampa que conviene tener automatizada: `git diff origin/develop..HEAD | grep "^-"` mezcla los cambios de un commit anterior del mismo PR con los del commit actual. Para aislar hay que comparar contra `HEAD` (último commit), no contra `origin/develop`. (4) Las notas de auditoría dentro de tablas cuestan el append-only: meter texto en una celda obliga a prettier a realinear la tabla completa. Poner la nota **después** de la tabla mantuvo `brief-tecnico-fase-5.md` en 79 inserciones y 0 eliminaciones.

---
*Session*: [[session-ses_ee9301c36ffe7N3adq6c5qZH2y]]
