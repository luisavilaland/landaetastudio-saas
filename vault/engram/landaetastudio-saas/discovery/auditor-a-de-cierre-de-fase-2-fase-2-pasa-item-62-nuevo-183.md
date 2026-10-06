---
id: 183
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 22:12:53"
updated_at: "2026-10-06 22:12:53"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría de cierre de Fase 2: Fase 2 pasa, item 62 nuevo"
---

# Auditoría de cierre de Fase 2: Fase 2 pasa, item 62 nuevo

**What**: Auditoría read-only de cierre de Fase 2 (equivalente a #140 de Fase 1) sobre `develop` en `8e2c4f9`. Dos perfiles con scopes disjuntos: QA (MiMo, 5 verificaciones mecánicas + 11 hallazgos de código) y Orquestador (Nemotron, inventario + 5 procesos + 4 propuestas). Documento en `vault/04_Fases/auditoria-fase2.md`.

**Why**: Buscar lo que la auditoría mid-phase (#197) y la mini auditoría T6 (#202) no vieron, y evaluar el proceso de la fase completa.

**Veredicto**: **Fase 2 pasa**. Sin CRITICAL ni HIGH de código. 11 hallazgos: 6 MEDIUM, 5 LOW, + 1 de proceso (ALTO). El único bloqueante de Fase 3 sigue siendo el item 61.

**Where**: `vault/04_Fases/auditoria-fase2.md`, `vault/03_Deuda/deuda-tecnica.md` (item 62 nuevo), `AGENTS.md` (fix cleanup), `vault/02_Bitacora/bitacora.md`

**Learned**:
- **El hallazgo importante no es de código.** H1 no falló por falta de tests: el nombre `withTenantContextByPreapproval` prometía un contexto de tenant que la función NO establecía (hacía `db.select` directo), y un comentario justificaba la seguridad con una premisa falsa ("el índice único parcial es por definición de un solo tenant"). RLS se aplica ANTES del `WHERE`, así que devolvía 0 filas siempre. El nombre hizo el trabajo de la review: un grep de `withTenantContext` lo encuentra y marca el casillero.
- **La prueba que lo refutaba ya estaba en el repo**: `"sin set_tenant_id una conexión nueva devuelve cero filas RLS"` (`rls-cross-tenant.test.ts:333`), creado el 2026-09-24 en `670a7b3` (cierre de Fase 1) — 12 días antes de que empezara Fase 2. Nadie lo conectó.
- **Item 62 nuevo**: "un nombre o un comentario pueden hacer el trabajo de la review". Mitigación: un comentario que justifica saltarse una frontera de seguridad es un HALLAZGO, y un nombre que promete una propiedad de seguridad debe abrirse.
- **Dos severidades corregidas contra el subagente**: `dataId` de la firma se reportó ALTO ("401 en cada entrega"), pero el spike T0 registró 3 entregas reales de MP con `data.id` EN EL BODY → rebajado a MEDIUM, con riesgo residual acotado al topic `subscription_preapproval_plan` (el único no observado por el spike, y el que no está suscrito). **Verificar la afirmación de un subagente contra la evidencia es parte del método.**
- **Branches en 67.38%** es la cifra que el cierre no reportaba. Una función puede figurar cubierta si se la llamó una vez; una rama sin cubrir es una decisión que el código tomó y nadie ejercitó. Los caminos sin cubrir se concentran donde la auditoría tuvo que meter fixes (`mp-subscriptions.ts`, webhook de plataforma).
- **El cleanup de worktree tiene 3 modos de falla no documentados**: `gh merge --delete-branch` exit 0 con 433 MB huérfanos (#205, #206); `git worktree remove` → "is not a working tree" porque git ya desvinculó (#204, #206); `paseo_archive_workspace` → "Workspace not found" **y archiva igual** (#205). Un cleanup automatizado que confíe en el exit code acumula basura. Documentado en AGENTS.md.
- **Read-only se verificó, no se asumió**: el worktree terminó con 1 solo archivo modificado (el fix de AGENTS.md, mío). Ningún subagente escribió.
- Un subagente coló Hindi (लागू) y otro cometió un off-by-one en el conteo de commits (`41f5a3c..8e2c4f9` excluye su extremo izquierdo = 9, no 10). Hay que escanear los artefactos de subagentes antes de commitear.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
