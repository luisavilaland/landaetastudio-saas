---
id: 187
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 13:18:16"
updated_at: "2026-10-07 13:18:16"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Sentry v11: withSentryConfig se movio a /config y 2 opciones removidas en silencio"
---

# Sentry v11: withSentryConfig se movio a /config y 2 opciones removidas en silencio

**What**: Verificado por que NO se puede mergear @sentry/nextjs v11 tal cual. La guia oficial v10-to-v11 dice: (1) `withSentryConfig` se movio de `@sentry/nextjs` a `@sentry/nextjs/config`; (2) se eliminaron las opciones top-level deprecadas en 10.30.0. Los 3 `apps/*/next.config.mjs` importan en linea 1 desde `@sentry/nextjs` (error `Named export 'withSentryConfig' not found`) y usan DOS opciones removidas: `disableLogger: true` -> `webpack.treeshake.removeDebugLogging` y `automaticVercelMonitors: true` -> `webpack.automaticVercelMonitors`. Opciones que SI siguen validas: `org`, `project`, `authToken`, `silent`, `widenClientFileUpload`, `hideSourceMaps`.
**Why**: Dependabot #209 (10.75.0 -> 11.4.0) es el ultimo PR abierto y el unico con regresion real.
**Where**: `apps/admin/next.config.mjs` L1/L20/L21, `apps/storefront/next.config.mjs` L1, `apps/superadmin/next.config.mjs` L1.
**Learned**: LA TRAMPA — si solo se arregla el import (lo que el error de build sugiere), el build pasa pero `disableLogger` y `automaticVercelMonitors` se pierden EN SILENCIO: se dejan de subir source maps y se pierden los Vercel monitors. TypeScript no las marca porque `withSentryConfig` es JS plano en un `.mjs`, no tipado. Además v11 exige Node >= 20.19.0 / 22.12+ / 23.2+ (el proyecto usa 22 en CI, compatible). Y en el exports map de 11.4.0 la condicion `"node"` esta antes que `"import"`, por eso Node resuelve el build CJS y el named export falla en un `.mjs`.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
