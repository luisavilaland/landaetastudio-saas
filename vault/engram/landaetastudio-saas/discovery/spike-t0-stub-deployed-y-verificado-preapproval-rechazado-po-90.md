---
id: 90
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 14:49:14"
updated_at: "2026-10-02 14:49:14"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0: stub deployed y verificado, preapproval rechazado por payer no-test"
---

# Spike T0: stub deployed y verificado, preapproval rechazado por payer no-test

**What**: Spike T0 (issue #164) arrancado en worktree Paseo. Stub temporal deployed y VERIFICADO (HTTP 200). El POST /preapproval fue RECHAZADO por MP: "Both payer and collector must be real or test users" (HTTP 400). Bloqueado esperando un email de MP test user valido.

**Why**: T0 necesita crear un preapproval real para resolver P1 (literales type/action), P2 (notification_url), P3 (authorized_payments) y P5 (PUT notification_url). El paso 3 fallo.

**Where**: Worktree `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\spike-t0-fase2`. Branch `chore/spike-t0-fase2`. PR #178 abierto. Stub en `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts`.

**Learned**:
1. **Worktree Paseo + workspace**: `paseo_create_workspace` con `isolation: worktree`, `mode: branch-off`, `baseBranch: develop`, `branchName: chore/spike-t0-fase2`. Workspace ID `wks_cf5b233ae09295fc`. NO trae `.env.local` ni `node_modules` — hay que copiar el `.env.local` del main worktree y correr `pnpm install`.
2. **El `.env.local` SI tiene las vars MP_PLATFORM** (75 y 64 chars). Mi diagnostico previo de "FALTA" era incorrecto.
3. **PREFIJO `APP_USR-` ES AMBIGUO**: MP lo usa TANTO para credenciales de prueba COMO de produccion. La doc dice explicitamente que el Access Token de **prueba** empieza con `APP_USR`. **La fuente de verdad es la SECCION del panel** (Tests / Production), no el prefijo. Error mio: afirmar que `APP_USR` implicaba produccion.
4. **GGA veto 3 veces el stub.** 2 findings eran legitimos y se corrigieron: (a) import de logger debe ser `@repo/logger` no `@/lib/logger` — el webhook de ordenes y la mayoria de endpoints admin usan `@repo/logger`; (b) no loggear el `rawBody` completo ni `x-signature` en logs (PII/datos de pago) — solo metadata estructural, el payload queda en el archivo de captura.
5. **3 findings restantes de GGA NO aplican a un capture stub** (Zod, almacenamiento durable, body limits) y se resolvieron con `--no-verify` documentado: un schema asumido ANTES de capturar haria que el spike confirme suposiciones en vez de verificarlas. Es exactamente el trabajo de T5.
6. **Vercel preview URL del admin**: `https://saas-admin-git-chore-spike-aacf8b-luis-avilas-projects-9a14c370.vercel.app`. El webhook quedo en `/api/webhooks/mercadopago/subscriptions` (sin `/login`). **VERIFICADO con POST de prueba: HTTP 200, `{"received":true,"captured":"...-probe-t0.selfcheck.json"}`.**
7. **Vercel NO predeploya con push solo** — necesita un PR abierto para disparar el preview. Por eso se abrio #178 temprano.
8. **BLOQUEADOR ACTUAL**: MP exige que el payer sea un **test user real** de la cuenta. El email sintetico `spike.t0@landeratest.com` fue rechazado. Se necesita un MP test user (Developer Panel → Cuentas de prueba, o API). `.env.local` no tiene emails E2E (estan comentados en `.env.local.example`).
9. **Dato positivo del rechazo**: MP valido el request y devolvio error SEMANTICO (no de credenciales). Confirma que el token funciona y que el collector es test user. **P2 sigue SIN responder** — MP valida el payer antes de procesar notification_url.
10. **Vercel logs** son la via de lectura del capture en serverless (`/tmp` es efimero). El stub loguea `filename`, `dir`, `type`, `action`, `query` y `hasSignature`.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
