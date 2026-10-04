---
id: 143
type: decision
project: landaetastudio-saas
scope: project
topic_key: decision/paused-puede-cancelar
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-04 15:58:47"
updated_at: "2026-10-04 15:58:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - decision
aliases:
  - "canCancel: true para paused; la decision debia implementarse en dos capas"
---

# canCancel: true para paused; la decision debia implementarse en dos capas

**What**: Decision de producto de Luis (2026-10-04, opcion A): `canCancel: true` para `paused`. Implementado en `derivePermissions` Y en `POST /api/subscriptions/cancel` (`allowedFrom: ['active', 'paused']`). Item 51.

**Why**: `paused` significa "suspender el cobro", no "bloquear acciones". MP acepta `paused -> cancelled`; obligar al tenant a "reanudar para cancelar" es burocracia.

**Where**: `packages/commerce/src/subscription-permissions.ts`, `apps/admin/app/api/subscriptions/cancel/route.ts`, sus tests, transversal §2

**Learned**:
- **El bug NO estaba solo en la matriz de permisos.** El endpoint `cancel` tenia `allowedFrom: ['active']` con un test que afirmaba el 409 desde `paused`. Cambiar solo `canCancel` a `true` habria producido una UI con un boton "Cancelar" que siempre devuelve 409. Una decision de producto sobre "que puede hacer el tenant" tiene que implementarse en **todas** las capas que la aplican, o no esta implementada.
- **Los endpoints de mutacion son la frontera real.** La matriz de permisos decide que boton se muestra; el endpoint decide si funciona. Un gate que verifique solo la matriz es insuficiente. Esto es el item 38 invertido: ahi la doc contradecía al codigo; aca la inconsistencia era interna del codigo (matriz vs endpoint).
- La tabla de permisos de §2 del transversal **no tenia fila de cancelar**. Se agrego.
- **Verificar append-only con `git diff | Select-String "^-"` da falso positivo cuando el archivo viejo no termina en newline:** git renderiza la ultima linea como delete+add aunque sea identica. Verificacion correcta: comparar el prefijo de texto del archivo nuevo contra el contenido del viejo y confirmar que los primeros N chars son identicos. En este caso 197.004 chars identicos y 5 de whitespace extra.
- **Al concatenar por bytes, si el archivo destino no termina en newline, el separador se pega a la ultima linea** y rompe el markdown (`**Urgencia:** N/A.---`). El `write` tool ademas recorta el whitespace inicial del contenido. Verificar el junction despues de cada append.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-decision]]
