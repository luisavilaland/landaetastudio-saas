---
id: 36
type: config
project: landaetastudio-saas
scope: project
topic_key: config/opencode-project-skills
session_id: ses_f21a93bb8ffe0v4n8CiIMEJRxh
created_at: "2026-09-26 15:35:42"
updated_at: "2026-09-26 15:35:42"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Fixed dead ponytail plugin ref and registered project skills path in opencode.json"
---

# Fixed dead ponytail plugin ref and registered project skills path in opencode.json

**What**: Eliminé la clave `plugin` muerta de `opencode.json` y agregué `"skills": { "paths": [".opencode/skills"] }`. Creé 3 skills del proyecto: rls-audit, migration-safety, webhook-debug.

**Why**: El plugin `.opencode/ponytail/.opencode/plugins/ponytail.mjs` nunca existió en el repo; la única referencia era la propia línea en opencode.json. Y sin `skills.paths` OpenCode no descubre las skills del proyecto (la config global solo registra `~/.claude/skills`).

**Where**: opencode.json, .opencode/skills/{rls-audit,migration-safety,webhook-debug}/SKILL.md

**Learned**:
- `gentle-ai skill-registry refresh --cwd .` FALLA en un git worktree con "filesystem-root: . is not a project root". Causa: en un worktree `.git` es un ARCHIVO (puntero `gitdir:`), no un directorio, y la detección de raíz de proyecto lo exige como directorio. Workaround: pasar el path ABSOLUTO (`--cwd "C:\...\skills-complete"`), que sí funciona. Con eso: "Skill registry refreshed (18 skills)".
- `.atl/` está en .gitignore (línea 118), así que el refresh del registry no aparece en `git status`.
- El refresh sí registra `.opencode\skills` como source, confirmando que `skills.paths` en opencode.json es lo que habilita el descubrimiento.
</content>
<project>saas-ecommerce

---
*Session*: [[session-ses_f21a93bb8ffe0v4n8CiIMEJRxh]]
*Topic*: [[topic-config]]
