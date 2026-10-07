---
id: 197
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-07 15:54:21"
updated_at: "2026-10-07 15:54:21"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Drift doc-codo no registrado: README apunta a docs/adr/ inexistente y ADR-022 vs 27 reales"
---

# Drift doc-codo no registrado: README apunta a docs/adr/ inexistente y ADR-022 vs 27 reales

**What**: Drift doc↔código NUEVO, no registrado todavía, en tres places que el saneamiento de #219 no tocó. (1) `README.md:234` — el árbol del repo lista `docs/adr/` con el comentario "Decisiones de arquitectura (ADR-001 a ADR-022)": **la ruta no existe** (`Test-Path docs/adr` → False; los ADRs viven en `vault/01_ADRs/`) y el rango está 5 ADR desactualizado. Triple error en una línea: ruta inexistente, rango viejo, ubicación movida al vault. (2) `AGENTS.md:129` — "ADRs: `vault/01_ADRs/` (ADR-001 a ADR-025)": en disco hay **27** (ADR-026 y ADR-027 son de Fase 2,both registrados en `arquitectura.md`). (3) `README.md:39-86` tiene 6 headings `## Fase N` con taxonomía propia (su "Fase 4 — Autoservicio del Tenant" está marcada ✅ Completada) que **contradice semánticamente** el roadmap del vault, donde Autoservicio es Fase 3 y está Pendiente. El item 72 lo registra como "numeración que colisiona"; el conflicto real es más grave que una colisión de números.

**Why**: Reincorporación del 2026-10-07, verificando el alcance real del saneamiento documental post-Fase 2 (PR #219, 9 items).

**Where**: `README.md:234` y `README.md:39-86`, `AGENTS.md:129`,对比 `vault/01_ADRs/` (27 archivos) y `docs/superpowers/specs/2026-09-blueprint-v2.6.md:195-208`.

**Learned**: El PR #219 corrigió 6 contadores ACTUAL de tests con todo el cuidado del mundo (hasta distinguiendo "679 que es histórico legítimo" de "679 que es drift") y aun así dejó passers por delante un árbol del repo que apunta a un directorio que fue borrado hace meses. **Un saneamiento de docs no está terminado cuando los números cuadran; termina cuando cada ruta citada existe.** La verificación de conteo y la de existencia de paths son pruebas distintas, y pasar la primera no dice nada de la segunda. Corolario: `Test-Path` sobre cada ruta de un árbol documentado es un check de 5 líneas que valía más que 8 commits de saneamiento.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
