---
id: 161
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 02:58:45"
updated_at: "2026-10-05 02:58:45"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "El swap de perfil de auditoria no es validable: n=1 sin control, y el dato disponible apunta en contra"
---

# El swap de perfil de auditoria no es validable: n=1 sin control, y el dato disponible apunta en contra

**What**: Intento evaluar si el swap de perfil @Diseñador (ling-3.0-flash-fin-free) -> @Orquestador (nemotron-3-ultra-free) en la auditoria documental produjo mejores hallazgos. **No se puede demostrar.** Se registro el analisis y el bloqueo metodologico.

**Why**: El usuario pidio evidencia antes de tocar AGENTS.md. La regla de no afirmar sin prueba aplica tambien a las reglas de proceso.

**Where**: `AGENTS.md:194,469,617-620`; perfil Paseo "Diseñador"; `vault/03_Deuda/deuda-tecnica.md` (items 55, 56)

## El bloqueo: no hay contrafactual

**Nunca se ejecuto `ling-3.0-flash-fin-free` sobre la auditoria documental.** Solo se corrio `nemotron-3-ultra-free`. Es **n=1 sin control**: cualquier afirmacion de que "el modelo mas grande produjo mejores hallazgos" seria inventada.

Ademas hay una confusion de variables: los hallazgos documentales vienen de nemotron y los tecnicos de mimo. **Son tareas distintas con modelos distintos.** No se puede aislar el efecto del modelo.

## La unica comparacion disponible (distinta tarea, distinto modelo)

| Metrica | Orquestador / nemotron (auditoria doc) | QA / mimo (auditoria tecnica) |
|---|---|---|
| Hallazgos | 17 | 8 + 6 INFO |
| **Falsos (verificados falsos por mi)** | **1** | **0** |
| Severidad inflada | 2 (CRITICO -> BAJO/MEDIO) | 0 |
| Secciones declaradas PARCIAL | 1 | 1 |
| Majores confirmados por mi | 1 de 17 | **3 de 8** |

El modelo **mas barato y mejor ajustado al rol** produjo el reporte mas preciso y los hallazgos mas graves. Es evidencia **en contra** de "modelo grande = mejor auditoria" para esta clase de tarea.

Ojo con un confound: nemotron produce mas hallazgos en parte porque habla mas, no porque vea mas. **Volumen no es calidad.** La metrica que importa es la tasa de falsos positivos.

## El unico hallazgo de Orquestador que aporta de mas

El **hueco de ADR** (decisiones de Fase 2 sin registro arquitectonico) no estaba en mi analisis de reincorporacion. Lo encontro el. Eso es un find genuino y de valor.

## Causa raiz del error factual: el PROMPT, no el perfil

El subagente reporto que la bitacora carecia de entradas T1-T4. **Falso: las 5 existen** (L2269, L2344, L2452, L2716, L2987).

Causa: el prompt pedia `grep -n` pero no advertia que el titulo de T5 no dice "Fase 2" (`## 2026-10-04 - T5: handler completo del webhook`). El patron `2026-.*T[0-9]\s+Fase 2` no matchea. De ahi la conclusion **invertida**.

Otro modelo con el mismo prompt habria hecho el mismo grep. **El fix es de prompt: enumerar los objetos buscados antes de grepear, o exigir verificar cada afirmacion negativa con un segundo metodo.**

## Mismatch documentado (independiente del modelo)

`AGENTS.md:620` dice *"Disenador (Ling 3.0 Flash Fin Free): **diseno y arquitectura de API**"*. Las notes reales del perfil Paseo dicen *"Diseno de interfaz y experiencia. Wireframes, layout, componentes reutilizables, sistema visual (tipografia, color, espaciado), flujos de usuario, prototipos y accesibilidad. Responsable de todo lo que el usuario final ve y toca."*

Es UI/UX visual, no arquitectura. Y `AGENTS.md:250,268` **obliga a @QA + @Disenador en cada auditoria por task**. O sea el desajuste aplica a un protocolo que se ejecuta en cada PR.

## Decision

**No** agregar "Perfiles de auditoria" a AGENTS.md atribuyendo el swap a una mejora validada. Se registraria una regla de proceso sin evidencia que la respalde, y ese es el modo de fallo que el item 34 del proyecto ya Sufre con otros docs.

Se registran 2 items de deuda (55 y 56) con lo que si es demostrable.

## Learned
- Evaluar un cambio de proceso con n=1 y sin control no produce conocimiento, produce una sensacion. La pregunta correcta no era "el swap fue mejor?" sino "tengo evidencia para afirmar que lo fue?".
- Un hallazgo inventado en una auditoria tiene costo desproporcionado: desacredita el informe entero, no solo el hallazgo.
- Comparar dos corridas de **tareas distintas** no aísla el efecto del modelo, por mas que se registre el modelo en cada fila de la tabla.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
