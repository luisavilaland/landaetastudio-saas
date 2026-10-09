---
id: 263
type: preference
project: landaetastudio-saas
scope: project
topic_key: pattern/pr-en-review-se-congela
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 12:23:02"
updated_at: "2026-10-09 12:23:02"
revision_count: 1
tags:
  - landaetastudio-saas
  - preference
aliases:
  - "Regla de Luis: PR en review se congela, el diseno es historia"
---

# Regla de Luis: PR en review se congela, el diseno es historia

**What**: Decisiones de Luis al cerrar el PR #235 (item 61). Las cuatro son "no hacer nada ahora": (1) las violaciones preexistentes de GGA NO se levantan en este PR, van despues del merge; (2) el item 78 sigue abierto; (3) la divergencia de ubicacion (`@repo/commerce` vs `@repo/db`) queda documentada en el PR body y #233 no se actualiza porque es historia; (4) el hallazgo del RLS queda documentado en el PR y en Engram, no se extrae mas.

**Why**: #235 ya esta en review. Meter las violaciones preexistentes ahi seria scope creep sobre un PR que ya se esta revisando. Y #233 es un documento de decision cerrado: la implementacion es la realidad, reescribir la historia de una decision no agrega informacion.

**Where**: PR #235, `vault/02_Bitacora/bitacora.md`, `vault/03_Deuda/deuda-tecnica.md`.

**Learned**:
- **Regla de scope que Luis aplica de forma consistente: un PR en review se congela.** Improvements validas, defectos reales y notas de diseno que aparecieron durante la implementacion NO se agregan retroactivamente al PR abierto, aunque esten justificadas y uno las haya encontrado escribiendolo. Van en un PR siguiente. El costo de revisar un PR que cambia bajo los pies del revisor supera al beneficio de un PR mas completo.
- **Un documento de diseno es historia, no configuracion.** Cuando la implementacion se desvía de lo que el diseno提案, la desviacion se documenta en la PR (que es donde el revisor la lee) y el diseno no se reescribe. Reemplazar #233 por la realidad destruye el registro de *por que* se eligio algo, que es justo lo que #233 vale.
- **El orden que Luis prefiere para estas decisiones**: implementacion -> PR -> CI -> revision -> despuesDocumentation. Las notas al diseño se hacen despues del merge, no antes.
- **Lo unico que pidio explícitamente que quedara en el PR y en Engram fue el hallazgo del RLS.** Es el hallazgo con valor transferible: una capa de proteccion puede volver indetectable un defecto, y un test que solo la ejercita en el nivel de arriba no verifica el invariante que dice verificar.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-pattern]]
