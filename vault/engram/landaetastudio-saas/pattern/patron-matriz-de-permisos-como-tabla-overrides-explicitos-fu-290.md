---
id: 290
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-14 14:18:06"
updated_at: "2026-10-14 14:18:06"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "Patron: matriz de permisos como tabla, overrides explicitos, funcion total"
---

# Patron: matriz de permisos como tabla, overrides explicitos, funcion total

**What**: Patron reusable - una matriz de permisos se escribe como tabla indexada por clave compuesta, con un override por dimension que se aplica encima, y sin defaults silenciosos.

**Why**: S4b necesito cruzar `tenants.status` con `subscriptions.status` sobre una matriz existente. La forma que funciono evita tres clases de bug que ya aparecieron en el repo.

**Where**: `packages/commerce/src/subscription-permissions.ts`, `packages/commerce/src/__tests__/tenant-permissions.test.ts`.

**Learned**:
(1) **Tabla indexada por clave compuesta (`Record<TenantStatus, Partial<Permissions> | null>`) en vez de cadena de ifs.** `null` significa "no override, usar lo de la suscripcion". Distinguir `null` de `undefined` es lo que permite el check: `undefined` = estado desconocido =应当 tirar; `null` = sin override.
(2) **El override se aplica ENCIMA, no al lado.** Dos ejes ortogonales donde uno manda. La regla "el tenant manda sobre la suscripcion" es una decision, y la forma del codigo la vuelve explicita.
(3) **Los overrides deben ser EXPLICITOS, no `Partial` parciales.** El override de tenant `cancelled` lleva `canReactivate: false` escrito. Omitirlo lo deja heredado de la suscripcion, y un tenant que dio de baja su tienda con suscripcion `expired` heredaria `true` - podria "reactivarse". Un `Partial` parcial es un default silencioso con otra forma.
(4) **Funcion total que TIRA en estado desconocido, no que devuelve defaults.** Es lo que evita que un estado nuevo caiga en un `else` con permisos inventados que abren el panel de un tenant en un estado que no entendemos. El `Record` da el exhaustiveness check del typecheck; el throw da el fallo en runtime.
(5) **Los tests son `it.each` sobre filas que afirman los TRES permisos a la vez.** Un `for` sobre los estados pasaria en verde con el array vacio. Y afirmar los tres juntos evita que un permiso que se mueve pase junto al que si se mueva.
(6) **El snapshot de la matriz completa es lo mas valioso del archivo de test.** Unica vez donde la politica entera esta escrita de una vez. Cuando cambia una decision, ese snapshot es el que hay que actualizar - y si consagra un valor viejo, oculta el cambio (asi paso con el item 96, cerrado en papel y contradicho en el codigo durante un mes).
(7) **Documentar la contradiccion en el spec cuando se corrige.** El codigo declara que el spec es la fuente de verdad; cambiar el codigo sin cambiar el spec hace que el proximo lector crea lo viejo.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
