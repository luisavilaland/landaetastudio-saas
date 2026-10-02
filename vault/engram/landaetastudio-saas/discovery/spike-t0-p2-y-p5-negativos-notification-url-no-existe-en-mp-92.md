---
id: 92
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 15:24:52"
updated_at: "2026-10-02 15:24:52"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Spike T0: P2 y P5 NEGATIVOS — notification_url no existe en MP Suscripciones"
---

# Spike T0: P2 y P5 NEGATIVOS — notification_url no existe en MP Suscripciones

**What**: Spike T0 (issue #164) — preapproval REAL creado (HTTP 201, id `32f3e2a8575d4797a7841d98390e52bc`). **P2 y P5 RESUELTOS NEGATIVOS**: `notification_url` NO existe para Suscripciones en MercadoPago. Ningun webhook puede llegar sin configurar la URL por otro medio.

**Why**: El spike debia resolver si `POST /preapproval` acepta `notification_url` (P2) y si `PUT /preapproval/{id}` puede cambiarlo (P5). La respuesta es que el campo no existe.

**Where**: Preapproval `32f3e2a8575d4797a7841d98390e52bc` en la cuenta MP de prueba (site_id MLU). Stub en `https://saas-admin-git-chore-spike-aacf8b-luis-avilas-projects-9a14c370.vercel.app/api/webhooks/mercadopago/subscriptions`. PR #178.

**Learned**:
1. **P2 = NO.** `POST /preapproval` con `notification_url` devuelve **HTTP 201 Created** (sin error) pero el campo **se descarta silenciosamente**. `GET /preapproval/{id}` devuelve `notification_url: []` (vacio). MP no lo persiste. **Este es el peor caso posible**: el 201 dice "todo bien" y el webhook nunca llega.
2. **P5 = NO.** `PUT /preapproval/{id}` con `notification_url` devuelve **HTTP 200** y sube `version` de 0 a 1 (o sea el PUT SI modifico el preapproval), pero el campo **sigue ausente** del GET. La palabra `notification` no aparece en ningun punto del response de MP.
3. **Conclusion: `notification_url` NO existe como parametro para Suscripciones.** No es "lo acepta pero lo ignora" — el campo no esta en el esquema. Para cualquier preapproval, la URL de webhook tiene que venir de la configuracion de la cuenta.
4. **Esto contradice la doc de MP de forma inutilizable**: la pagina *Subscriptions → Webhooks* dice que para Suscripciones hay que usar "Configuration during payment creation" (o sea `notification_url`), pero ese campo **no existe**. Las dos afirmaciones de la misma doc son incompatibles, y la empiria confirma que la primera es falsa.
5. **P1 y P3 quedan BLOQUEADOS**: sin URL de webhook configurada, ningun evento llega y no hay payload que capturar. Dependen de que Luis configure la URL en *Your integrations → Webhooks → Configurar notificaciones* — que es justamente el metodo que la doc dice que no funciona para Suscripciones. Probarlo empiricamente es el unico camino.
6. **Formato del email de test user (clave)**: `GET /users/me` revela el patron que el panel NO muestra: `test_user_<nickname_en_minusculas>@testuser.com`. Ej: collector `TESTUSER5833861597796759523` → `test_user_5833861597796759523@testuser.com`. Por eso los intentos 2 y 3 fallaron:
   - `TESTUSER6212019557303955551@testuser.com` → `User bad request` (local part incorrecto: nickname sin prefijo `test_user_`)
   - `TESTUSER6212019557303955551` (sin dominio) → `Invalid value for payer_email` (error de FORMATO, MP valida antes de resolver)
   - correcto: `test_user_6212019557303955551@testuser.com` → **201 Created**
7. **Instruccion para el futuro**: cuando un endpoint de MP acepte un campo sin error, **verificar con GET que se persistio**. Un 2xx no prueba nada sobre campos opcionales. Este bug habria llegado a produccion.
8. **Bug de PowerShell**: `$PID` es variable de solo lectura (process id). Usar `$preId` para IDs de recursos de MP.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
