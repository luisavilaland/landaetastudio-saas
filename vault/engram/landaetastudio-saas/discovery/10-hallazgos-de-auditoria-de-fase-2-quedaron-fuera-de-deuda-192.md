---
id: 192
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9301c36ffe7N3adq6c5qZH2y
created_at: "2026-10-07 14:51:44"
updated_at: "2026-10-07 14:51:44"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "10 hallazgos de auditoria de Fase 2 quedaron fuera de deuda-tecnica.md"
---

# 10 hallazgos de auditoria de Fase 2 quedaron fuera de deuda-tecnica.md

**What**: La auditoria de cierre de Fase 2 (`vault/04_Fases/auditoria-fase2.md`, mergeada en #207) produjo 11 hallazgos de codigo: H-F2-1 (ALTO, proceso), H-F2-2 a H-F2-9 (MEDIUM), H-F2-10 y H-F2-11 (LOW). Al buscar en `vault/03_Deuda/deuda-tecnica.md`, SOLO hay 2 referencias a hallazgos de auditoria: H-F2-1 (item 62, L2539) y H-T6-1 (item 61, L2523). **H-F2-2 a H-F2-11 no estan registrados como items de deuda.** Verificado con grep: `H-F2-\d+|H-T6-\d+` devuelve exactamente 2 lineas en las ~2600 lineas del archivo.

Ademas, las Limitaciones del documento piden una **segunda pasada con el mismo prompt y otro perfil** ("costo bajo, valor alto"), recomendada antes de mergear. El merge de #207 ocurrio sin segunda pasada registrada.

**Why**: AGENTS.md ("Auditorias por tarea") exige "Hallazgos nuevos -> vault/03_Deuda/deuda-tecnica.md" y "Si la tarea empeora el hallazgo existente, actualizar el item". 10 hallazgos auditados quedaron solo en el documento de fase, sin trackear. El precedente documentado (#197 -> 4 errores factuales en su propia segunda pasada) dice que una auditoria de primera pasada tiene error esperado.

**Where**: `vault/04_Fases/auditoria-fase2.md` (hallazgos + §Limitaciones), `vault/03_Deuda/deuda-tecnica.md` (items 61-62, ultimo item = 62).

**Learned**: Un hallazgo de auditoria que vive solo en el documento de fase es un hallazgo que se pierde en el proximo sprint. Los 3 verificados en codigo (H-F2-2 `dataId` solo del body en route.ts:151 sin fallback a query; H-F2-3 comentario de cabecera en preapproval/route.ts:39 promete "409 con el initPoint" y los 409 de L116/129/142 no lo incluyen; H-F2-9 fallback `MP_PLATFORM_WEBHOOK_SECRET ??` en route.ts:114 contradice ADR-023) siguen vivos y sin trackear. El mas caro de arreglar antes de Fase 3 es H-F2-2, porque su riesgo depende del topic `subscription_preapproval_plan`, que sigue sin suscribir en el panel de MP.

---
*Session*: [[session-ses_ee9301c36ffe7N3adq6c5qZH2y]]
