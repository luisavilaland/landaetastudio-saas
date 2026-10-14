---
id: 304
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 16:15:44"
updated_at: "2026-10-14 16:15:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Merge #257+#258 y cleanup: gh no borro el worktree, queda directorio huerfano"
---

# Merge #257+#258 y cleanup: gh no borro el worktree, queda directorio huerfano

**What**: Merge de las dos PRs de auditoria mid-phase de Fase 3 (#257 y #258) + cleanup de Paseo. #257 -> 797b6ac, #258 -> 62e9cdb. Ambas en develop. Workspace wks_cdc020039c635b06 archivado. Queda un directorio huerfano vacio en disco, bloqueado por un handle de Windows.
**Why**: Cierre del ciclo de auditoria que arranco en la sesion.
**Where**: vault/04_Fases/auditoria-fase3-midphase.md y -v2.md; vault/03_Deuda/deuda-tecnica.md (112 items); vault/02_Bitacora/bitacora.md (2 entradas).
**Learned**:
- **`gh pr merge --delete-branch` mergEO pero NO borro el worktree**: "Could not remove worktree ... Directory not empty", luego "failed to delete ... Directory not empty" — y **exit 0**. Confirma lo documentado en AGENTS.md (#204/#205/#206): el codigo de retorno de `gh` NO es evidencia del estado final. Verificar siempre con `gh pr view --json state,mergedAt`.
- **La rama remota SI se borro** aunque el worktree local no. Asimetria: lo remoto es idempotente, lo local no.
- **Modo de falla 1 confirmado**: git ya habia desregistrado el worktree (`git worktree remove` -> `fatal: not a working tree`, exit 128) pero el directorio sobrevivia con los 425.3 MB de node_modules. Hay que borrarlo a mano.
- **Los 425 MB SI se borraron**; solo quedo el directorio vacio (0 archivos) con un handle de Windows que no se libera. Probado y fallido: Remove-Item -Recurse -Force, cmd rmdir /s /q, [System.IO.Directory]::Delete, y archivar los 2 agentes primero. **Solucion pendiente: reiniciar la sesion de Paseo o el daemon.** Es cosmetico (0 bytes) pero deja el path ocupado.
- **Archiivar los agentes NO libero el handle**, y archivar el workspace tampoco. El `paseo_archive_workspace` respondio `removedDirectory: false` pero SI archiving (verificado por efecto: 12 -> 11 workspaces).
- Verificacion por efecto, no por exit code: el workspace desaparecio del listado; el directorio no.
- develop quedo en 62e9cdb, arbol limpio, 0 PRs abiertos, 5 issues de Fase 3 abiertos (#252-#256), 112 items de deuda, 889/889 tests, 0 skipped.
- Los 3 registros del cleanup se limpian por APIs distintas: git worktree (si), rama local (si), workspace Paseo (si). El directorio huerfano es un cuarto registro que el plan no contemplaba.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
