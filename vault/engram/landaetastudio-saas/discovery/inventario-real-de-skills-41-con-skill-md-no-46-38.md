---
id: 38
type: discovery
project: landaetastudio-saas
scope: project
topic_key: skills/inventory-2026-09
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 15:37:34"
updated_at: "2026-09-26 15:37:34"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Inventario real de skills: 41 con SKILL.md, no 46"
---

# Inventario real de skills: 41 con SKILL.md, no 46

**What**: Inventario real de skills del proyecto. 107 directorios → 48 nombres únicos (47 sin `_shared`) → **41 skills con `SKILL.md`**. El "46" que yo y el brief asserted NO se reproduce en disco. Runtime expone 42 (= 41 + `customize-opencode` built-in). `opencode skills list` NO existe.
**Why**: F1 del PR B (subagente QA/Auditor, perfil MiMo-V2.6-Flash Free).
**Where**: Reporte en `vault/04_Fases/2026-09-26-skills-audit.md` (rama `chore/skills-complete`).
**Learned**:
- **Por raíz**: `~/.config/opencode/skills` 19 cargables, `~/.agents/skills` 27 (incluye 7 de paseo), `~/.claude/skills` 7 (copias casi vacías), superpowers 14.
- **Higiene pendiente**: 6 shells vacías sin `SKILL.md` (`branch-pr`, `comment-writer`, `gentle-ai-bench`, `issue-creation`, `rdd-defect-workflow`, `systemic-issue-triage`) + `~/.claude/skills/` casi enteramente incompleto.
- **Clasificación**: 29 útil activa / 10 útil latente / 1 genérica (`paseo-plugin`) / 1 no aplica (`go-testing`).
- **Conflicto a resolver en integración**: la skill `subagent-driven-development` (de superpowers) instruye usar el mechanism de subagentes de OpenCode, y choca con la sección que el Diseñador escribió en AGENTS.md ("Paseo es el mecanismo exclusivo"). Hay que documentar la precedencia.
- `.atl/` **sí** está gitignored (`.gitignore:118`, `git check-ignore` exit 0).
- **F2**: `saas-starter-skills@0.1.0` existe, 15 skills de dominio, **0 solape** con las 41 → fusionar 4 a mano (multi-tenancy, subscription-billing, api-routes-and-validation, database-schema). `skilldoctor` → **404 Not Found en npm, no instalar**. `awesome-opencode-skills` (jshsakura, 175+) → no instalar en masa; adoptar `nextjs-developer`, `postgres-pro`, `payment-integration`, `security-auditor`, `typescript-pro`.
- **Metodología que funciona con subagentes**: darles el contexto real del proyecto (paths de archivos, nombres exactos de tests, valores de package.json) en el prompt, para que verifiquen contra el código en vez de escribir de memoria. El subagente B asíConfirmó los 8 casos de `rls-cross-tenant.test.ts` leyéndolos del archivo y detectó que el endpoint de suscripciones de ADR-023 no existe en esta branch.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-skills]]
