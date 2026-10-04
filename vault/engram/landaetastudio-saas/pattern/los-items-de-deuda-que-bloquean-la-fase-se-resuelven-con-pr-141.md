---
id: 141
type: pattern
project: landaetastudio-saas
scope: project
topic_key: pattern/items-deuda-se-resuelven-con-pr-de-fix
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 15:08:03"
updated_at: "2026-10-04 15:08:03"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Los items de deuda que bloquean la fase se resuelven con PR de fix, no solo se registran"
---

# Los items de deuda que bloquean la fase se resuelven con PR de fix, no solo se registran

**What**: Los items de deuda que bloquean la siguiente fase se resuelven con un PR de fix, no se dejan registrados. Los items 48, 49 y 50 se implementaron y se marcaron RESUELTOS en el mismo PR `chore/fix-48-49-50`.

**Why**: Registrar "hay que hacer X" como item de deuda y seguir adelante produce el item 38: un item que dice lo contrario de lo que hace el codigo, que alguien sigue al pie de la letra y rompe el flujo en silencio. Item 38literalmente thaia "el webhook registra warn y no transiciona paused", y T4 ya emitia esa transicion.

**Where**: `vault/03_Deuda/deuda-tecnica.md`, PRs #190 (registro) y `chore/fix-48-49-50` (resolucion)

**Learned**:
- **El ciclo correcto es dos PRs**: uno registra el item con su evidencia (barato de revisar, el revisor focus en el hallazgo), otro lo resuelve. Mezclar ambos carga al revisor con revisar el item Y el fix.
- **Al resolver un item, marcarlo RESUELTO describe que se hizo Y que NO se hizo.** El item 48 quedo resuelto sin la parte de tipado en centavos: dejarlo escrito evita que alguien lea "RESUELTO" y asuma cobertura completa.
- **Corregir documentacion desactualizada es parte de resolver el item, no un extra.** El transversal afirmaba `cancelled -> active` como valida; el spike lo refuto con un 400. Dejarlo habria inducido a construir el flujo roto.
- **Un item de deuda nuevo se puede registrar y resolver en el mismo PR** (item 50), siempre que la evidencia del hallazgo sea solida y se documente la causa.
- **Regla derivada:** un doc de "estado actual" escrito en el mismo commit que crea el hecho que lo contradice tiene vida util corta. El item 50 nacio exactamente asi: el PR #163 creo `openspec/config.yaml` y en el mismo commit escribio que `openspec/` no existia. Vale revisar los otros "estado actual" de AGENTS.md y SETUP.md con la misma lupa.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-pattern]]
