---
id: 282
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 20:19:47"
updated_at: "2026-10-10 20:19:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "S3 alta publica de tenant: 3 escrituras, role admin, catch 23505"
---

# S3 alta publica de tenant: 3 escrituras, role admin, catch 23505

**What**: endpoint publico `POST /api/register-tenant` en `apps/storefront`. Crea tenant + admin_user + subscription en una sola transaccion con `tenantId` pre-generado. `registerTenantSchema` en `@repo/validation` (name, email, password min 8, slug 3-30, planId uuid; NO acepta status). `validateSlug` + los 16 reservados de D8 en `@repo/commerce`. Items 95, 96 y 97 registrados. 6 commits en `feat/s3-alta-tenant`.

**Why**: S1 (`tenants.status`) y S2 (`PLATFORM_HOST`) dejaron la plataforma lista pero no habia camino para crear un tenant: un tenant existia solo porque alguien lo insertaba a mano en el superadmin.

**Where**: `apps/storefront/app/api/register-tenant/route.ts`, `packages/commerce/src/tenant-slug.ts`, `packages/validation/src/schemas.ts`, `packages/commerce/src/index.ts`, `apps/storefront/app/api/register-tenant/__tests__/route.test.ts`, `packages/commerce/src/__tests__/tenant-slug.test.ts`.

**Learned**:
(1) **El alta son TRES escrituras y la tercera NO es `tenant_mp_config`.** El endpoint recibe email+password (D6) y `tenants` no tiene esos campos: la credencial vive en `admin_users`. Eso es lo que D3 llama "las tres escrituras".
(2) **`role: 'admin'` es el rol de tenant admin, no de plataforma.** Verificado contra produccion: las 2 filas con `role='admin'` tienen `tenantId`. `createAdminAuth.authorize()` exige `role === 'admin'` literal; un `'owner'` habria creado cuentas que nunca pueden autenticarse. Luis paro el commit para verificar esto antes de aprobarlo.
(3) **El catch de 23505 nunca matcheaba y los tests lo encontraron antes del commit.** Dos razones: `withTenantContext` lanza `DrizzleQueryError` que envuelve el error de Postgres en `.cause` (en la superficie `code` es undefined), y `postgres.js` llama al campo **`constraint_name`**, no `constraint` (ese nombre viene de `node-postgres`). Sin el fix, slug y email duplicados devolvian 500 en vez de 409.
(4) **Con tres uniques en juego el mensaje tiene que leer la constraint.** Hardcodearlo reportaria un slug tomado como "Email ya registrado".
(5) **El hash va fuera de la transaccion**: bcrypt con 10 rounds son ~100 ms de CPU y en Neon una transaccion abierta es una conexion abierta.
(6) **`validateSlug` no normaliza** y hay tests que fijan esa decision: "Admin" da `invalid_format` y "admin" da `reserved`, o sea 400 vs 409 distintos.
(7) **El T8 del plan NO es el slug**: es la config de MP (D9). El slug es parte de T7. Se movio T8 a S3b.
(8) **El owner de un tenant pending entra a apps/admin y es correcto** (item 96): el onboarding exige configurar subdominio, branding y MP antes de pagar. Lo indefinido es el otro extremo (item 97): `expired` y `abandoned`.
(9) **`obsidian_write_note` en modo append NO inserta un salto de linea.** Si el archivo no termina en `\n`, concatena sobre la ultima linea. Hay que verificar el resultado con `git diff` y no asumir que "append" significa "append".
(10) `prettier --check` corre sobre `**/*.md` y el plan tiene tablas grandes: reformatearlas produce un diff con muchas lineas `-`/`+` que es pura alineacion. Para comprobar que no se perdio nada, comparar filas de tabla normalizadas (67 antes y despues), no el diff crudo.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
