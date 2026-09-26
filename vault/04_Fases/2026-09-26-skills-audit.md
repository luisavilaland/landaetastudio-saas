# Auditoría de skills — 2026-09-26

**Proyecto:** landaetastudio-saas (multi-tenant SaaS, Next.js 16 + Drizzle + PostgreSQL)
**Scope:** F1 (inventario real) + F2 (skills externas)
**Restricción:** este es el único archivo escrito. Sin commit, sin push.

---

## F1 — Inventario real de skills

### 1. Inventario por raíz

Comando: `Get-ChildItem <ruta> -Directory` (+ barrido recursivo de `SKILL.md`).

| Raíz        | Path                                                  | Directorios | Con `SKILL.md` | Sin `SKILL.md` |
| ----------- | ----------------------------------------------------- | ----------- | -------------- | -------------- |
| opencode    | `~/.config/opencode/skills/`                          | 26          | 19             | 7              |
| claude      | `~/.claude/skills/`                                   | 33          | 7              | 26             |
| superpowers | `~/.config/opencode/node_modules/superpowers/skills/` | 14          | 14             | 0              |
| agents      | `~/.agents/skills/`                                   | 34          | 27             | 7              |
| **Total**   |                                                       | **107**     | **67**         | **40**         |

**Deduplicación por nombre de directorio:**

- 107 directorios → **48 nombres únicos** (incluye `_shared`).
- Excluyendo `_shared` → **47 nombres únicos**.
- **41 skills únicas con `SKILL.md`** (las únicas realmente cargables).

> **Discrepancia con el número del brief (46):** el brief indica "46 únicas tras deduplicar". Verifiqué en disco: 48 únicos con `_shared`, 47 sin él, 41 con `SKILL.md`. El 46 no coincide con ninguna de las tres cifras; la más próxima es 47 (nombres únicos sin `_shared`). Reporto los números medidos, no los del brief.

### 2. Directorios SIN `SKILL.md` (shells vacías / solo `references/`)

Estos nombres existen en las raíces opencode + claude + agents pero **no son skills** (no hay frontmatter que leer):

| Directorio              | Contenido real                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `branch-pr`             | vacío                                                                                        |
| `comment-writer`        | vacío                                                                                        |
| `gentle-ai-bench`       | vacío                                                                                        |
| `issue-creation`        | solo `references/`                                                                           |
| `rdd-defect-workflow`   | vacío                                                                                        |
| `systemic-issue-triage` | vacío                                                                                        |
| `_shared`               | no es skill (contratos compartidos de SDD: `skill-resolver.md`, `sdd-phase-common.md`, etc.) |

Además, en `~/.claude/skills/` 19 directorios tienen solo `references/` o están vacíos (`chained-pr`, `cognitive-doc-design`, `go-testing`, `judgment-day`, `sdd-*` ×11, `skill-creator`, `skill-improver`, `skill-registry`, `work-unit-commits`): son copias incompletas. El contenido real de esos skills vive en `~/.config/opencode/skills/` y `~/.agents/skills/`.

### 3. Solapamiento entre raíces

- 25 nombres ×3 raíces (opencode + claude + agents): `chained-pr`, `cognitive-doc-design`, `go-testing`, `judgment-day`, `sdd-*` (11), `skill-creator`, `skill-improver`, `skill-registry`, `work-unit-commits` + los 6 shells + `_shared`.
- 7 nombres ×2 raíces (claude + agents): `paseo`, `paseo-advisor`, `paseo-committee`, `paseo-handoff`, `paseo-help`, `paseo-loop`, `paseo-plugin`.
- 14 exclusivos de superpowers (sin solape).
- 1 exclusivo de agents: `find-skills`.
- **Solapamiento total:** 32 nombres duplicados en ≥2 raíces; 16 nombres en una sola raíz (14 superpowers + `find-skills` + …).

### 4. Clasificación de las 41 skills únicas

