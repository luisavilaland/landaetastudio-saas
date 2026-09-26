---
id: 34
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/gga-exclude-glob
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 15:33:28"
updated_at: "2026-09-26 15:37:14"
revision_count: 2
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Fix GGA glob **/*.test.* NO funciona (verificado)"
---

# Fix GGA glob **/*.test.* NO funciona (verificado)

**What**: El fix correcto para el glob de GGA es `*test.ts` (estilo extensión, sin puntos), NO `*.test.*` ni `**/*.test.*`. Probado empíricamente con 8 patrones.
**Why**: El plan del PR B instruía `**/*.test.*` para cerrar la deuda item 27. La premisa "los globs no cruzan /" era falsa para GGA v2.10.1.
**Where**: `.gga` (`EXCLUDE_PATTERNS`). Patrón verificado: `*test.ts,*spec.ts,*d.ts,dist/*,build/*,node_modules/*,vault/*`.
**Learned**:
- **Resultados empíricos** (probe: `packages/db/src/__tests__/gga-glob-probe.test.ts`, stageado, `gga run`, mirando la línea `Files to review:`):
  | Patrón | Resultado |
  |---|---|
  | `*.test.*` (original) | REVISADO — no excluye |
  | `**/*.test.*` (fix prescrito) | REVISADO — **no excluye** |
  | `*test.ts` | **EXCLUIDO** (reproducible 2/2) |
  | `*test.ts,*spec.ts,*d.ts,dist/*,build/*,node_modules/*,vault/*` | **EXCLUIDO** |
- **Conclusión**: GGA v2.10.1 NO matchea `*.test.*` contra la ruta ni contra el basename. Lo que sí funciona es un patrón de extensión simple `*<algo>.ts` sin punto ni slash. No usar `**`.
- **Método de prueba (reutilizable)**: crear un `.test.ts` en un SUBDIRECTOR, `git add`, `gga run`, verificar si aparece en `Files to review:`. Un `.test.ts` en la raíz NO sirve de probe. Restaurar `.gga` con `git checkout -- .gga` SIEMPRE después, porque un script interrumpido lo deja modificado.
- **Trampa al testear en lote**: un script que itera patrones y hace `gga run` puede ser interrumpido por notificaciones de agentes, dejando `.gga` a medio camino. Testear de a uno con restore en cada iteración.
- El subagente Diseñador aplicó `**/*.test.*` en el worktree sin poder verificarlo. Hay que corregirlo a `*test.ts` antes de commitear y **no cerrar el item 27** con el patrón que no funciona.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-bugfix]]
