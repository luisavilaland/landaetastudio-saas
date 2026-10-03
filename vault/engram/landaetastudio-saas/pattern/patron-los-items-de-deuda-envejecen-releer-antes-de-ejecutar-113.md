---
id: 113
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 04:21:50"
updated_at: "2026-10-03 04:21:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Patron: los items de deuda envejecen, releer antes de ejecutar la mitigacion"
---

# Patron: los items de deuda envejecen, releer antes de ejecutar la mitigacion

**What**: Patron de governance - **los items de deuda envejecen**. Un item describe el estado del momento en que se escribio, no el estado actual. Antes de ejecutar la mitigacion de un item, releerlo y verificar sus numeros.

**Why**: Se pidio registrar este patron y se verifico el caso del item 31 antes de grabarlo (para no enshrinar un dato falso).

**Where**: `vault/03_Deuda/deuda-tecnica.md` item 31 (caso de referencia verificado).

**Learned**:

1. **Caso verificado - item 31** ("Markdown sin `prettier --check` en el CI", L609). El item decia **73 archivos**. Cuando se mitigo, eran **84**: el PR #147 agregado 10 archivos en `vault/engram/` y el PR #148 agrego 11 en `.opencode/commands/`. El propio item ya lo documenta bajo "Alcance real (medido)".

2. **El numero estaba desactualizado porque `vault/engram/` crece solo.** Cada `mem_save` + `vault:export` agrega archivos. Cualquier item que cuente archivos de esa carpeta envejece al ritmo de la memoria.

3. **Regla operativa:** antes de ejecutar la mitigacion de un item, releerlo y **re-contar sus numeros**. Si el item dice "73 archivos" y hoy hay mas, el alcance cambio aunque el item no lo refleje. Un item de deuda no es un contrato, es una fotografia.

4. **Corolario para este PR:** el item 46 se registro con "10 de 13 tablas" verificado por grep en el momento. Si alguien agrega tablas al baseline, ese ratio tambien envellece. La parte estable del item es **que `subscriptions` no se trunca** - eso es una omision, no un conteo.

5. **Verificar antes de enshrinar.** Se comprobo que el item 31 efectivamente decia 73 y 84 antes de guardar el patron. Grabar un patron sobre un dato no verificado seria enshrinar el mismo problema que el patron denuncia.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