| Skill                          | Raíz                   | Categoría    | Razón                                                                                     | Mantener                    |
| ------------------------------ | ---------------------- | ------------ | ----------------------------------------------------------------------------------------- | --------------------------- |
| chained-pr                     | opencode/claude/agents | útil activa  | PRs >400 líneas; el proyecto trabaja por PR                                               | Sí                          |
| cognitive-doc-design           | opencode/claude/agents | útil activa  | Docs/specs en español (`docs/superpowers/`, README, ADRs)                                 | Sí                          |
| go-testing                     | opencode/claude/agents | no aplica    | Go; el stack es TypeScript/Next.js                                                        | No                          |
| judgment-day                   | opencode/claude/agents | útil activa  | Auditorías por tarea exigidas en AGENTS.md (@QA + @Diseñador)                             | Sí                          |
| sdd-apply                      | opencode/claude/agents | útil activa  | Flujo SDD por fases del blueprint v2.6                                                    | Sí                          |
| sdd-archive                    | opencode/claude/agents | útil activa  | Cierre de cambios SDD                                                                     | Sí                          |
| sdd-design                     | opencode/claude/agents | útil activa  | Diseño técnico por fase                                                                   | Sí                          |
| sdd-explore                    | opencode/claude/agents | útil activa  | Exploración previa a specs                                                                | Sí                          |
| sdd-init                       | opencode/claude/agents | útil activa  | Inicialización SDD del proyecto                                                           | Sí                          |
| sdd-onboard                    | opencode/claude/agents | útil latente | Onboarding al ciclo SDD; no se usó aún                                                    | Sí (latente)                |
| sdd-propose                    | opencode/claude/agents | útil activa  | Propuestas de cambio                                                                      | Sí                          |
| sdd-research                   | opencode/claude/agents | útil activa  | Evidencia externa antes de specs                                                          | Sí                          |
| sdd-spec                       | opencode/claude/agents | útil activa  | Specs por fase (`docs/superpowers/specs/`)                                                | Sí                          |
| sdd-tasks                      | opencode/claude/agents | útil activa  | Plans por fase (`docs/superpowers/plans/`)                                                | Sí                          |
| sdd-verify                     | opencode/claude/agents | útil activa  | Verificación post-implementación                                                          | Sí                          |
| skill-creator                  | opencode/claude/agents | útil activa  | Política de skills del proyecto (AGENTS.md)                                               | Sí                          |
| skill-improver                 | opencode/claude/agents | útil activa  | Auditoría de skills al cierre de fase (AGENTS.md)                                         | Sí                          |
| skill-registry                 | opencode/claude/agents | útil activa  | Registro `.atl/skill-registry.md`                                                         | Sí                          |
| work-unit-commits              | opencode/claude/agents | útil activa  | Commits atómicos por unidad de trabajo                                                    | Sí                          |
| paseo                          | claude/agents          | útil activa  | Paseo es el orquestador exclusivo de subagentes                                           | Sí                          |
| paseo-advisor                  | claude/agents          | útil latente | Segunda opinión; no se usó aún                                                            | Sí (latente)                |
| paseo-committee                | claude/agents          | útil latente | Planificación de problemas duros; no se usó aún                                           | Sí (latente)                |
| paseo-handoff                  | claude/agents          | útil latente | Handoff entre agentes; no se usó aún                                                      | Sí (latente)                |
| paseo-help                     | claude/agents          | útil latente | Soporte de Paseo; solo si hay dudas de config                                             | Sí (latente)                |
| paseo-loop                     | claude/agents          | útil latente | Loops/babysitting; no se usó aún                                                          | Sí (latente)                |
| paseo-plugin                   | claude/agents          | genérica     | Construcción de plugins de Paseo; sin relación con el SaaS                                | No                          |
| find-skills                    | agents                 | útil latente | Descubrimiento/instalación de skills nuevas                                               | Sí (latente)                |
| brainstorming                  | superpowers            | útil latente | Relevante antes de features, pero el flujo SDD lo reemplaza                               | Sí (latente)                |
| dispatching-parallel-agents    | superpowers            | útil activa  | Tareas independientes en paralelo (vía Paseo)                                             | Sí                          |
| executing-plans                | superpowers            | útil activa  | Ejecución de los plans por fase                                                           | Sí                          |
| finishing-a-development-branch | superpowers            | útil latente | El proyecto usa flujo de PR, no merge local directo                                       | Sí (latente)                |
| receiving-code-review          | superpowers            | útil activa  | Review feedback en PRs                                                                    | Sí                          |
| requesting-code-review         | superpowers            | útil activa  | Request de review antes de mergear                                                        | Sí                          |
| subagent-driven-development    | superpowers            | útil latente | Choca con la regla "Paseo es el mecanismo exclusivo de subagentes"; revisar antes de usar | Sí (latente, con conflicto) |
| systematic-debugging           | superpowers            | útil activa  | Debug de bugs de RLS/webhooks/pagos                                                       | Sí                          |
| test-driven-development        | superpowers            | útil activa  | DoD exige tests para lógica nueva                                                         | Sí                          |
| using-git-worktrees            | superpowers            | útil activa  | Paseo crea worktrees automáticamente                                                      | Sí                          |
| using-superpowers              | superpowers            | útil activa  | Meta-skill: descubrimiento de skills (siempre cargada)                                    | Sí                          |
| verification-before-completion | superpowers            | útil activa  | DoD: `pnpm lint/typecheck/build/test` antes de afirmar éxito                              | Sí                          |
| writing-plans                  | superpowers            | útil activa  | Plans de fases del blueprint                                                              | Sí                          |
| writing-skills                 | superpowers            | útil activa  | Edición de skills del proyecto                                                            | Sí                          |

