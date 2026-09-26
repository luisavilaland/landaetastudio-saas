---
id: 45
type: preference
project: landaetastudio-saas
scope: personal
topic_key: tooling/github-token-cleanup
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 17:10:29"
updated_at: "2026-09-26 17:28:12"
revision_count: 3
tags:
  - landaetastudio-saas
  - preference
aliases:
  - "Limpiar GITHUB_TOKEN antes de operaciones GitHub"
---

# Limpiar GITHUB_TOKEN antes de operaciones GitHub

**What**: Patron completo para crear un PR desde el shell del agente:
1. `$env:GITHUB_TOKEN=$null; Remove-Item Env:\GITHUB_TOKEN -ErrorAction SilentlyContinue`
2. `& 'C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe' pr create --base <base> --head <branch> --title "<titulo>" --body-file "<archivo.md>"`

**Why**: `gh` NO esta en el PATH de Windows en esta maquina; vive en `C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe` (gh 2.101.0). Y un `GITHUB_TOKEN` obsoleto rompe la auth.

**Where**: Shell PowerShell del agente, para toda operacion de GitHub (crear PR, editar body, listar issues). El MCP de GitHub NO sirve: responde `Authentication Failed: Bad credentials` y corre como proceso persistente con su propio entorno, insensible a limpiar la variable desde la sesion.

**Learned**: (1) NO concluir "gh no esta instalado" buscando solo el PATH y las rutas estandar (`Program Files\GitHub CLI`, scoop, choco) — hay que probar tambien el path de Temp. Error mio en el PR C: lo di por ausente sin un check exhaustivo y casi bloquea la entrega. (2) Usar `--body-file` con un archivo en `C:\Users\exodo\AppData\Local\Temp\opencode\`, no `--body`/`--add-content` inline: PowerShell manglea el quoting de cuerpos largos con backticks y parentesis. Para ACTUALIZAR un body: `gh pr view <n> --json body --jq .body > archivo`, `Add-Content`, y despues `gh pr edit <n> --body-file archivo`. (3) Verificar siempre con `gh pr view <n> --json ...` despues de crear o editar; no asumir exito. (4) En PowerShell 5.1 el escape ANSI es `$esc = [string][char]27`, NO backtick-`e` (que es PS 6+): sin eso, los regex para parsear output con color fallan en silencio y devuelven 0 matches.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
