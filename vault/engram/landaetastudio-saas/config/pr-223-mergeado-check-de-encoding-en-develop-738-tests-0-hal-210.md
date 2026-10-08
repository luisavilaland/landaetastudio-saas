---
id: 210
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 17:28:13"
updated_at: "2026-10-08 17:28:13"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR 223 mergeado: check de encoding en develop, 738 tests, 0 hallazgos nuevos"
---

# PR 223 mergeado: check de encoding en develop, 738 tests, 0 hallazgos nuevos

**What**: PR #223 mergeado en develop como `fc06090` (squash, 7 archivos, +545/-40). CI post-merge `completed/success`, lo que prueba que `check:encoding` corre dentro del job `build`. Item 75 → **RESUELTO**. develop limpio en código; 738/738 tests; 0 PRs; 0 issues; 1 worktree; 9 workspaces.

**Why**: `format:check` era `prettier --check "**/*.md"` — solo markdown. **Ningún PR anterior verificó codepoints sobre TypeScript.** Con GGA excluyendo `*test.ts` y ningún otro control viendo doble encoding (el archivo sigue siendo UTF-8 válido), un `.ts` corrupto pasaba lint, typecheck, vitest y prettier.

**Where**: `scripts/check-encoding.mjs` (8.8 KB), `scripts/__tests__/check-encoding.test.ts` (11 tests), `package.json` (`check:encoding` + `format:check`), `AGENTS.md`, `docs/superpowers/specs/2026-09-subscription-lifecycle.md` (BOM de 3 bytes), `vault/03_Deuda/deuda-tecnica.md`, `vault/02_Bitacora/bitacora.md`. develop @ `fc06090`.

**Learned**: (1) **El paso cero del item 73 evitó dos errores distintos.** El workspace de Paseo de #223 ya no existía (auto-eliminado al desaparecer el worktree): archivarlo habría sido un no-op sobre el único candidate equivocado — el workspace de la sesión activa. (2) **El worktree de #223 pesaba 1.2 GB**, casi el triple de los anteriores: install doble + `pnpm build` completo de las 3 apps. Crece por uso, no es constante. (3) **Verifiqué la recuperabilidad antes de descartar**: los 3 exports de Engram (obs 207/208/209) existían SOLO en el worktree que borraba. No asumí que el export los regeneraría — corrí `pnpm vault:export` en el main worktree y confirmé que los 3 reaparecieron. (4) **Los tests contra Neon son intermitentes y eso NO es de este PR**: en 1 de 4 corridas dos archivos (o uno a nivel de archivo con 0 tests fallados) dan error transitorio; 3 de 4 dan 70/70 limpio. Ambos hittean `DATABASE_APP_URL` real. Es una fuente conocida de ruido: **un `pnpm test` rojo aislado no es evidencia de nada hasta que se reproduce.**

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
