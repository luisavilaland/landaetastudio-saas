---
id: 181
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 20:32:29"
updated_at: "2026-10-06 20:32:29"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Precondiciones T8 cumplidas: blueprint no normativo + arquitectura indexa Fase 2"
---

# Precondiciones T8 cumplidas: blueprint no normativo + arquitectura indexa Fase 2

**What**: Cumplidas las precondiciones #2 y #3 de T8 de la auditoría mid-phase (#197, `vault/04_Fases/auditoria-fase2-midphase.md` §7 "Antes de T8"). El blueprint v2.6 quedó marcado no normativo y `vault/05_Specs/arquitectura.md` ahora indexa Fase 2 + ADR-026/027.

**Why**: La auditoría definió 4 precondiciones para poder firmar el cierre. #1 (ADR-026/027) ya se hizo en #199/#200 y #4 (deuda aceptada) la resuelve T8. #2 y #3 seguían sin cumplirse: el blueprint seguía diciéndose "Referencia vigente" con el pie apuntando a Fase 1 (ya completada), y `arquitectura.md` terminaba en ADR-025 sin conocer Fase 2 ni los ADR nuevos.

**Where**: `docs/superpowers/specs/2026-09-blueprint-v2.6.md`, `vault/05_Specs/arquitectura.md`, `vault/02_Bitacora/bitacora.md`

**Learned**:
- **Precondición #2 — la nota de no normatividad es mejor que "actualizar".** El blueprint se可以不 reescribir: se le marca no normativo, se actualiza la fila 2 del roadmap (Pendiente → Completada) y el pie ("Próximo paso: Fase 1" → Fase 3). El contenido de diseño de la sección Fase 2 (URL del webhook con `:tenantId`, nombres de evento viejos) queda CONGELADO como historia. Reescribirlo sería volver a decidir en un doc histórico lo que ADR-026 y ADR-027 ya decidieron.
- **Un blueprint que dice "Referencia vigente" y apunta a una fase cerrada es peor que uno ausente**: induce a construir sobre RLS y topics que ya no existen.
- **Precondición #3 — las rutas del prompt estaban mal.** `blueprint-v2.6.md` NO está en `vault/01_ADRs/` (está en `docs/superpowers/specs/2026-09-blueprint-v2.6.md`); `arquitectura.md` NO está en `vault/01_ADRs/` (está en `vault/05_Specs/`); el plan de Fase 2 NO está en `specs/` (está en `plans/`). `vault/01_ADRs/` contiene solo ADRs. Verificar rutas antes de editar, no confiar de memoria.
- **Desde `vault/05_Specs/`** la ruta a `vault/04_Fases/` es `../04_Fases/` (NO `../vault/04_Fases/`), y a `docs/` es `../../docs/`.
- El ADR table de `arquitectura.md` es el índice real: ADR-026/027 van como filas ahí, no como una lista separada.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
