---
id: 47
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/prettier-markdown-scope
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 18:29:52"
updated_at: "2026-09-26 18:29:52"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Check acotado no es inventario: 73 archivos markdown, no 4"
---

# Check acotado no es inventario: 73 archivos markdown, no 4

**What**: En el PR #146 afirmé en el body del PR que "4 archivos markdown no pasan prettier --check". Era FALSO. El numero real es **73**, de los cuales 51 son `vault/engram/` (tool-managed), 9 en `vault/` human-curated, 5 en la raiz, 5 en `docs/` y 3 en `.opencode/skills/`.

**Why**: Mi verificacion estaba acotada: corri `prettier --check` pasando los 4 archivos que yo mismo habia modificado, como argumentos explicitos. Nunca corri el glob del repo. Un check acotado no soporta una afirmacion de alcance global, y aun asi la presente como si fuera un inventario. El review de luisavilaland obligo a revisarlo y salio el numero real.

**Where**: vault/03_Deuda/deuda-tecnica.md (item 31, registrado con la cifra correcta), body del PR #146.

**Learned**: (1) Regla general: antes de afirmar "N archivos fallan X", correr el glob completo (`"**/*.md"`, `"**/*.ts"`). Un check sobre los archivos que toque no es un inventario. (2) El desglose por directorio cambia la mitigacion: 51 de los 73 son tool-managed y se regeneran en cada `pnpm vault:export`, asi que corresponde `.prettierignore` antes que formatearlos; los otros 22 si son candidatos a un PR dedicado con `prettier --write`. (3) El error nacio de conectar el hallazgo con algo que ya conocia (los 4 archivos del PR) en vez de con lo que debia medir. (4) Nota tecnica: `pnpm lint` = `turbo run lint` = SOLO eslint por paquete; nunca corre prettier sobre markdown, asi que el DoD que dice "eslint + prettier" no es real. Complementa al item 10 de la deuda.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-discovery]]
