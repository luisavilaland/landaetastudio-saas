---
id: 50
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f20ddf8afffeGcd0yYih6wTTGX
created_at: "2026-09-26 19:19:16"
updated_at: "2026-09-26 19:19:16"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Integrados 11 commands SDD + commands.paths + 2 gotchas en PROMPTS.md"
---

# Integrados 11 commands SDD + commands.paths + 2 gotchas en PROMPTS.md

**What**: Copiados los 11 commands SDD (~24.8 KB) desde `~/.config/opencode/commands/sdd-*.md` a `.opencode/commands/` del worktree; registrada la clave `commands.paths: [".opencode/commands"]` en `opencode.json` (validado con node → "JSON OK"); agregadas 2 subsections al final de secciones existentes en `PROMPTS.md`: "Gotcha: Big Pickle con prompts narrativos" (en "Orquestar subagentes con Paseo", sección 1) y "Localizar gh si no está en PATH" (en "Cierre de PR completo", sección 5).

**Why**: Integrar el workflow SDD al proyecto para que los comandos estén disponibles en el worktree, y documentar 2 gotchas operativas descubiertas en PR C (2026-09-26) queTk: Big Pickle se traba con prompts narrativos largos + rutas relativas (emite "I'll start by reading...", ejecuta Test-Path, termina sin editar) y `gh` no está en el PATH de esta máquina.

**Where**: `.opencode/commands/` (11 .md nuevos), `opencode.json`, `PROMPTS.md` (líneas ~103 y ~408)

**Learned**:
- Big Pickle se traba con prompts narrativos largos + rutas relativas. Fix: edits numeradas ("EDIT 1 — ...", "EDIT 2 — ..."), paths absolutos. Diagnóstico: `paseo_get_agent_activity` muestra `status: running` con `updatedAt` congelado. Recovery: `paseo_archive_agent` + relanzar con nuevo formato — re-promptar repite el loop. MiMo y Ling NO tienen este problema.
- `gh` en esta máquina vive en `C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe` (NO está en PATH). Localizar con `Get-ChildItem -Path $env:LOCALAPPDATA\Temp\gh -Recurse -Filter gh.exe`. Usar `--body-file` en `C:\Users\exodo\AppData\Local\Temp\opencode\`, nunca `--body` inline (PowerShell manglea quoting de cuerpos largos). El MCP de GitHub responde "Bad credentials" — no sirve.
- `opencode.json` del proyecto solo tenía `$schema`, `mcp` y `skills.paths`; agregar `commands` al final (después de `skills`) mantiene el JSON válido y no rompe nada.

---
*Session*: [[session-ses_f20ddf8afffeGcd0yYih6wTTGX]]
