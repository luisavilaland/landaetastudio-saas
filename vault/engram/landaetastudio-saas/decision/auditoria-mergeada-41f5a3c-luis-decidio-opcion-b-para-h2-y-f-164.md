---
id: 164
type: decision
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 13:48:19"
updated_at: "2026-10-06 13:48:19"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "Auditoria mergeada (41f5a3c); Luis decidio opcion B para H2 y fijo el orden de trabajo"
---

# Auditoria mergeada (41f5a3c); Luis decidio opcion B para H2 y fijo el orden de trabajo

**What**: Auditoria mid-phase de Fase 2 mergeada a `develop` (PR #197, squash `41f5a3c`). Con ella quedaron mergeados los items 54 y 55 de deuda (PR #196, `e7c7c28`). `develop` limpio, 0 PRs abiertos, 0 worktrees huerfanos.

**Why**: Cierre del ciclo: auditoria -> correcciones -> rebase -> merge.

**Where**: `vault/04_Fases/auditoria-fase2-midphase.md` (381 lineas, 35.7 KB), `vault/03_Deuda/deuda-tecnica.md` (items 54-55)

## Decision de producto de Luis al aprobar (CRITICA, no estaba en el doc)

Luis aprobo #197 con la instruccion textual:

> **"Ya decidiste B."**

Es decir: **item 38 queda REVERTIDO y T4 (`pause`/`resume`) sigue vigente.** Se agrega target `paused` a `decideTarget`. La opcion A (quitar pause/resume) queda descartada.

Esto resuelve la ambiguedad que la auditoria dejo abierta y que su propio documento marcaba como "no puede decidir el punto: es de producto".

## Orden de trabajo que fijo Luis

1. PR chico — item 38 opcion B + target `paused` en `decideTarget` (H2, ya aprobado)
2. PR — H1: policy de bootstrap para `withTenantContextByPreapproval`
3. PR — H3: escribir `planId` en `applyTransition` cuando el evento lo confirme
4. T7 (docs) puede avanzar **en paralelo** con H1 y H3

**No arrancar T6 hasta resolver H1-H3.**

## Learned

- **`gh pr merge --delete-branch` falla si el worktree tiene archivos untracked.** El directorio queda en disco y la rama local sobrevive, aunque git ya lo haya sacado de su registro. El mensaje es `Directory not empty`. La causa aqui fue `node_modules` de un `pnpm install` (y antes `.env.local`). **Pasos: `git worktree prune`, borrar el directorio, y recien ahi `git branch -D`.** Con --delete-branch alcanza con quitar los untracked antes.
- **Aquiesta vez la trampa del backtick de PowerShell me habria pasado de nuevo.** Escribi el body del PR con here-string `@"..."@` y cada `` `vault `` se.convertio en U+000B + "ault". Lo detecte porque el grep mostraba `ault/` sin la `v`. **En PowerShell, dentro de strings dobles y here-strings, el backtick es el caracter de escape y el tabulador vertical U+000B es un escape valido.** Para markdown con backticks: usar la herramienta de edicion, nunca un here-string. Es el item 52 por tercera vez.
- **Comparar tokens alfanumericos es la unica verificacion de "solo formato" que sobrevive a la puntuacion.** Los tokens con puntuacion dan falsos positivos por `*` vs `_` y por guiones de tabla; los alfanumericos dan 0 diferencias y son concluyentes.
- **El drift de Engram se detecta comparando `engram stats` (Observations) contra el max id de los `.md` del vault.** Fallaba por 3 (160 vs 163) justo antes de un force-push. Sin esa comparacion, el PR habria salido con 3 memorias huerfanas.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
