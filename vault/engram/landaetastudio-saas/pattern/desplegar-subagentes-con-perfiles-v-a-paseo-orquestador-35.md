---
id: 35
type: pattern
project: landaetastudio-saas
scope: project
topic_key: workflow/paseo-subagent-orchestration
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 15:33:39"
updated_at: "2026-09-26 15:33:39"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Desplegar subagentes con perfiles vía Paseo (Orquestador)"
---

# Desplegar subagentes con perfiles vía Paseo (Orquestador)

**What**: El Orquestador (este agente, perfil Nemotron 3 Ultra Free) puede crear worktree+workspace de Paseo y desplegar subagentes con perfiles de modelo vía `paseo_create_workspace` + `paseo_create_agent`. No requiere intervención manual del humano.
**Why**: Inicialmente afirmé que los perfiles de modelo no existían y que el despliegue era manual. Estaba equivocado: no había consultado `paseo_list_profiles`.
**Where**: Tools MCP `paseo_*`. Worktree del PR B: `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\skills-complete` (workspace `wks_733c078f3a0767f9`).
**Learned**:
- **SIEMPRE verificar capacidades antes de afirmar que no existen.** `paseo_list_profiles` devuelve los 4 perfiles con provider/model listos para `paseo_create_agent`:
  - Orquestador → `opencode/opencode/nemotron-3-ultra-free` (mode `build`)
  - Diseñador → `opencode/opencode/ling-3.0-flash-fin-free` (mode `build`, thinking `default`)
  - Programador → `opencode/opencode/big-pickle` (mode `build`)
  - QA / Auditor → `opencode/opencode/mimo-v2.6-flash-free` (mode `build`)
- **Prerrequisito no obvio**: git NO permite la misma branch en dos worktrees. Hay que hacer `git checkout develop` en el worktree principal ANTES de `paseo_create_workspace` con `mode: checkout-branch` sobre esa branch.
- `paseo_create_workspace` params que funcionan: `isolation: "worktree"`, `path` (checkout origen), `mode: "checkout-branch"`, `branch`, `worktreeSlug`, `title`. Devuelve `workspaceId` + `cwd`.
- **`background` NO es una key reconocida** en `paseo_create_agent` en esta versión de la API (error `unrecognized_keys`). Los agentes igual quedan `status: running` y se reporta con `notifyOnFinish: true`.
- `paseo_list_workspaces` muestra 10 workspaces; el de este proyecto es `wks_b14ea16d10d416b5` (local checkout en `Documents/saas-ecommerce`).
- Patrón de scopes disjuntos: 3 subagentes en el MISMO workspace, cada uno escribiendo un set de archivos que no se solapa, y el orquestador reserve `vault/02_Bitacora/bitacora.md` (append-only) para sí mismo.
- Los subagentes NO deben hacer commit ni push: solo editar y reportar. El orquestador integra, commitea y pushea.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-workflow]]
