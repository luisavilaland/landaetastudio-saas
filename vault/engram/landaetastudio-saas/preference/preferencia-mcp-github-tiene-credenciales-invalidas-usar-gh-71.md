---
id: 71
type: preference
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f2050efdeffez9Tep2TvFd193t
created_at: "2026-09-26 22:04:58"
updated_at: "2026-09-26 22:04:58"
revision_count: 1
tags:
  - landaetastudio-saas
  - preference
aliases:
  - "Preferencia: MCP GitHub tiene credenciales invalidas; usar gh CLI (no esta en PATH)"
---

# Preferencia: MCP GitHub tiene credenciales invalidas; usar gh CLI (no esta en PATH)

**What**: El MCP de GitHub devuelve `Authentication Failed: Bad credentials` (-32603) en cualquier operación. `github_create_pull_request` falló con eso al crear el PR #150. El servidor MCP está autenticado con un token vencido o inválido.

**Why**: Se pierde tiempo diagnosticando un fallo de tooling que no es del repo. Un agente que intente crear un PR por MCP ve un error de auth y puede llegar a pensar que el problema son permisos del repositorio.

**Where**: `opencode.json` (config del MCP de GitHub), `PROMPTS.md` (sección "Localizar gh si no está en PATH"), `vault/03_Deuda/deuda-tecnica.md` (item 32)

**Learned**:
- **`gh` NO está en PATH en esta máquina.** Vive en `C:\Users\exodo\AppData\Local\Temp\gh\bin\gh.exe`. Para usarlo: `$env:Path = "C:\Users\exodo\AppData\Local\Temp\gh\bin;$env:Path"`. El método universal de localización está en PROMPTS.md.
- `gh auth status`: autentica como `EdgarVz` (keyring), scopes `read:org`, `repo`, `workflow`. Protocolo de git: https.
- **MCP GitHub tiene preferencia sobre `gh` en el flujo por defecto, y está roto.** Cuando el MCP de GitHub esté disponible pero falle con auth, caer a `gh` inmediatamente en vez de iterar sobre el MCP.
- Registrado como item 32 de deuda técnica (severidad INFO): re-autenticar el MCP o eliminarlo de `opencode.json` si no se usa.
- Nota de entorno: WSL bash está roto (`execvpe(/bin/bash) failed`). Para scripts `.sh` usar `C:\Program Files\Git\bin\bash.exe`.

---
*Session*: [[session-ses_f2050efdeffez9Tep2TvFd193t]]
