---
id: 91
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 15:14:48"
updated_at: "2026-10-02 15:14:48"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0: 3 errores distintos de MP diagnostican el payer_email"
---

# Spike T0: 3 errores distintos de MP diagnostican el payer_email

**What**: Spike T0 (issue #164) — 3 intentos de POST /preapproval con credenciales de PRUEBA de MP, todos rechazados con errores DISTINTOS. La resolucion del `payer_email` de un test user de MP esta bloqueada.

**Why**: T0 necesita crear un preapproval real para resolver P1 (literales type/action), P2 (notification_url), P3 (authorized_payments), P5 (PUT notification_url). El paso 3 no completa.

**Where**: Worktree `C:\Users\exodo\.paseo\worktrees\0q5zj3gn\spike-t0-fase2`. PR #178 abierto. Payload en `%TEMP%\opencode\preapproval3.json`.

**Learned**:
1. **Stub temporal deployed y VERIFICADO** en `https://saas-admin-git-chore-spike-aacf8b-luis-avilas-projects-9a14c370.vercel.app/api/webhooks/mercadopago/subscriptions`. POST de prueba → HTTP 200 con `{"received":true,"captured":"...-probe-t0.selfcheck.json"}`.
2. **Vercel NO predeploya con push solo**: hay que abrir un PR para disparar el preview.
3. **TRES errores DISTINTOS en tres intentos**, y la progresion diagnostica exactamente donde falla MP:

| # | `payer_email` enviado | HTTP | Error de MP |
|---|---|---|---|
| 1 | `spike.t0@landeratest.com` (sintetico) | 400 | `Both payer and collector must be real or test users` |
| 2 | `TESTUSER6212019557303955551@testuser.com` | 400 | `User bad request` |
| 3 | `TESTUSER6212019557303955551` (sin dominio) | 400 | `Invalid value for payer_email, must be a valid email address` |

**Que prueba cada uno:**
- El #3 es un error de **FORMATO**: MP valida el formato del email ANTES de resolver el usuario. Un username pelado no pasa.
- El #2 pasa formato pero falla en **resolucion de usuario**. Por lo tanto `@testuser.com` es un formato valido pero el usuario NO existe ahi.
- El #1 pasa formato y falla en **tipo de cuenta**: el email es valido pero no es una cuenta MP.

**Conclusion:** hace falta `USERNAME@DOMINIO` con el dominio REAL que MP asigno al test user. `@testuser.com` NO es el dominio correcto para estos usuarios. Tres adivanzas de dominio agotaron la via de ensayo.

4. **P2 (`notification_url`) SIGUE SIN RESPONDER.** MP falla en la validacion del payer ANTES de procesar `notification_url`. Los tres intentos dicen **nada** sobre ese campo. No confundir el 400 con un "no".
5. **Las tarjetas que paso Luis initially (`12345678` / `123456789`) son NUMEROS DE DOCUMENTO, no de tarjeta.** Las tarjetas de prueba reales: Mastercard `5031 7557 3453 0604`, Visa `4509 9535 6623 3704`, CVV `123`, expiry `11/30`.
6. **Test users disponibles** (Luis, 2026-10-02): comprador `TESTUSER6212019557303955551` (User ID 3358461120, password `1EE6E878#9be3#4b8a#`); vendedor `TESTUSER5833861597796759523` (User ID 3360257364).
7. **Dos caminos para obtener el email correcto**: (a) leerlo del panel en MP Developer Panel → Your integrations → Tu app → Tests → Test accounts (columna email de la fila del comprador); (b) crear uno propio con `POST /users/test` `{site_id: "MLU", description: "Spike T0"}` que devuelve `email`, `nickname` y `password`. El camino (b) es reversible y con credenciales de prueba no mueve dinero, pero es creacion de recurso externo.

**Regla respected**: no se reintento a ciegas. Cada error distinto se reporto antes de seguir.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
