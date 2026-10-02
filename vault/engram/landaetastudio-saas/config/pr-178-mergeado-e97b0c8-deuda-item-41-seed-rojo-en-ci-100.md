---
id: 100
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 20:02:11"
updated_at: "2026-10-02 20:02:11"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "PR #178 mergeado e97b0c8 + deuda item 41 seed rojo en CI"
---

# PR #178 mergeado e97b0c8 + deuda item 41 seed rojo en CI

**What**: PR #178 mergeado a develop (`e97b0c8`, squash, 19:58:38Z). Registrada la deuda item 41 (`seed` rojo en CI por `drizzle-kit migrate`) en `vault/03_Deuda/deuda-tecnica.md`, en branch `chore/deuda-seed-ci`.

**Why**: Cerrar el spike T0 y dejar documentado el fallo preexistente de CI que hacia parecer rojo el PR #178.

**Where**:
- develop: `e97b0c8`
- `vault/03_Deuda/deuda-tecnica.md` - item 41 (empieza en L876)
- branch `chore/deuda-seed-ci`

**Learned**:

1. **PR #178 mergeado con `seed` y `e2e-success` en rojo**, con autorizacion explicita del humano. `build`, `wait-for-deployments` y los 3 deploys de Vercel en SUCCESS. `reviewDecision: APPROVED`.

2. **`gh pr merge --delete-branch` no borra el worktree local** si la branch esta checked out en un worktree de Paseo. Queda huerfano: `git worktree remove <path> && git branch -D chore/spike-t0-fase2` hay que correrlo desde el main worktree.

3. **La deuda mas grave es que `seed` es el UNICO job que valida migraciones** (aplicarlas sobre BD limpia). Si esta roto, nadie detecta una migracion rota antes de produccion. No es solo ruido de pipeline.

4. **`develop` solo corre `build`**, nunca `seed` ni `e2e`. Por eso su estado verde **no es comparable** con el de un PR. Solo los PRs ejercitan esa parte del pipeline, y por eso el fallo solo aparece en PRs.

5. **`drizzle-kit migrate` traga el error:** imprime `[⣷] applying migrations...` y sale con codigo 1 sin ningun mensaje. Ni la migracion que fallo, ni la causa. Caracteristico de error de conexion/permisos perdido por el spinner. Los tests de migracion no lo detectan - hace falta MP/Neon real.

6. **El item 41 quedo como ALTO / MEDIA.** No bloquea desarrollo pero degrada la red de seguridad de migraciones y vuelve lento cada PR.

7. **Numeracion de deuda:** el ultimo item era 39. **No existia item 40.** Se uso 41 como indico el humano, dejando el 40 sin asignar. Verificar antes de crear el proximo.

8. **Vigilancia de encoding en archivos acumulativos:** el append de `deuda-tecnica.md` metio un U+FFFD real (mojibake) en "produccion". Se detecto escaneando `[char]0xFFFD` sobre el rango nuevo y se corrigio. El preexistente de L501 es **intencional** (cita ejemplo de mojibake dentro del item 32) - no tocarlo. Regla util: tras escribir en `bitacora.md` o `deuda-tecnica.md`, buscar `\uFFFD` explicitamente, no solo CJK.

9. **Verificacion de append-only:** `git diff -- <archivo> | Select-String "^-"` excluyendo `---` debe dar 0 lineas. Confirma que no se perdio contenido previo. El append quedo en 62 lineas puramente aditivas, incluso despues de `prettier --write`.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
