---
id: 99
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-02 19:59:48"
updated_at: "2026-10-02 19:59:48"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "MP_PLATFORM_ACCESS_TOKEN es el token del seller - P6 no es scope sino bloqueo MP (para test users)"
---

# MP_PLATFORM_ACCESS_TOKEN es el token del seller - P6 no es scope sino bloqueo MP (para test users)

**What**: `MP_PLATFORM_ACCESS_TOKEN` en `.env.local` **ES el token del test user vendedor** (`APP_USR-2242132384250482-100209-a19fedf1ed3518c4c4ba21d98abd0f2a-3360257364`), no un token OAuth de plataforma. Verificado por SHA-256: identico byte a byte al token que proveyo Luis como "seller". Por lo tanto TODOS los PUT del spike se hicieron con las credenciales del propio seller.

**Why**: Luis proveyo un token de seller para descartar que P6 fuera un problema de scope del token de plataforma. La comparacion revelo que no eran dos tokens distintos.

**Where**: `.env.local` (repo worktree), preapproval `32f3e2a8575d4797a7841d98390e52bc`.

**Learned**:

1. **El nombre de la env var miente.** `MP_PLATFORM_ACCESS_TOKEN` contiene un `APP_USR` de test user, no una credencial de plataforma. En produccion, esta variable deberia contener un access token OAuth real del seller, con otra estructura. **Todo lo que concluimos sobre PUT seccion P6 se derivo con un token de test user.**

2. **P6 NO es un problema de scope.** Los PUT del spike ya usaban el token del propio dueno de la suscripcion (`collector_id: 3360257364`), que es el maximo alcance posible sobre su propia suscripcion. Y aun asi el PUT es inerte. **Caso B para credenciales de test.**

3. **PERO esto NO prueba P6 para produccion.** Un token OAuth real de plataforma podria tener permisos distintos (o no) sobre mutaciones de suscripciones. **La prueba no discrimina entre "MP lo bloquea siempre" y "MP lo bloquea para test users".** Son dos productos distintos:
   - Si un token de plataforma real PUEDE mutar -> la cancelacion es implementable, solo falta la credencial correcta.
   - Si NO puede -> hay que rediseñar hacia el portal de MP (Opcion A).

4. **Como resolver la ambiguedad:** (a) consultar a soporte de MP si el access token de plataforma puede modificar `PUT /preapproval/{id}`, o (b) repetir la prueba cuando existan credenciales de produccion. Es una pregunta de 30 minutos a MP que desbloquea una decision de producto de Fase 2.

5. **Test 1 con token seller:** HTTP 200, `status: authorized`, `last_modified: 2026-10-02T12:05:13.847-04:00` (sigue inmovido), `collector_id: 3360257364`, `payer_id: 3358461120`, `next_payment: 2026-11-02T12:05:09-04:00`.

6. **Tests 2 y 3 omitidos deliberadamente:** serian requests byte-identicos a los ya ejecutados (mismo token, endpoint y body). Repetirlos no produce informacion nueva. Ejecutar pasos por_step sin discriminatory value es teatro, no evidencia.

7. **PR #178 MERGED** a develop como `e97b0c8` (squash, 19:58:38Z). `seed` y `e2e-success` en rojo por el problema preexistente de `drizzle-kit migrate` (deuda item 41). `develop` solo corre el job `build`, nunca `seed` - por eso su "verde" no es comparable con el de un PR.

8. **El worktree `spike-t0-fase2` quedo huerfano** tras el merge: gh no pudo borrarlo porque estaba checked out. Pendiente `git worktree remove` + `git branch -D`.

9. **CI: `drizzle-kit migrate` sale con codigo 1 sin mensaje util**, solo el spinner `applying migrations...`. Caracteristico de error de conexion/permiso tragado. La cadena de fallo es: `seed` rojo -> `e2e` se skipea -> `e2e-success` (gate) rojo.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
