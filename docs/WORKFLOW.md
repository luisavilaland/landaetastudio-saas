# Workflow estándar de PR

## 1. Preparación

- Crear worktree + workspace en Paseo.
- Copiar `.env.local` del main worktree.
- Verificar Engram MCP connected (`opencode mcp list | grep engram`).
- Leer bitácora reciente (`vault/02_Bitacora/bitacora.md`).

## 2. Ejecución

- Decidir si usar subagentes (perfiles Paseo: `@Programador`, `@QA`, etc.).
- Grabar memorias en Engram proactivamente (no solo retroactivamente).
- Cargar skills relevantes (automático por trigger).

## 3. Verificación

- DoD: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- GGA pre-commit (automático al hacer `git commit`).
- Bitácora actualizada (append-only, una entrada por PR).
- Docs afectadas actualizadas.

## 4. Cierre

- Export Engram al vault (`pnpm vault:export`).
- Commit + push + PR.
- Reportar al humano (NO esperar CI).

## 5. Post-merge

- Actualizar develop local (`git checkout develop && git pull`).
- Limpiar branches (safe delete + verificar que no haya cambios pendientes).
- Export Engram si hubo memorias nuevas.
