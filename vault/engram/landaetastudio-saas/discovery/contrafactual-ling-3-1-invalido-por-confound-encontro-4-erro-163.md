---
id: 163
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 03:40:10"
updated_at: "2026-10-05 03:40:10"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Contrafactual ling-3.1 invalido por confound; encontro 4 errores mios y el root cause real de H2"
---

# Contrafactual ling-3.1 invalido por confound; encontro 4 errores mios y el root cause real de H2

**What**: Contrafactual con `ling-3.1-flash-free` corro sobre la misma auditoria documental que `nemotron-3-ultra-free`. El experimento Resulta **invalido**: ling-3.1 leyo mi informe consolidado de 315 lineas, asi que no es cold-vs-cold. Aun asi encontro **4 errores reales en mi reporte** y el **root cause real de H2**.

**Why**: El usuario pidio evidencia antes de tocar AGENTS.md. Ese controlling.

**Where**: `vault/04_Fases/auditoria-fase2-midphase.md` (PR #197, tiene errores), `docs/superpowers/specs/2026-09-subscription-lifecycle.md`, `vault/03_Deuda/deuda-tecnica.md`

## El confound que yo mismo declare y no controle

| Corrida | Contexto |
|---|---|
| nemotron-3-ultra | **Frio** — el consolidado no existia |
| ling-3.1-flash | **Templado** — leyo mi informe completo |

El agente lo dice: *"este informe es el delta documental sobre vault/04_Fases/auditoria-fase2-midphase.md (leido completo)"*.

Las 4 correcciones solo son posibles porque leyo mi trabajo. Y el falso hallazgo de la bitacora no se reprodujo **porque mi reporte ya listaba esas entradas**. Ese eje tampoco aisla. **Declarar un confound no es controlarlo.**

## 4 errores reales mios (verificados)

1. **"No se encontro una segunda contradiccion" es FALSO.** El transversal tiene **3** contradicciones sobre `paused -> cancelled`: `L46` (que si detecte), `L125` ("API no lo expone aun... Backend (POST /cancel, pendiente)") y `L184-185` ("la transicion existe en MP pero la API todavia no la expone... volver a active y cancelar desde ahi"). Verificado con lectura directa.
2. **Mapeo de anti-duplicacion erroneo.** Blueprint `:tenantId` NO es el item 37: el item 37 real es `GET /authorized_payments/{id}` (`deuda L784`). Es el **item 35 #3** (`deuda L735`). **Causa raiz**: el plan `2026-10-01-fase2.md:764` asigna el `:tenantId` al "item 37", pero la numeracion del plan y la de `deuda-tecnica.md` NO coinciden. Lei el plan y no verifique contra el archivo.
3. **4 numeros de tests en circulacion**, no 2: bitacora T5 dice 670/68, item 52 dice 682, docs dicen 679/69, real 678/68.
4. **Impreciso sobre PROMPTS.md**: si advierte de worktrees sin `node_modules` (L76-77). El gap real es peor: los templates de `L198-199` y `L266-267` usan una API **inexistente** (`withTenantContext(id)` + `db.with(ctx)`) cuando la real es callback-style.

## Root cause real de H2 (yo lo tenia mal)

`deuda-tecnica.md` item 38, decision textual de Luis en planning de Fase 2:

> **Decision (Luis, planning Fase 2):** documentar como **no soportado** en Fase 2. El webhook registra `warn` y **no transiciona** cuando recibe `paused`.

**El handler hizo exactamente lo que el item 38 decide.** T4, tres dias despues, construyo `pause`/`resume` con 202. El item 38 nunca se reviso.

H2 no es un path de codigo faltante: es una **decision de producto no reconciliada**. Mi recomendacion ("agregar targets `paused` a `decideTarget`") **puede estar mal** porque implementaria una decision rechazada explicitamente.

Cadena: item 38 (no soportado) -> spike T0 prueba que si es reversible -> T4 construye pause/resume -> item 38 nunca se toca -> el handler sigue la vieja, T4 promete la nueva -> el 202 miente.

## Decision sobre AGENTS.md

El swap **sigue sin validar**, y el experimento que lo iba a validar ya no es posible (ling-3.0 removido del provider). Lo verificable y factual: `AGENTS.md:469,620` nombran `Ling 3.0 Flash Fin Free` (modelo **inexistente**) y describen el rol como "arquitectura de API" cuando las notes del perfil son UI/UX visual. Eso se corrige por ser hecho, no por ser hipotesis.

## Learned
- **Declarar un confound no es controlarlo.** Lo hice y aun asi el experimento fallo. Si vas a identificar una variable suelta, controlala de verdad: dos worktrees en distinto commit.
- **Un prompt identico no es un experimento controlado** si el entorno de archivos difiere. El agente lee lo que hay en disco, no solo lo que le pasas.
- **La segunda pasada con el informe consolidado es lo que mas valor dio**: 4 de 13 hallazgos fueron errores de la primera pasada. Ese es el proceso con evidencia, no el cambio de modelo.
- **Verificar los mapeos de anti-duplicacion contra el archivo, no contra el plan.** El plan y el archivo pueden tener numeraciones distintas, y el plan es el que se escribe primero.
- El item 38 es la fuente de verdad de por que el handler no transiciona a `paused`. Buscar el item de deuda que decidio el comportamiento **antes** de recomendar codigo.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
