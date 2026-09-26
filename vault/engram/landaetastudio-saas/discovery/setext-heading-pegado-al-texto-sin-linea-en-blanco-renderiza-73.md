---
id: 73
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:18:19"
updated_at: "2026-09-26 22:18:19"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Setext heading: `---` pegado al texto sin linea en blanco renderiza el parrafo como h2"
---

# Setext heading: `---` pegado al texto sin linea en blanco renderiza el parrafo como h2

**What**: Luis reportó que la segunda entrada del 2026-09-26 en la bitácora no tenía separador `---` al inicio. **El diagnóstico era incorrecto: el separador sí estaba (línea 1858).** La causa real era que estaba pegado al párrafo anterior sin línea en blanco.

**Why**: En Markdown, un párrafo seguido de `---` sin línea en blanco es un **setext heading**: el párrafo entero se renderiza como `<h2>`. De ahí el renderizado roto en Obsidian. Agregar otro `---` habría creado un duplicado.

**Where**: `vault/02_Bitacora/bitacora.md` (líneas ~1855-1861 y el final del archivo), commit `6a31849` en PR #150

**Learned**:
- **Setext heading**: `texto\n---` → `<h2>texto</h2>`. `texto\n\n---` → thematic break. Una línea en blanco de diferencia cambia por completo el renderizado. Agregué la línea en blanco.
- **Causa raíz del bug**: usé `Add-Content ... -NoNewline` con here-strings de PowerShell. El `-NoNewline` evita el salto al final, así que el siguiente append empezó directamente con `\n---` y quedó **un solo** newline entre el texto y el `---`. Con `Add-Content` normal (sin `-NoNewline`) el resultado hubiera sido el correcto.
- El archivo además terminaba con un `---` huérfano (línea 1895), sin nada después. Mismo origen: el here-string de la segunda entrada terminaba con `\n---\n`.
- **Auditoría completa**: 96 entradas, 81 separadores, 75 entradas con separador previo, **21 sin separador** — todas históricas (2026-07-10 a 2026-08-12). NO se tocaron: append-only + la regla del humano exigía parar si eran más de 3.
- **Impacto real del `---`**: es separación VISUAL, no estructural. Entradas `##` consecutivas sin `---` siguen renderizando como encabezados separados en Obsidian; no se fusionan en un bloque. El defecto era estético, no de legibilidad real.
- **Append-only verificado dos veces**: vs `origin/develop` = 0 borrados (solo adiciones). vs `HEAD` = 3 borrados, que son el `---` final propio y su línea en blanco, ninguno histórico.
- `vault/02_Bitacora/bitacora.md` está en `.prettierignore:8`, así que `format:check` no la toca: un error de formato ahí no lo detecta nadie más que el ojo.
- Con `Add-Content` en PowerShell 5.1 hay que evitar `-NoNewline` en contenido multilínea, o agregar el salto a mano.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
