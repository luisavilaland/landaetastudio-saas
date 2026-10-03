---
id: 125
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 16:47:33"
updated_at: "2026-10-03 16:47:33"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "Prefijo \"Estado actual:\" para contadores ambiguos en TESTING.md Notas"
---

# Prefijo "Estado actual:" para contadores ambiguos en TESTING.md Notas

**What**: La linea de contador de TESTING.md en la seccion Notas quedo prefijada con "Estado actual:" para distinguirla de los hitos con fecha que la rodean.

**Why**: Esa linea vivia debajo de nueve lineas que si son hitos con fecha (Release v0.9.0, Release v0.10.0, Actualizaciones del 20 y 24 de septiembre, Actualizaciones del 3 de octubre de T1 y T2, Fase 5 completada, Fase 6 completada). Sin fecha propia no habia evidencia para decidir si era estado actual o snapshot historico, y la duda reaparece en cada task que suma tests. El prefijo lo resuelve de forma permanente.

**Where**: TESTING.md linea 327, rama chore/t2-env-validation (PR 185)

**Learned**: (1) Aplicar AGENTS.md al pie de la letra, contadores de estado actual sin contexto de release se actualizan, fue lo que dejo 6 de 7 lineas modificadas en categoria A sin discusion y solo una en categoria C. (2) Leccion transferible: cuando un contador vive dentro de una lista mayoritariamente historica, la categoria C no se resuelve eligiendo un numero, se resuelve haciendo explicito el alcance de la linea. (3) Separacion clave en la auditoria: agregar lineas nuevas con fecha propia no es tocar historia. De 10 lineas del diff, 3 eran agregados puros y 7 modificaciones, de las cuales 6 eran A y 1 era C.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
