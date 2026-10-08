---
id: 220
type: discovery
project: landaetastudio-saas
scope: project
topic_key: discovery/worktree-paseo-auto-eliminado-stash-solo-protegia-lo-stasheado
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 19:43:57"
updated_at: "2026-10-08 19:43:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "El worktree de Paseo se auto-elimino: stash salva, working tree no"
---

# El worktree de Paseo se auto-elimino: stash salva, working tree no

**What**: El worktree de Paseo se auto-eliminó a mitad del fix del item 68, con cambios de working tree sin commitear. El fix de `route.ts` se recupero de `stash@{0}`; los 4 tests se perdieron y hubo que reescribirlos.

**Why:** Un worktree de Paseo puede desaparecer sin aviso mientras se trabaja en el. El directorio borro completo y dejo la registration de git huerfana.

**Where**: worktree `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\h-f2-6-preapproval`, workspace Paseo `wks_7ec82c595469e4ab`. Fix reconstruido en el worktree principal sobre la rama `fix/h-f2-6-preapproval-amount-verification`.

**Learned**:
- **`git stash` solo protege lo que stasheas.** El `route.ts` estaba en `stash@{0}` y se recupero intacto. El archivo de tests era un cambio de working tree nunca stasheado: se perdio con el directorio. **Regla: en un worktree que puede desaparecer, commitea o stashea seguido — un archivo sin commitear ahi no tiene red.** Un stash parcial protege mas que nada, pero engaña: da sensacion de seguridad.
- **El stash vive en el repo principal, no en el worktree.** Por eso sobrevivio al worktree. Esa es la razon por la que un stash es recuperable y un working tree no.
- **`git worktree prune` NO limpio la registration** de un worktree cuyo directorio ya no existia, ni con `--expire now -v`. Habia que borrar `.git/worktrees/<nombre>` a mano. El paso de AGENTS.md que dice "si responde 'is not a working tree' (exit 128), git ya lo desvinculo y solo queda el directorio" describe el caso inverso: aqui el directorio ya no existia y la registration seguia.
- **`git stash pop` aplico sobre `develop`.** El stash se habia creado en la rama del worktree, pero el pop se ejecuto en el worktree principal, que estaba en `develop`. El cambio de rama se llevo despues (`git checkout fix/...` lo arrastro porque ambas ramas estaban en el mismo commit). Peligroso: si llega a `git commit` ahi, el fix entra en `develop` sin review. **Verificar `git branch --show-current` despues de cada operacion que mueva cambios entre ramas.**
- **Cambio de topologia que funciono:** en vez de recrear el worktree de Paseo (que ya habia demonstrated ser inestable), el fix se completo en el worktree principal con el rama del fix checkouteada. El worktree principal ya tenia `pnpm install` real y `.env.local`, asi que se ahorro el reinstall (38s + riesgo). Y cumple la regla del DoD: "no correr el DoD en el worktree principal" aplica cuando el principal esta en OTRA rama; si esta en la rama candidata, el DoD es valido.
- El workspace Paseo `wks_7ec82c595469e4ab` quedo apuntando a un path inexistente: la degradacion que AGENTS.md documenta. Pendiente de archivar con paso cero en el cleanup.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-discovery]]
