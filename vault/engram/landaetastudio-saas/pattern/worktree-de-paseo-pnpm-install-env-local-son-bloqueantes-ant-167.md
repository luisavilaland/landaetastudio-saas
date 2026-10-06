---
id: 167
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 14:11:47"
updated_at: "2026-10-06 14:11:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Worktree de Paseo: pnpm install + .env.local son BLOQUEANTES antes de DoD"
---

# Worktree de Paseo: pnpm install + .env.local son BLOQUEANTES antes de DoD

**What**: El setup del worktree de Paseo (`pnpm install` + `.env.local`) queda documentado en AGENTS.md como **prerequisito BLOQUEANTE** de cualquier DoD, con tabla de evidencia.

**Why**: En el PR #196 el `pnpm typecheck` dio **0/9 con una junction** a `node_modules` y **9/9 con install real**. Un DoD sin este setup no es evidencia.

**Where**: `AGENTS.md`, seccion "Nota sobre worktrees de Paseo", nueva subseccion "Setup completo es BLOQUEANTE antes de cualquier DoD"

## El mecanismo de la falla con junction

pnpm anida un `node_modules` **por paquete**. Una junction al `node_modules` raiz del worktree principal solo resuelve el raiz: los imports de paquete siguen sin resolverse y `tsc` falla con `Cannot find module 'next/server'`, que **parece un error de codigo y no de entorno**.

Ademas, sin install real, `prettier` no resuelve `prettier-plugin-tailwindcss` (lo declara `.prettierrc`) y **falla con exit 1 sin formatear nada** -- un falso negativo dangerouso: parece que el archivo ya estaba bien.

## Secuencia correcta

```bash
cp <main-worktree>/.env.local .env.local
pnpm install                # REAL, no junction
ls -d node_modules && ls -l .env.local   # verificar ambos
# recien entonces: lint / typecheck / test / build / format:check
```

## Por que "no correr DoD en el worktree principal"

El DoD verifica **el candidato** (la rama). El worktree principal esta en otra rama. Correrlo ahi verifica el develop, no lo que se va a mergear.

## Learned

- **Un junction a `node_modules` es peor que no tener nada**: produce un error con apariencia de bug de codigo. `Cannot find module` lleva a depurar imports en lugar de detectar que falta el install.
- **"Exit 1 sin formatear nada" es peor que un error de formato**: `prettier --write` que falla por plugin no resuelto deja el archivo sin tocar y reporta un exito falso si no se mira el exit code.
- **Verificar el DoD en la rama, no en develop.** Es la distincion entre evidencia y decoracion.
- Aplicar la regla en el mismo PR que la documenta obliga a verificar que funciona: este PR aplico el setup completo antes de correr el DoD, y por eso el `typecheck` dio 9/9 a la primera.

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
