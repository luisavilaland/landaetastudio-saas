---
id: 162
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 03:09:16"
updated_at: "2026-10-05 03:09:16"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "ling-3.0 fue removido de opencode zen; AGENTS.md documenta un modelo inexistente"
---

# ling-3.0 fue removido de opencode zen; AGENTS.md documenta un modelo inexistente

**What**: El contrafactual con `ling-3.0-flash-fin-free` fallo con HTTP 400 "Endpoint is unavailable". **Causa real: el modelo fue REMOVIDO de opencode zen**, no es una caida transitoria. El perfil Paseo "Disenador" ya fue actualizado a `opencode/ling-3.1-flash-free`.

**Why**: Intentaba aislar la variable modelo en la auditoria documental comparando ling vs nemotron con prompt byte-identico.

**Where**: `AGENTS.md:469` y `AGENTS.md:620` (documentan el modelo viejo), perfil Paseo `agent_profile_mu5jcr09_i91trml91h`

## Dos defectos verificables en AGENTS.md, independientes del swap

**1. Version de modelo desactualizada.** `AGENTS.md:469` y `:620` dicen *"Disenador -> Ling 3.0 Flash Fin Free"*. Ese modelo **ya no existe** en el provider. El perfil real apunta a `ling-3.1-flash-free`. Cualquiera que siga la seccion de orquestacion documentada y despliegue el perfil @Disenador segun AGENTS.md today fails.

**2. Descripcion del rol incorrecta.** `AGENTS.md:194` dice *"`@Disenador` - diseno/arquitectura/API"* y `:620` *"diseno y arquitectura de API"*. Las notes reales del perfil dicen: *"Diseno de interfaz y experiencia. Wireframes, layout, componentes reutilizables, sistema visual (tipografia, color, espaciado), flujos de usuario, prototipos y accesibilidad."*

Es UI/UX visual. Y `AGENTS.md:250,268` **obliga a @QA + @Disenador en cada auditoria por task**, asi que el desajuste aplica a un protocolo obligatorio.

## Por que esto SI justifica tocar AGENTS.md (y el swap no)

La justificacion para corregir es **factual**: el doc nombra un modelo inexistente y describe un rol que no coincide. Eso es verificable con una llamada a la API.

Lo que NO justifica es escribir "el perfil de arquitectura rindio mejor que el de diseno": eso sigue siendo n=1 sin control. **Corregir facts no es lo mismo que validar una hipotesis de proceso**, y no hay que mezclarlos en el mismo PR.

## Learned
- Diagnostique mal el `400` como outage transitorio por el `isRetryable: false`. La causa real fue deprecacion del modelo. **Un error 400 con mensaje de endpointUnavailable en un catalogo que si lista el modelo es senal de deprecacion, no de caida.** Reintentar un endpoint asi es tiempo perdido.
- `paseo_list_models` sin filtro sobre `opencode` devuelve **207 modelos / ~155 KB**. Es una mala herramienta para confirmar un id que ya se conoce. El id estaba en `models_ids` del primer chunk de la salida truncada.
- El contrafactual solo puede aislar una variable si el **prompt es byte-identico** y el agente **no sabe** que es un A/B. Si le decís que el otro modelo fallo, sesgas la corrida.
- Un confound que hay que declarar: entre la corrida de nemotron y la de ling-3.1 el worktree cambio (tiene `auditoria-fase2-midphase.md` commiteado). Es un doc de conclusiones, no material fuente, pero es una diferencia de estado.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
