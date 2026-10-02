---
id: 97
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 19:22:05"
updated_at: "2026-10-02 19:22:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Stub v2 endurecido + conflicto PR #178 resuelto + secuencia H2/H1 en el plan"
---

# Stub v2 endurecido + conflicto PR #178 resuelto + secuencia H2/H1 en el plan

**What**: Resuelto el conflicto del PR #178 (merge de `origin/develop` a la branch) y preparado el **stub endurecido v2** del webhook de suscripciones, apto para produccion. El plan ahora tiene la secuencia H2 -> H1 obligatoria.

**Why**: El PR estaba CONFLICTING por `vault/engram/_sessions/ses_f087e3bfcffew6S7dZjBCkv3lW.md`, y el stub v1 no podia exponerse en `admin.landaetastudio.com` (sin firma, sin limite de body, escribiendo payload crudo a disco).

**Where**:
- Merge `origin/develop` -> `chore/spike-t0-fase2`, commit `9722b18`
- `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` - v2 endurecido
- `docs/superpowers/plans/2026-10-01-fase2.md` - secuencia H2/H1 + escenarios de estimacion

**Learned**:

1. **Resolucion del conflicto de Engram:** `git checkout --ours` sobre el archivo de sesion + `pnpm vault:export`. El export reporto `Created: 0, Updated: 0, Skipped: 96` porque **Engram es la fuente de verdad y ya estaba en sync** - no habia nada que regenerar. El archivo quedo sin marcadores de conflicto. `AGENTS.md` mergeo limpio (trae la regla de orden del PR #179). PR #178 paso a `MERGEABLE` con `mergeStateStatus: BLOCKED` (eso es branch protection, esperado).

2. **`gh pr view` devuelve `mergeable: UNKNOWN` durante unos segundos** despues del push. GitHub recalcula async. Hay que esperar ~20s y re-consultar antes de concluir que el conflicto persiste.

3. **Patron de la v2 del stub** (3 controles, reutilizando codigo existente):
   - `verifyMercadoPagoSignature` de `@repo/commerce` - **NO duplicar la logica HMAC**. El storefront ya lo usa en `apps/storefront/app/api/webhooks/mercadopago/route.ts:114`.
   - `extractDataId` parsesa `rawBody` para extraer `data.id` ANTES de verificar (la firma canónica incluye `id:<dataId>`).
   - Orden critico: **secret check (503) -> body limit (413) -> signature (401) -> parse**. El body limit va antes del parse para no parsear un payload gigante.
   - `summarize()` devuelve SOLO metadata: `type`, `action`, `dataId`, `liveMode`, `topLevelKeys`. **No persiste el body crudo.** `topLevelKeys` permite ver campos no documentados sin volcar valores.
   - `export const dynamic = 'force-dynamic'`.

4. **Por que v1 no podia ir a produccion** - las tres razones concretas: (a) sin verificacion de firma = cualquiera POSTea, (b) sin limite de body = POST gigante a disco, (c) logueaba body crudo = exposicion de PII/datos de tarjeta en el stream de logs.

5. **`verifyMercadoPagoSignature` tiene tolerancia de timestamp de 300s por defecto** y usa `crypto.timingSafeEqual` (comparacion constant-time). Sus tests: `packages/commerce/src/__tests__/webhook-signature.test.ts` = 14 tests, todos verdes.

6. **Secuencia correcta dentro de T5 (en el plan ahora):** H2 (5 min, panel de MP) -> si H2 descartado, H1 (endurecer + deploy + pago) -> si llega, T5 completo -> si no llega con topics activos y域名 de produccion, H3 y T9 obligatorio.

7. **Estimacion por escenarios (3 casos, no 2):** H2 era la causa = **9 dias** (se reducia a configurar topics) | webhook funciona = **10 dias** | webhook falla = **12.5 dias**.

8. **El stub v2 va SIN tests.** Se respeto la instruccion de "no implementar todavia". Es el primer trabajo de T5: testear que rechaza firma invalida, body > 100KB y secret ausente. Un stub de seguridad sin test es lo que se muerde despues.

9. **Nombre del paquete admin:** es `admin`, no `@repo/admin`. `pnpm --filter @repo/admin lint` no matchea; usar `pnpm --filter admin lint`.

10. **Emoji `⚠️` de Vercel se renderiza como mojibake** en la consola PowerShell 5.1. No afecta los archivos, pero no usarlo en output que se compare programaticamente.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
