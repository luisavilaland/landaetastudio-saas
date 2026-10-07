---
id: 193
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9301c36ffe7N3adq6c5qZH2y
created_at: "2026-10-07 15:34:54"
updated_at: "2026-10-07 15:34:54"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Saneamiento documental post-Fase 2: 8 commits, drift de docs cerrado"
---

# Saneamiento documental post-Fase 2: 8 commits, drift de docs cerrado

**What**: PR de saneamiento documental post-Fase 2 en la rama `docs/saneamiento-post-fase2` desde `develop` a56dc27. 8 commits, 100% documentación, cero código de producción. Cierra 9 items de drift detectados en dos análisis de reincorporación: contadores de tests (679→705), changelogs append-only detenidos en T5, `brief-tecnico-fase-5.md` marcado histórico, conteo interno de la auditoría #207, discrepancias de 6 ADRs, 10 hallazgos H-F2 registrados como items 63-71, item 72 nuevo, tabla manual de TESTING.md notada.

**Why**: El drift venía sin corregir desde T6/T8 y violaba el DoD extendido de AGENTS.md. Los 10 hallazgos de la auditoría de cierre (#207) vivían solo en el documento de fase, sin trackear: un hallazgo que vive en un solo documento se pierde en el siguiente sprint.

**Where**: `README.md` (:515), `SETUP.md` (:482), `TESTING.md` (:295,:296,:331 + tabla :306-313 + changelog), `TESTING-MANUAL.md` (:225), `vault/02_Bitacora/bitacora.md`, `vault/03_Deuda/deuda-tecnica.md` (items 63-72), `vault/04_Fases/auditoria-fase2.md` (L22 y L387), `vault/05_Specs/arquitectura.md`, `vault/05_Specs/brief-tecnico-fase-5.md`.

**Learned**: (1) El plan original tenía 6 desvíos que aparecieron al verificar antes de escribir: eran 6 contadores ACTUAL y no 5 (faltaba `TESTING.md:296`, la fila `Pasando`, sin la cual la tabla queda 705 total / 679 pasando / 0 fallas); el criterio "grep 679 → 0" era imposible porque 3 ocurrencias históricas legítimas deben quedar; hay 3 changelogs y no 2 (SETUP.md tiene el suyo); el split de severidades es 8 MEDIUM / 2 LOW y no 5/5; la regla "83 archivos = 68 vitest + 15 e2e" aparece SOLO en `auditoria-fase2-midphase.md`, una medición fechada con base declarada en `develop 260bb39`, y actualizarla sería reescribir una auditoría; y eran 4 untracked en Engram y no 2. (2) **El resumen ejecutivo de la auditoría #207 tenía el defecto que la auditoría misma denuncia**: decía 11 hallazgos de código (6 MEDIUM, 5 LOW) y el cuerpo tiene 8 MEDIUM + 2 LOW. El falso positivo es que `grep -c "^### H-F2-"` devuelve 11 y ese número coincide — pero son 10 de código MÁS el de proceso, que el resumen contaba dos veces. Un número que coincide con lo esperado no es un conteo que cuadra. (3) **Agregar una nota dentro de una celda de tabla rompe el append-only**: prettier realinea la tabla entera y "marcar" se convierte en "reescribir". Las notas van después de la tabla; así `brief-tecnico-fase-5.md` quedó en 79 inserciones y 0 eliminaciones. (4) PreEXISTENTE en `vault/02_Bitacora/bitacora.md`: 3 bytes de control en L936 (0x08), L942 (0x07 BEL, el caso `<BEL>pproved` del item 52) y L1289 (0x1D); y en `deuda-tecnica.md` un U+FFFD en L501 dentro de una línea que documenta el propio mojibake. Además la palabra inglesa "falsehood" aparece 2 veces (deuda L1852 y L2544) donde debería decir "falsedad"/"falsearon". (5) GGA no audita `.md`: sus patrones son `*.ts,*.tsx,*.js,*.jsx,*.sql` y excluye `vault/*`, así que los 8 commits de docs imprimen "No matching files staged for commit" y pasan sin revisión. Es el item 55 confirmado en vivo.

---
*Session*: [[session-ses_ee9301c36ffe7N3adq6c5qZH2y]]
