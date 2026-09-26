---
id: 37
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f21a9a7d3ffeSu00md4p1ONR1V
created_at: "2026-09-26 15:36:05"
updated_at: "2026-09-26 15:36:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría de skills F1+F2 (41 únicas reales)"
---

# Auditoría de skills F1+F2 (41 únicas reales)

**What**: Auditoría completa del inventario de skills del proyecto: 107 directorios en 4 raíces → 48 nombres únicos (47 sin _shared) → 41 skills reales con SKILL.md; clasificadas 29 activa / 10 latente / 1 genérica / 1 no aplica.
**Why**: Brief pedía verificar el inventario real (decía 46 únicas, no coincide con disco) y evaluar skills externas (F2).
**Where**: vault/04_Fases/2026-09-26-skills-audit.md (único archivo escrito)
**Learned**: (1) `opencode skills list` NO existe — solo el help, exit 1; la evidencia real de carga es el bloque available_skills (42 = 41 disco + customize-opencode built-in). (2) 6 directorios son shells vacías sin SKILL.md (branch-pr, comment-writer, gentle-ai-bench, issue-creation, rdd-defect-workflow, systemic-issue-triage) y ~/.claude/skills/ está casi todo vacío/copiado incompleto. (3) .atl/ ignorado en .gitignore:118. (4) npm `skilldoctor` → 404; `saas-starter-skills@0.1.0` existe con 15 skills de dominio SaaS (0 solape con las nuestras, fusionar 4 a mano); awesome-opencode-skills = jshsakura/awesome-opencode-skills (port de VoltAgent, 175+), instalar en bloque no conviene.

---
*Session*: [[session-ses_f21a9a7d3ffeSu00md4p1ONR1V]]
