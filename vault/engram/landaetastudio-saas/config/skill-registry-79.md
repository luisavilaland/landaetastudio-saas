---
id: 79
type: config
project: landaetastudio-saas
scope: project
topic_key: skill-registry
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 13:00:50"
updated_at: "2026-10-01 13:00:50"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "skill-registry"
---

# skill-registry

**What**: Skill registry for landaetastudio-saas project
**Why**: Required by SDD init for hybrid persistence mode
**Where**: .atl/skill-registry.md, Engram
**Learned**: 3 project-level skills (.opencode/skills/), 41 user-level skills scanned, 44 total skills indexed after deduplication

### Skill Registry — landaetastudio-saas

## Sources scanned

- .opencode\skills
- C:\Users\exodo\.agents\skills
- C:\Users\exodo\.config\opencode\skills
- C:\Users\exodo\.claude\skills
- C:\Users\exodo\.gemini\skills
- C:\Users\exodo\.copilot\skills
- C:\Users\exodo\.codex\skills

## Contract

**Delegator use only.** This registry is an index, not a summary. Any agent that launches subagents reads it to select relevant skills, then passes exact `SKILL.md` paths for the subagent to read before work.

`SKILL.md` remains the source of truth. Do not inject generated summaries or compact rules by default; pass paths so subagents load the full runtime contract and preserve author intent.

## Skills

| Skill | Trigger / description | Scope | Path |
| --- | --- | --- | --- |
| `chained-pr` | Trigger: PRs over 400 lines, stacked PRs, review slices. Split oversized changes into chained PRs that protect review focus. | user | `C:\Users\exodo\.agents\skills\chained-pr\SKILL.md` |
| `cognitive-doc-design` | Design docs that reduce cognitive load. Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs. | user | `C:\Users\exodo\.agents\skills\cognitive-doc-design\SKILL.md` |
| `find-skills` | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill. | user | `C:\Users\exodo\.agents\skills\find-skills\SKILL.md` |
| `go-testing` | Trigger: Go tests, go test coverage, Bubbletea teatest, golden files. Apply focused Go testing patterns. | user | `C:\Users\exodo\.agents\skills\go-testing\SKILL.md` |
| `judgment-day` | Trigger: judgment day, dual review, adversarial review, juzgar. Run explicit blind dual review with at most two scoped fix/re-judgment rounds. | user | `C:\Users\exodo\.agents\skills\judgment-day\SKILL.md` |
| `migration-safety` | Usar al crear, editar o aplicar migraciones de DB en landaetastudio-saas. Trigger - cambiar el schema Drizzle, agregar tabla o columna, agregar indice o constraint, correr pnpm db:generate o db:migrate, tocar packages/db/migrations, o cuando el guard de migraciones inmutables falle en CI. | project | `C:\Users\exodo\Documents\saas-ecommerce\.opencode\skills\migration-safety\SKILL.md` |
| `paseo` | Paseo reference for managing projects, workspaces, workspace scripts, agents, schedules, and heartbeats. | user | `C:\Users\exodo\.agents\skills\paseo\SKILL.md` |
| `paseo-advisor` | Spin up a single agent as an advisor — second opinion on the current task. Use when the user says "advisor", "second opinion", "what does X think", or wants an outside take without delegating the work itself. | user | `C:\Users\exodo\.agents\skills\paseo-advisor\SKILL.md` |
| `paseo-committee` | Form a committee of two high-reasoning agents to step back, do root cause analysis, and produce a plan. Use when stuck, looping, tunnel-visioning, or facing a hard planning problem. | user | `C:\Users\exodo\.agents\skills\paseo-committee\SKILL.md` |
| `paseo-handoff` | Hand off the current task to another agent with full context. Use when the user says "handoff", "hand off", "hand this to", or wants to pass work to another agent. | user | `C:\Users\exodo\.agents\skills\paseo-handoff\SKILL.md` |
| `paseo-help` | Answer questions about the Paseo product and app, including setup, configuration, connectivity, providers, workspaces, updates, logs, and troubleshooting. Use when a user inside Paseo asks how Paseo works, how to configure it, or why something is broken; use the paseo skill instead to operate agents and workspaces through MCP or the CLI. | user | `C:\Users\exodo\.agents\skills\paseo-help\SKILL.md` |
| `paseo-loop` | Run an agent loop until an exit condition is met. Use when the user says "loop", "babysit", "keep trying until", "check every X", "watch", or wants iterative autonomous execution. | user | `C:\Users\exodo\.agents\skills\paseo-loop\SKILL.md` |
| `paseo-plugin` | Build and manage trusted local Paseo plugins. Use when the user asks to create, edit, install, reload, enable, disable, remove, or troubleshoot a Paseo plugin; add lifecycle hooks; transform agent configuration, environment, MCP servers, or workspace creation; automate permissions or turn follow-ups; add a native surface, sidebar item, or workspace panel; add Command Center items or slash commands; add composer pills or attachment sources; transform, render, or append agent timeline items; contribute a theme; use Paseo from plugin code; or add plugin RPCs. | user | `C:\Users\exodo\.agents\skills\paseo-plugin\SKILL.md` |
| `rls-audit` | Usar al auditar, agregar o revisar Row Level Security en landaetastudio-saas. Trigger - agregar una tabla de negocio, escribir una query, tocar withTenantContext, habilitar ENABLE/FORCE ROW LEVEL SECURITY, o depurar un tenant que ve datos de otro (0 filas o filas ajenas). Tambien al tocar roles de DB, DATABASE_APP_URL vs DATABASE_URL, o el tracking drizzle.__drizzle_migrations. | project | `C:\Users\exodo\Documents\saas-ecommerce\.opencode\skills\rls-audit\SKILL.md` |
| `skill-creator` | Trigger: new skills, agent instructions, documenting AI usage patterns. Create LLM-first skills with valid frontmatter. | user | `C:\Users\exodo\.agents\skills\skill-creator\SKILL.md` |
| `skill-improver` | Trigger: improve skills, audit skills, refactor skills, skill quality. Audit and upgrade existing LLM-first skills. | user | `C:\Users\exodo\.agents\skills\skill-improver\SKILL.md` |
| `webhook-debug` | Usar al depurar o modificar el webhook de MercadoPago en landaetastudio-saas. Trigger - orden que no cambia de estado, pago que no llega, error de firma HMAC, webhook duplicado o no idempotente, testing del webhook con magic IDs, o cambios en los dos flujos de MP (suscripciones de plataforma vs ordenes de tienda del tenant, ADR-023). | project | `C:\Users\exodo\Documents\saas-ecommerce\.opencode\skills\webhook-debug\SKILL.md` |
| `work-unit-commits` | Plan commits as reviewable work units. Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code. | user | `C:\Users\exodo\.agents\skills\work-unit-commits\SKILL.md` |

## Loading protocol

1. Match task context and target files against the `Trigger / description` column.
2. Pass only the matching `Path` values to the subagent under `## Skills to load before work`.
3. Instruct the subagent to read those exact `SKILL.md` files before reading, writing, reviewing, testing, or creating artifacts.
4. If no matching skill exists, proceed without project skill injection and report `skill_resolution: none`.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
*Topic*: [[topic-skill-registry]]
