---
id: 54
type: pattern
project: landaetastudio-saas
scope: project
topic_key: tooling/prettier-ignore-convention
session_id: ses_f216661e0ffelsxMUI7mlrIxzP
created_at: "2026-09-26 21:12:27"
updated_at: "2026-09-26 21:12:27"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Prettier: separar formateable de tool-managed y append-only"
---

# Prettier: separar formateable de tool-managed y append-only

**What**: Convencion de `.prettierignore` del proyecto para separar markdown formateable de markdown que no debe tocarse. `.prettierignore` excluye: `vault/engram/` (tool-managed, se regenera en cada `pnpm vault:export`), `vault/02_Bitacora/bitacora.md` (append-only: la historia es inmutable), mas artefactos de build (`node_modules/`, `dist/`, `build/`, `.turbo/`, `.next/`, `coverage/`). Se agrega `format:check` al CI para que no se re-accumule.

**Why**: El item 31 de la deuda registro que el markdown no pasaba `prettier --check` y que nada lo verificaba: `pnpm lint` es `turbo run lint` y solo corre eslint por paquete. Sin el ignore, cualquier `prettier --write` global hubiera reescrito el archivo masgenerated del repo y la bitacora inmutable.

**Where**: `.prettierignore`, `package.json` (script `format:check`), `.github/workflows/ci.yml` (step "Prettier check (markdown)"). PR `chore/prettier-mitigation`, rama `chore/prettier-mitigation`.

**Learned**: (1) Al agregar un check de formato al CI, el orden correcto es: primero decidir que archivos NO deben formatearse, ponerlos en `.prettierignore`, y recien despues correr `--write`. Al reves, se formatea lo que no debe. (2) Los conteos de deuda envejecen: el item 31 decia 73 archivos, pero al ejecutarlo eran 84 (el PR #147 sumo 10 a `vault/engram/` y el PR #148 sumo 11 en `.opencode/commands/`). Releer el item antes de ejecutar su mitigacion. (3) `.prettierignore` aplica a `prettier --check` y `--write` por igual, asi que la exclusion protege tanto el check como el write.

---
*Session*: [[session-ses_f216661e0ffelsxMUI7mlrIxzP]]
*Topic*: [[topic-tooling]]
