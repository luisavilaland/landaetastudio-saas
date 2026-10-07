---
id: 189
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 13:45:00"
updated_at: "2026-10-07 13:45:00"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Dependabot 9/10 mergeados; Sentry v11 silenciosamente ignora opciones viejas"
---

# Dependabot 9/10 mergeados; Sentry v11 silenciosamente ignora opciones viejas

**What**: 9 de 10 PRs de Dependabot mergeados en `develop` (#210, #217, #214, #216, #213, #215, #208, #212, #211) el 2026-10-07. DoD verde post-9-merges: lint 6/6, typecheck 9/9, test 705/705 (69 archivos), build 3/3, format:check OK. #209 (`@sentry/nextjs` 10.75.0 -> 11.4.0) cerrado SIN mergear y reemplazado por un PR de migracion propio.
**Why**: El PR de Dependabot de Sentry v11 no era mergeable: v11 movio el entry point (`@sentry/nextjs` -> `@sentry/nextjs/config`) y elimino 2 opciones que el proyecto usa. Poner una migracion de codigo dentro de la rama de Dependabot habria dejado el PR sin trazabilidad de por que cambio.
**Where**: `apps/{admin,storefront,superadmin}/next.config.mjs`, `apps/{admin,storefront,superadmin}/package.json`, `packages/commerce/package.json`, `pnpm-lock.yaml`, rama `chore/sentry-v11-migration`.
**Learned**: HALLAZGO EMPERICO — un smoke test que llamo a `withSentryConfig` con el objeto de opciones NUEVO y con el VIEJO probo que el SDK de Sentry NO valida nombres de opcion: ambos se aceptan sin throw. La config devuelta incluye clave `webpack`, confirmando que las opciones nuevas si se consumen. Consecuencia: si solo se hubiera cambiado el import (que es lo que sugeria el error de build), el build habria pasado VERDE con `disableLogger` y `automaticVercelMonitors` ignorados en silencio — se pierden source maps y Vercel monitors y nada lo detecta. TipoScript no ayuda porque `next.config.mjs` es JS plano. Ademas: sin `SENTRY_DSN` en `.env.local`, `withSentryConfig` nunca se invoca (`next.config.mjs:27` lo condiciona), asi que el build verde solo valida el import, nunca las opciones — por eso la migracion quedo con verificacion manual pendiente.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
