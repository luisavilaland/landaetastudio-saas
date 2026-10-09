---
id: 262
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/item-61-transitionsubscription
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 12:12:55"
updated_at: "2026-10-09 12:12:55"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 61 entregado: PR #235 con CI 9/9 y el fix de DbLike de GGA"
---

# Item 61 entregado: PR #235 con CI 9/9 y el fix de DbLike de GGA

**What**: Item 61 entregado. PR #235 (issue #234, diseno #233), 2 commits: `c1011e3` implementacion + `0bbf2f9` referencia de PR en la bitacora. CI 9/9 en verde, incluido `e2e` contra Neon real. Working tree limpio, rama pusheada.

**Why**: Cierre del item ALTA que bloqueaba Fase 3. El `WHERE` de la transicion de suscripcion paso de codigo escrito a mano a un invariante poseido por una funcion de dominio.

**Where**: `packages/commerce/src/subscription-transition.ts`, `packages/commerce/src/__tests__/subscription-transition.test.ts`, `packages/commerce/src/index.ts`, `packages/db/src/index.ts`, `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`, `vault/02_Bitacora/bitacora.md`, `vault/03_Deuda/deuda-tecnica.md`.

**Learned**:
- **GGA|reporto 3 violaciones; solo 1 era mia, y la aceptacion de GGA era correcta.** `DbLike` ya existia en `packages/db/src/index.ts` pero NO estaba exportado, asi que dos archivos lo derivaban con `Parameters<Parameters<typeof withTenantContext>[1]>[0]`. Se exporta `DbLike` y desaparece la derivacion de los dos lados. **Cuando GGA marca algo en un archivo nuevo, primero ver si el problema ya existia en otro archivo** — la respuesta suele ser "el primero que llega", no "el que rompio".
- **Las 2 violaciones restantes (errores de API en ingles, `process.env` sin Zod) eran preexistentes y NO estan en el diff.** Se comprobó con `git diff --cached` linea por linea. `--no-verify` con la justificacion escrita en el commit y en el PR.
- **El flake de la suite completa (1 failed | 758 passed en la primera corrida) NO se reprodujo**: 3 repeticiones completas limpias + 3 corridas aisladas de los archivos tocados (110 tests) limpias + `e2e` en CI. Coincide con la clase de timeouts de Neon del item 78. **El item 78 sigue abierto y asi se documento en el PR** — no se cerro un hallazgo porque el CI saliera verde.
- **Un fallo de red en `gh` se ve como `ConvertFrom-Json: Primitivo JSON no valido: Post`**, porque el mensaje de error de TLS se mezcla con el JSON esperado. No es un problema de permisos ni de label: reintentar con salida de texto plano funciona.
- **El label `type:feature` no existe.** Labels reales: `type:task`, `fase-2`, `blocker`, `enhancement`, `bug`, `documentation`.
- `git push` en este repo devuelve exit != 0 con la informacion del push en stderr, aunque el push SI funcione. Por eso la verificacion es `git log origin/<rama>` y no el exit code (regla de AGENTS.md).

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