**Conteo por categoría (41 únicas):**

| Categoría    | Cantidad |
| ------------ | -------- |
| útil activa  | 29       |
| útil latente | 10       |
| genérica     | 1        |
| no aplica    | 1        |

Únicas por raíz de origen (donde el `SKILL.md` real existe): opencode 19, agents `find-skills` + paseo×7 = 8 (los paseo también están en claude), superpowers 14 → 19 + 8 + 14 = 41. `~/.claude/skills/` no aporta ninguna skill con contenido propio (sus 7 `SKILL.md` son copias de las de agents).

### 5. ¿Qué carga el runtime?

- `opencode skills list` → **el comando no existe**. Salida real: `opencode` muestra el help (`completion | acp | mcp | run | debug | providers | agent | upgrade | uninstall | serve | web | models | attach | serve | web`), exit code `1`, sin subcomando `skills`. No se inventa el listado desde CLI.
- **Evidencia real disponible:** el bloque `<available_skills>` del system prompt de esta sesión lista **42 entradas** = **41 skills con `SKILL.md` en disco** + `customize-opencode` (marcada `<built-in>`, no viene de estos 4 directorios).
- Correspondencia exacta: **cada directorio con `SKILL.md` está cargado**; las 7 shells sin `SKILL.md` y `_shared` **no** aparecen. No hay skills cargadas que no existan en disco ni skills en disco ignoradas.

### 6. `.atl/` en git

```
$ git check-ignore -v ".atl/"
.gitignore:118:.atl/	.atl/
```

Sí está ignorado (`.gitignore` línea 118), exit code `0`. El registro `.atl/skill-registry.md` no se comitea.

---

## F2 — Evaluación de skills externas

### 1. `saas-starter-skills`

```
$ npm view saas-starter-skills
saas-starter-skills@0.1.0 | MIT | deps: none | versions: 1
Production-grade full-stack SaaS skills for AI coding agents — Next.js, Postgres/Drizzle,
Auth, Stripe & Vercel patterns for Codex, Claude Code, Cursor, and OpenCode.
https://github.com/param087/saas-starter-skills#readme
unpackedSize: 67.2 kB · published 3 months ago by param087
```

`npm pack saas-starter-skills --dry-run` → 20 archivos, 15 skills:

`api-routes-and-validation`, `authentication`, `authorization-rbac`, `background-jobs`, `data-access-layer`, `database-schema`, `deployment-and-ci`, `environment-and-config`, `file-uploads-and-storage`, `multi-tenancy`, `observability-and-errors`, `payments-stripe`, `project-scaffolding`, `subscription-billing`, `transactional-email`

**Comparación con las 41 únicas:** solape de nombres = **0**. Las nuestras son de proceso (SDD, PRs, reviews, Paseo); las suyas son de **dominio SaaS** — exactamente el hueco que nuestras 41 no cubren.

**Recomendación: FUSIONAR (selectivamente).**

