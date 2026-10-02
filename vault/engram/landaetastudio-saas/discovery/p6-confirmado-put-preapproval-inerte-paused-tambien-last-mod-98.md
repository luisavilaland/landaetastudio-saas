---
id: 98
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 19:52:09"
updated_at: "2026-10-02 19:52:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "P6 confirmado: PUT preapproval inerte, paused tambien, last_modified nunca se movio"
---

# P6 confirmado: PUT preapproval inerte, paused tambien, last_modified nunca se movio

**What**: P6 CONFIRMADO y mas amplio de lo documentado. `PUT /preapproval/{id}` es inerte en este preapproval: `status:"cancelled"`, `status:"paused"` y `auto_recurring.transaction_amount` devuelven HTTP 200 sin aplicar nada. `last_modified` nunca se movio.

**Why**: Luis aporto que el PUT falla si hay factura pendiente. Se verifico y no aplica: no hay factura pendiente. El diagnostico diferencial con `paused` como control demuestra que no es un problema del valor `cancelled`.

**Where**: Preapproval `32f3e2a8575d4797a7841d98390e52bc`. Evidencia en `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md`.

**Learned**:

1. **`last_modified` = `2026-10-02T12:05:13.847-04:00` es IDENTICO byte a byte** en los 6 intentos: cobro original, `cancelled` (200), `canceled` (400), cambio de monto (200), `cancelled` de nuevo (200), `paused` (200). Si MP hubiera aplicado cualquiera, el timestamp se moveria. **Es la prueba mas fuerte de que el PUT no aplica nada.**

2. **Diagnostico diferencial con `paused` como control:** tambien devuelve 200 sin efecto. Por lo tanto **no es que `cancelled` sea un valor invalido** - es que el verbo PUT completo esta inerte en este recurso.

3. **Hipotesis de Luis (factura pendiente) DESCARTADA para este caso.** `GET /authorized_payments/search` devuelve 1 sola factura: `7032493379`, `status: processed`, `payment: approved/accredited`, `retry_attempt: 1`. Ninguna en `waiting_for_gateway` ni `authorized`. `summarized.semaphore: green`. No hay nada pendiente.

4. **Superficie completa de PUT muerta post-cobro:** `status` (cancelled), `status` (paused), `auto_recurring.transaction_amount`, `notification_url`. Cuatro, todos inertes. Antes del cobro, `PUT notification_url` devolvio 200 y subio `version` de 0 a 1, pero **el campo tampoco se aplico**. O sea: el PUT acepta y descarta **tanto antes como despues del cobro**.

5. **Unica hipotesis que queda sin descartar:** que el `MP_PLATFORM_ACCESS_TOKEN` tenga alcance de solo lectura sobre suscripciones. MP si parsea y valida el body (rechaza `canceled` con 400 "Invalid preapproval status param"), asi que procesa la request - pero podria ignorar la mutacion por permisos. **Como descartarlo:** repetir con el token del seller (`TESTUSER5833861597796759523`) que es el dueno de la suscripcion, o consultar a MP. Requiere token distinto, no se puede resolver con el actual.

6. **CI NO estaba verde y el fallo NO es de este PR.** `seed` falla en `drizzle-kit migrate` (exit 1, sin mensaje de error util, solo el spinner "applying migrations..."). La cadena es: `seed` rojo -> `e2e` se skipea -> `e2e-success` (gate) rojo. El mismo fallo ya estaba en un run del 2026-10-02T14:38:28Z en esta misma branch, antes del merge y del stub v2. **El diff del PR no toca `packages/db`, migraciones, seed, package.json ni .env** - solo `.gitignore`, el route.ts del stub, docs y vault. `develop` solo corre el job `build`, nunca `seed`, asi que su "verde" no es comparable.

7. **Vercel `seed` falla con spinner y sin error:** `drizzle-kit migrate` imprime `[⣷] applying migrations...` y sale con codigo 1 sin mensaje. Caracteristico de error de conexion/permiso tragado por el spinner. Para diagnosticar habria que correr `pnpm db:migrate` localmente contra la DB de dev (MUTANTE) o agregar flags de debug en CI.

8. **P6 implicacion para T4:** los 3 endpoints (`cancel`, `reactivate`, `plan`) no tienen backend. Devuelven 202 y no ocurre nada. Si se confirman en alcance, **redirigir al portal de MP** en vez de exponer un boton que miente.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
