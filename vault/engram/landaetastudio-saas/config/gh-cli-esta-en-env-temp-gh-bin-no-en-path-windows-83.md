---
id: 83
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 15:07:14"
updated_at: "2026-10-01 15:07:14"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "gh CLI esta en $env:TEMP\\gh\\bin, no en PATH (Windows)"
---

# gh CLI esta en $env:TEMP\gh\bin, no en PATH (Windows)

**What**: El binario `gh` NO esta en el PATH de Windows en esta maquina. Vive en `$env:TEMP\gh\bin\gh.exe` (instalacion portable). El MCP de GitHub tiene credenciales invalidas, asi que `gh` es la unica via para crear PRs.

**Why**: Se intento crear el PR del planning de Fase 2 con la herramienta MCP `github_create_pull_request` y fallo con `MCP error -32603: Authentication Failed: Bad credentials`. Es el item 32 de `vault/03_Deuda/deuda-tecnica.md` ya registrado. Luego `gh pr create` fallo con `CommandNotFoundException` porque no esta en el PATH.

**Where**: Herramienta global de la sesion. Comandos que la usan: creacion de PRs, consulta de CI, reviews.

**Learned**:

1. **Siempre invocar gh con path absoluto + limpiar GITHUB_TOKEN:**
```powershell
$gh = "$env:TEMP\gh\bin\gh.exe"; Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
& $gh <args>
```

2. **Por que `Remove-Item Env:GITHUB_TOKEN` es obligatorio:** hay un `GITHUB_TOKEN` en el entorno (lo consume `~/.config/opencode/gh-mcp-wrapper.cmd`, que lo mapea a `GITHUB_PERSONAL_ACCESS_TOKEN` para el MCP de GitHub). Ese token esta **expirado/invalido**. Si se deja en el entorno, `gh` lo prioriza sobre su propia credencial del keyring y falla aunque `gh auth status` muestre la sesion activa. Al removerlo, `gh` usa el token del keyring y funciona.

3. **Estado de la sesion de gh:** cuenta `EdgarVz`, scopes `read:org`, `repo`, `workflow`, protocolo git `https`, credencial en el keyring de Windows.

4. **Diagnostico en 3 pasos cuando falla una operacion de GitHub:**
   - MCP falla con Bad credentials -> item 32 conocido, no es regresion nueva
   - `gh` no encontrado en PATH -> usar el path portable de arriba
   - `gh` encontrado pero falla auth -> casi seguro es `GITHUB_TOKEN` del entorno eclipsando el keyring

5. **No sortear modifying credenciales.** Ante credenciales invalidas de un servicio, el camino correcto es reportar y que el humano las renueve. No regenerar tokens, no parchear el wrapper, no escribir tokens a mano.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