- Adoptar y adaptar: `multi-tenancy` ( nuestro RLS por columna es el patrón más fino que el genérico), `subscription-billing` (blueprint v2.6 fase de suscripciones), `api-routes-and-validation` (checklist de endpoints de AGENTS.md), `database-schema` (migraciones append-only).
- Adaptar o ignorar: `payments-stripe` → nuestro gateway es MercadoPago (webhook idempotente, `x-test-order-id`); usarlo solo como checklist genérico de idempotencia/retries.
- Ignorar: `project-scaffolding`, `deployment-and-ci` (Vercel/CI propio ya definido), `background-jobs`, `file-uploads-and-storage` (ya resuelto con `@repo/storage`).
- Riesgo: es v0.1.0 con un solo mantenedor y 3 meses de vida; **no instalar el binario automáticamente** (`bin: saas-starter-skills` ejecuta `install.mjs`). Extraer los `SKILL.md` a mano y reescribirlos contra AGENTS.md.

### 2. `skilldoctor`

```
$ npm view skilldoctor
npm error 404 Not Found - GET https://registry.npmjs.org/skilldoctor - Not found
npm error 404  'skilldoctor@*' is not in this registry.
```

**Recomendación: NO instalar — el paquete no existe en npm (404).** No hay nada que auditar con él. Para auditar skills ya está `skill-improver` (propio, cargado) + `skill-registry`; con eso cubrimos el caso de uso sin dependencia externa.

### 3. `awesome-opencode-skills`

No es un paquete npm: es una lista curada en GitHub. Búsqueda web directa falló con `StatusCode: non 2xx status code (403 POST https://mcp.exa.ai/mcp)`; se resolvió vía GitHub search. Resultado principal:

- **`jshsakura/awesome-opencode-skills`** (28 ★, actualizado hace 11 días): port automático 1:1 de `VoltAgent/awesome-codex-subagents`, **175+ skills** en 13 categorías, formato `SKILL.md` nativo de OpenCode, instalador (`install.ps1` / `install.sh`) que copia todo el set.
- Otros: `weisser-dev/awesome-opencode` (108 agents, 15 skills, CLI), `anantsharma67/awesome-opencode-skills`, `bschooled/awesome-opencode` (puente a `github/awesome-copilot`).

**3-5 skills aplicables a este proyecto** (del listado de `jshsakura`):

| Skill                 | Aplicación al proyecto                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `nextjs-developer`    | App Router, Server Components, server actions, modos de render — stack central                   |
| `postgres-pro`        | Schema, locks, índices, rendimiento de queries bajo RLS                                          |
| `payment-integration` | Checkout, idempotencia de webhooks, retries, estados de settlement — mapea directo a MercadoPago |
| `security-auditor`    | Auth flows, secrets, validación de entrada — complementa las auditorías @QA                      |
| `typescript-pro`      | Tipado explícito obligatorio del stack (interface vs type, sin `any`)                            |

**Recomendación: IGNORAR la instalación masiva** (el `install.ps1` vuelca 175+ skills y diluiría el índice de 41). Adoptar caso por caso, 1 skill a la vez, con `skill-creator` y registrándolo después con `skill-registry`. Evita además el riesgo de skills no auditadas (el README advierte: _"We do not audit or guarantee the security or correctness of any subagent"_).

---

## Resumen ejecutivo

- **Inventario verificado:** 107 directorios → 48 nombres únicos (47 sin `_shared`) → **41 skills reales con `SKILL.md`**; el "46" del brief no se reproduce en disco.
- **Cobertura runtime:** las 41 del disco + 1 built-in (`customize-opencode`) = 42 cargadas; `opencode skills list` no existe como comando.
- **Higiene:** 6 shells vacías ×3 raíces + `~/.claude/skills/` casi entero sin contenido → candidatas a limpieza (no se tocó nada en esta auditoría).
- **Clasificación:** 29 activa / 10 latente / 1 genérica / 1 no aplica (`go-testing`).
- **F2:** `saas-starter-skills` → fusionar selectivamente (4 de 15, a mano); `skilldoctor` → no existe en npm (404), no instalar; `awesome-opencode-skills` → no instalar en bloque, adoptar `nextjs-developer`, `postgres-pro`, `payment-integration`, `security-auditor`, `typescript-pro` una a una.
