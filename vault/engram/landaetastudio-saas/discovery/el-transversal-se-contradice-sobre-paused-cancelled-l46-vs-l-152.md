---
id: 152
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-05 00:36:04"
updated_at: "2026-10-05 00:36:04"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "El transversal se contradice sobre paused -> cancelled (L46 vs L79) y los comentarios del codigo quedaron obsoletos"
---

# El transversal se contradice sobre paused -> cancelled (L46 vs L79) y los comentarios del codigo quedaron obsoletos

**What**: El transversal `2026-09-subscription-lifecycle.md` se contradice a si mismo sobre `paused -> cancelled`: L46 (diagrama de §1) dice "(no expuesto aun por la API)", L79-80 (§2) dice "la transicion **esta expuesta**". El codigo sigue a L79 (item 51: `canCancel: true` y `POST /cancel` con `allowedFrom: ['active','paused']`). Ademas, `packages/commerce/src/subscription-permissions.ts` L15 y `__tests__/subscription-permissions.test.ts` L11/L23 siguen afirmar que "el transversal lista 6 estados", cuando §1 ya dice "(7 estados)".

**Why**: Los items 49 y 51 se marcaron RESUELTO en la deuda tecnica, pero la actualizacion del transversal se hizo a medias y los comentarios del codigo nunca se tocaron. Un comentario que miente sobre la fuente de verdad es peor que no tenerlo: el doc de header del archivo dice "fuente de verdad: transversal seccion 2".

**Where**: `docs/superpowers/specs/2026-09-subscription-lifecycle.md` L46 vs L79-80; `packages/commerce/src/subscription-permissions.ts` L15-16; `packages/commerce/src/__tests__/subscription-permissions.test.ts` L11, L23-24

**Learned**: Marcar un item de deuda como RESUELTO no cierra el trabajo si el codigo tiene comentarios que describen el mundo *anterior* a la resolucion. La deuda visible (item 49/51 cerrados) subestima el trabajo real: queda la reconciliacion de comentarios. Patron repetido del item 38 invertido ("esta vez el codigo contradice al doc").

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
