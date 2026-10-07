---
id: 185
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee9ab76d4ffeEJ230XhbEzBcD0
created_at: "2026-10-07 12:47:39"
updated_at: "2026-10-07 12:47:39"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Dependabot #208-217: 4 rojos por secrets de Dependabot ausentes, no por las deps"
---

# Dependabot #208-217: 4 rojos por secrets de Dependabot ausentes, no por las deps

**What**: Verificados los 10 PRs de Dependabot (#208-#217). Correlacion 1:1: los 5 que tocan SOLO el package.json raiz (#210 @types/node, #213 vitest, #214 turbo, #216 drizzle-kit, #217 dotenv) no disparan e2e.yml (path filter) y estan VERDES. Los 5 que tocan apps/ o packages/ (#208 resend, #209 @sentry/nextjs, #211 next, #212 drizzle-orm, #215 pino) disparan e2e.yml y fallan `seed`.
**Why**: Pedido de verificar los 10 dependabot y definir orden de cierre.
**Where**: PRs #208-#217, base develop. `.github/workflows/e2e.yml`, `.github/workflows/ci.yml`, 3x `apps/*/next.config.mjs`.
**Learned**: (1) `seed` falla NO por la dependencia: el log muestra `Secret source: Dependabot` y `DATABASE_URL:` VACIO -> `ERROR CONEXION: ECONNREFUSED`. Dependabot corre con su propio secret store y NO tiene `NEON_DATABASE_URL` ni `NEON_DATABASE_APP_URL`. Es config del repo (Settings > Secrets > share with Dependabot), no un bug de dependencia. Cambiar el orden de merge NO lo arregla. (2) #209 (@sentry/nextjs 10.75.0 -> 11.4.0) es el UNICO con regresion real: `SyntaxError: Named export 'withSentryConfig' not found. The requested module '@sentry/nextjs' is a CommonJS module`. Sentry v11 rompio ese named export; los 3 next.config.mjs lo importan en linea 1. Requiere cambio de codigo, no basta con mergear. (3) `e2e-success` es solo un gate (`contains(needs.*.result,'failure')`), no un fallo propio — no diagnosticarlo como causa raiz.

---
*Session*: [[session-ses_ee9ab76d4ffeEJ230XhbEzBcD0]]
