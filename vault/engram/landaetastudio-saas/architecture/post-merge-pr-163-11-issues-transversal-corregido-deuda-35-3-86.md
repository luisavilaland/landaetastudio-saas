---
id: 86
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 17:22:03"
updated_at: "2026-10-01 17:22:03"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Post-merge PR #163: 11 issues, transversal corregido, deuda 35-38"
---

# Post-merge PR #163: 11 issues, transversal corregido, deuda 35-38

**What**: Post-merge del PR #163. 11 issues creados (milestone #11), 5 correcciones aplicadas al spec transversal, items 35-38 de deuda tecnica registrados.

**Why**: El PR #163 (planning de Fase 2) mergeado en develop como `9af860e`. Luis aprobo. Post-merge: taskify el plan, corregir los errores factuales del transversal, y registrar la deuda.

**Where**: Issues #164-#174. `docs/superpowers/specs/2026-09-subscription-lifecycle.md`. `vault/03_Deuda/deuda-tecnica.md`. `docs/superpowers/plans/2026-10-01-fase2.md`.

**Learned**:
1. **Milestone #11 "Fase 2 - Webhook + checkout"**. La API de GitHub ALGO el `due_on`: se pidio `2026-10-15T00:00:00Z` y guardo `2026-10-14T00:00:00Z` (conversio de timezone). Verificar `due_on` despues de crear.
2. **El label de task NO es `task`, es `type:task`.** El `gh label list` muestra `type:task` en la primera columna y es facil leerlo mal. Un `gh label create "task"` habria creado un DUPLICADO. Verificar SIEMPRE con `--json name` antes de usar un label.
3. **PowerShell rompe `--label "a,b"` si pasas un array.** `$lbl = "task","fase-2"` se expande a args separados y `gh` interpreta `fase-2` como flag → `unknown argument "fase-2"`. Pasar SIEMPRE un string separado por comas: `--label "type:task,fase-2"`.
4. **9 issues creados**: T0=#164, T1=#165, T2=#166, T3=#167, T4=#168, T5=#169, T6=#170, T7=#171, T8=#172. Ademas #173 (deps externas, `blocker`) y #174 (errores transversal).
5. **5 correcciones aplicadas al transversal** (rama `chore/fix-transversal-fase2`):
   - §1: diagrama Mermaid y tabla de disparadores convertidos a descripciones semanticas + nota de que los literales van en §6. **Ademas nota sobre `paused`.**
   - §5: premisa de prorrateo corregida (`billing_day_proportional` existe; la conclusion "la logica la maneja nuestra app" se mantiene).
   - §6: **reescrito** con tabla de topics reales + endpoint de resolucion por topic + tabla topic→estado + seccion sobre resolucion de tenant + nota de `notification_url`.
   - §6 idempotencia: `preapproval.*` ahora "idempotente por convergencia", no "por estado final de MP".
   - §8: **ambos** webhooks (Flujo A y B) sin `:tenantId`, con nota de URL literal + nota de por que van en apps/admin vs apps/storefront.
   - Extra: 2 rutas mas `/v1/preapproval/{id}` corregidas a `/preapproval/{id}` (el `v1` no existe en ese endpoint).
6. **Items 35-38 de deuda tecnica** agregados con formato `## N.` (NO `### N.` como en el resto del archivo — solo un item usa `###`).
7. **Conflicto de regla detectado en PARTE 4**: pedia `git push origin develop`, pero AGENTS.md prohibe commits directos a develop. Propuesta: fold del update del plan en el PR del transversal en vez de push directo.

**Nota de verificacion**: `git diff -w` en deuda-tecnica dio 98 inserciones / 0 eliminaciones (append-only OK). En el transversal dio 178/46 — los 46 son reemplazos intencionales, verificados linea por linea.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
