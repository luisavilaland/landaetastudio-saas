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

## SDD para features complejas

Para features con más de 1 día de trabajo, multi-archivo o con cambios arquitectónicos:

1. Decidir si aplica SDD (criterios en `AGENTS.md` sección "SDD Workflow").
2. Primera vez: `/sdd-init` (crea la estructura + testing capabilities + registry).
3. `/sdd-explore` para entender el estado actual.
4. Propuesta + spec formal + diseño (fases `sdd-propose`, `sdd-spec`, `sdd-design`; no tienen slash command propio, las lanza el orquestador o las encadena `/sdd-ff`).
5. Desglose en tareas (fase `sdd-tasks`, sin command propio).
6. `/sdd-apply` para implementar (se apoya en subagentes de Paseo).
7. `/sdd-verify` para verificar contra el spec.
8. `/sdd-archive` para cerrar y archivar.

Modo recomendado: `gentle-orchestrator`, que delega a subagentes internos en vez de hacer el trabajo inline.

Para features acotadas (bug fixes, docs, config, cleanup): NO usar SDD. Seguir el flujo estándar de las secciones 1 a 5 de este documento.
