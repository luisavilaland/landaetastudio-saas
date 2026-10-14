# Auditoría Fase 3 mid-phase — Segunda pasada

**Fecha:** 2026-10-14
**Base:** `develop` @ `ef401aa`
**Rama:** `audit/fase3-midphase-v2`
**Precedente:** #197 (cuya segunda pasada encontró 4 errores en la primera)
**Worktree:** `wks_cdc020039c635b06`

Auditoría _warm_: lee el consolidado de la primera pasada (PR #257) como input.

---

## Resumen ejecutivo

- **Claims verificadas:** 9 de 9 confirmadas **en sustancia**. 2 de ellas con el mecanismo corregido.
- **Errores en #257:** 5 (3 de mecanismo, 1 off-by-one, 1 de alcance). Más **1 error propio del reporte de reincorporación**, no de #257.
- **Hallazgos nuevos:** 7 — 2 ALTO, 3 MEDIO, 2 BAJO.
- **Veredicto:** la primera pasada **no tuvo hallazgos falsos**. Sus 9 hallazgos se sostienen. Los 5 errores son de precisión, no de dirección. Pero la segunda pasada encontró **2 hallazgos ALTO que la primera no vio**, y uno de ellos (T11 inerte) es **una cuarta ocurrencia del mismo patrón de fondo**.

La conclusión de la primera pasada —"Fase 3 no sigue a S3b"— **se sostiene y se refuerza**.

### El hallazgo de fondo, ahora con 4 casos

La primera pasada ya había detectado el patrón en 3 casos: ítem 61 (_"un control que acompaña y no verifica"_), ítem 94 (`db:migrate` reporta éxito sin aplicar) e ítem 103 (matriz de permisos sin punto de aplicación).

La segunda pasada encuentra un **cuarto caso del mismo tipo, que la primera no vio**: **T11 escribe `tenants.logoUrl` y nadie lo lee**. El storefront lee `settings.logoUrl`, la columna jsonb vieja. Dos fuentes de verdad; la visible es la anterior. El feature está construido, testeado y mergeado, y **no produce ningún efecto observable**.

Y hay una correlación que ninguno de los dos subagentes vio y que esta auditoría sí: **los 4 casos de "construido pero no aplicado" caen todos en features cuyo criterio de salida no exige efecto observable**, y el caso de T11 refuerza lo que se había observado en T8, T10, T12 y T14. El plan verifica bien donde no hay enforcement y no verifica donde sí lo hay.

---

## Metodología

- **2 subagentes en paralelo, scopes disjuntos**, ninguno leyendo el output del otro:
  - **@QA / Auditor** (`mimo-v2.6-flash-free`): verificación técnica de claims, código y seguridad.
  - **@Orquestador** (`nemotron-3-ultra-free`): plan, proceso y causa raíz.
- **Worktree de Paseo** (`wks_cdc020039c635b06`) con `pnpm install` real. Se verificó que `prettier` y `tsc` resuelven — con una junction fallarían y `typecheck` daría falso verde.
- **Consolidado de lectura obligatoria**: ambos leyeron `#257` vía `git show audit/fase3-midphase:...` antes de verificar, porque el documento vive en una rama sin mergear.
- **Convergencia independiente:** @QA y @Orquestador llegaron al mismo diagnóstico sobre T10 sin hablarse. El principal corrió su propia comparación de los 15 criterios de salida del plan y confirmó la tabla de @Orquestador sobre 4 tareas, pero la extendió a las 15 y la matizó.
- **Verificación propia de las 2 claims ALTO nuevas** antes de registrarlas.
- Read-only sobre `apps/` y `packages/`. Este PR no toca código de producción.

---

## Verificación de claims de #257

| #   | Claim                                                 | Veredicto                                           | Evidencia                                                                                                                                                                                                         |
| --- | ----------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ítem 103: matriz sin consumidor productivo            | **CONFIRMADA**                                      | `deriveTenantPermissions` tiene **1** consumidor: `apps/admin/app/api/subscriptions/route.ts:10,92,95,102` — un GET que devuelve los permisos como **datos**. `apps/admin` no tiene `middleware.ts` ni `proxy.ts` |
| 2   | Ítem 104: `encryptToken` UPDATE-only, `Promise<void>` | **CONFIRMADA**                                      | `packages/commerce/src/encryption.ts:33,58` — sin `INSERT`/`ON CONFLICT`, sin chequeo de filas. `decryptToken` devuelve `null` con 0 filas                                                                        |
| 3   | Las discrepancias doc↔código                          | **15 CONFIRMADAS, 1 matizable**                     | Ver E4 y E5                                                                                                                                                                                                       |
| 4   | Ítem 98: 39 tests que se saltan                       | **CONFIRMADA en sustancia, IMPRECISA en mecanismo** | Conteo 15+5+5+8+6 = **39** ✓. Pero el disparador no es "falta la variable" — ver E2                                                                                                                               |
| 5   | Cobertura de la matriz: solo función pura             | **CONFIRMADA**                                      | `canSell`/`canPublish`/`canAccessPanel` solo en los 2 archivos de la matriz. Cero tests que crucen los puntos de aplicación                                                                                       |
| 6   | RLS de Fase 3 correcta                                | **CONFIRMADA**                                      | `0000_baseline.sql:219` ENABLE, `:230` FORCE, `:250` policy `tenant_isolation` sobre `tenant_mp_config`. Ejecutado en vivo: 8/8 cross-tenant                                                                      |
| 7   | Migraciones con señal declarada                       | **CONFIRMADA**                                      | `check-migrations-applied.mjs` tiene `0003` y `0004`; cableado en `db:migrate`. `0004` idempotente                                                                                                                |
| 8   | `turbo.json` sin las 2 variables                      | **CONFIRMADA**                                      | Declaradas en `packages/validation/src/env.ts:71,89`, ausentes del `env` de build                                                                                                                                 |
| 9   | D13 (2 capas) parcial                                 | **CONFIRMADA y endurecida**                         | `register-tenant` tiene **solo integración**; `branding` **solo unitaria**. Ninguno tiene ambas                                                                                                                   |

---

## Errores en #257

Ninguno cambia la dirección de un hallazgo. Todos son de precisión.

| #      | Qué afirmación                                                 | Por qué está mal                                                                | Evidencia                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **E1** | "Ítem 100: `pnpm typecheck` no ve los tests; `pnpm build` sí"  | **REFUTADO como regla general.** Solo `apps/admin` excluye tests de su programa | `apps/admin/tsconfig.json` → `exclude: ["node_modules","**/__tests__/**"]`; storefront y superadmin solo excluyen `node_modules`. Empírico con `tsc --noEmit --listFiles`: **superadmin 4**, **storefront 16**, **admin 0** test files en el programa                                                  |
| **E2** | "Sin `DATABASE_APP_URL` esos 39 tests desaparecen en silencio" | Mecanismo equivocado, y el escenario real es peor                               | 2 de los 5 guardan con `DATABASE_URL` (no la de app). Si faltara **solo** `DATABASE_APP_URL`, esos **20** tests seguirían corriendo y su `beforeAll` reventaría con el throw de `packages/db/src/index.ts:6-11` → **20 en ROJO**, no skip. El skip silencioso total ocurre en CI, por dummy URLs (H-2) |
| **E3** | Ítem 98: "seis `describe.skipIf`", guards homogéneos           | Off-by-one y homogeneización falsa                                              | Son **5 en 5 archivos**, no 6. Los guards: 2 sobre `DATABASE_URL`, 2 sobre `DATABASE_APP_URL`, y **1 que exige ambas** (`subscription-transition.test.ts:77`)                                                                                                                                          |
| **E4** | Discrepancia #2: `README:548` contradice a `:515`              | **Matizable.** Es línea de changelog append-only, no afirmación de estado       | `:515` (889/78) es el estado actual y **coincide** con la corrida. `:548` es historia. AGENTS.md exige que el changelog sea append-only: señalarlo como contradicción fue leer una línea con la regla equivocada                                                                                       |
| **E5** | Tabla de endpoints: "6 rutas + branding"                       | Subcontado                                                                      | Faltan además `/api/register-tenant`, `/api/webhooks/mercadopago/subscriptions`, y los `health`/`auth` de admin                                                                                                                                                                                        |

### Error adicional — fuera de #257

El **reporte de reincorporación** de esta sesión afirmó que "`pnpm typecheck` no typechequea los tests; `pnpm build` sí", y lo presentó como getcha del repo. Es el mismo error que E1, propagado sin verificar. Queda registrado acá: **esa afirmación estaba en mi reporte y era falsa.**

---

## Hallazgos nuevos

### H-F3-v2-1 — **ALTO** · Código · T11 inerte

**El branding escribe una columna que nadie lee, mientras la UI sigue usando la columna vieja.**

- **Categoría:** código / arquitectura
- **Evidencia:**
  - Único escritor de `dbTenants.logoUrl`: `apps/admin/app/api/config/tenant/branding/route.ts:86`; lo devuelve en `:92`.
  - **Nadie lo lee.** `git grep logoUrl` sobre `apps/` y `packages/` no encuentra ninguna lectura de `dbTenants.logoUrl`.
  - El storefront lee **`settings.logoUrl`**, la columna **jsonb**: `apps/storefront/app/layout.tsx:53,77,83`.
  - La UI de admin también: `apps/admin/app/(dashboard)/store/settings/page.tsx:64,93`.
  - Único llamador del endpoint: su propio test, `branding/__tests__/route.test.ts:76`.
- **Impacto:** **dos fuentes de verdad y la visible es la anterior.** El logo que un tenant sube por la feature de Fase 3 nunca aparece en su tienda. El endpoint, la migración `0004`, y los tests están verdes: T11 está completo según su criterio de salida y **no produce efecto observable**.
- **Por qué importa más allá de T11:** es la **cuarta ocurrencia** del patrón "construido pero no aplicado", después del ítem 61, el ítem 94 y el ítem 103. Y es la que ningún control del DoD puede ver.
- **Recomendación:** decidir cuál es la fuente de verdad antes de S5. Si es `tenants.logoUrl`, la UI de admin debe escribir ahí y el storefront debe leer de ahí; si es `settings`, la feature de Fase 3 sobra.

### H-F3-v2-2 — **ALTO** · Proceso / CI

**25 tests de base de datos no se ejecutan en ningún workflow. El workflow lo advierte.**

- **Categoría:** proceso / CI
- **Evidencia:**
  - `.github/workflows/ci.yml:48-49` escribe `postgresql://dummy:dummy@localhost:5432/dummy` para `DATABASE_URL` y `DATABASE_APP_URL`.
  - `.github/workflows/e2e.yml:131-134` corre contra Neon real **solo** `rls-cross-tenant` y `preapproval-tenant-resolution` (14 tests).
  - El comentario de `e2e.yml:129-130` dice textualmente: _"Un archivo nuevo que dependa de la DB tiene que agregarse aca: en `build` pasaria verde sin ejecutar nada."_
  - Faltan: `register-tenant` (**15**), `tenant-lifecycle` (**5**), `subscription-transition` (**5**) = **25**.
- **Impacto:** el job `build` reporta verde sin haber ejecutado un solo test contra la DB. Y el **endpoint público de alta de tenant tiene cobertura efectiva cero en CI**: sus 15 tests son su única evidencia y no corren. La regla estaba escrita en el archivo; simplemente no se aplicó.
- **Recomendación:** agregar los 3 archivos a `e2e.yml`. Convertir el comentario en un check automatizado (contar los `describe.skipIf(!...)` del repo contra los archivos listados en el workflow) para que la próxima no dependa de que alguien lo lea.

### H-F3-v2-3 — **MEDIO** · Seguridad

**`/api/register-tenant` es público, sin rate limiting, y enumera emails de administradores.**

- **Evidencia:** endpoint público sin sesión; ~100 ms de CPU por request (`bcrypt` 10 rounds), 1 select + 3 inserts (`route.ts:129,155,162-188`). El único rate limit del storefront está en `checkout/preference/route.ts:21,55`. Devuelve `409 "Email ya registrado"` (`route.ts:204`).
- **Impacto:** vector de spam/abuso de CPU sobre una superficie pública, y enumeración de cuentas de administrador. El patrón de enumeración es preexistente en `/api/register:61` — pero se replicó a una superficie nueva sin corregirlo.
- **Costo:** ~1 h.

### H-F3-v2-4 — **MEDIO** · Seguridad / recursos

**El upload de branding no valida tamaño ni sanitiza el nombre de archivo usado como key de R2.**

- **Evidencia:** solo chequea `file.size === 0` (`route.ts:46`); `Buffer.from(await file.arrayBuffer())` (`:66`) carga todo en memoria. Key construida como `branding/${tenantId}/${randomUUID()}-${file.name}` (`:69`) con `file.name` controlado por el cliente. `getPublicUrl` (`packages/storage/src/index.ts:59-74`) no sanitiza, así que nombres con `#`, `?` o espacios rompen la URL devuelta. Acepta `image/svg+xml` (hoy inocuo: se renderiza en `<img>`). No borra el logo anterior: quedan objetos huérfanos en R2 (`deleteImage` sí se usa en products, no acá).
- **Costo:** ~1 h.

### H-F3-v2-5 — **MEDIO** · Código / Config

**`/api/register-tenant` no está excluido del matcher del proxy: puede dar 404.**

- **Evidencia:** `apps/storefront/proxy.ts:11-13` excluye del matcher solo `_next/static|favicon|api/webhooks|api/health|imágenes`. La ruta solo responde si el host es `PLATFORM_HOST` (`proxy.ts:58`, variable **opcional** en `env.ts:71-77`) o si resuelve tenant. Sin `PLATFORM_HOST` → 404 en el host de plataforma; en `localhost` sin `ENABLE_DEFAULT_TENANT_FALLBACK` → 404. Los tests invocan `POST()` directo, así que la integración con el proxy no está cubierta.
- **Por qué importa:** un endpoint público que devuelve 404 según la configuración de un host es un modo de falla silencioso. `PLATFORM_HOST` es opcional justamente porque "apagado" significa "no hay landing" — pero también rompe el registro.
- **Costo:** ~0.5 h.

### H-F3-v2-6 — **BAJO** · Seguridad

**Fuga de información interna al anónimo en el alta de tenant.**

- **Evidencia:** el `400` devuelve `validation.error.issues` completo (`route.ts:106`: path, message, code) y el `201` devuelve el `tenantId` (UUID interno, mismo formato que el `external_reference` de MP). Sin firma no es explotable.
- **Costo:** ~0.3 h.

### H-F3-v2-7 — **BAJO** · Código

**Amplía el ítem 104: `EncryptionError('TENANT_NOT_FOUND')` está declarado y muerto.**

- **Evidencia:** `packages/commerce/src/encryption.ts:113` declara el código; cero `throw` en el repo con ese código. Ningún test cubre el caso "tenant sin fila" en `encryption.test.ts`.
- **Por qué importa hoy:** el ítem 104 es **latente**, no activo — `encryptToken` no tiene llamadores productivos (solo tests y re-export). Pero cuando T8/S3b empiece a usarlo, el fallo silencioso no tendrá ninguna señal: ni error, ni código de error, ni test. El tipo de error ya existía para detectarlo y no se usó.

---

## Corrección a la primera pasada: T10 es excepción, pero el patrón es peor

La primera pasada concluyó que el criterio de T10 era la causa raíz y que el repo no tenía forma de distinguir "construido" de "aplicado". Esta pasada matiza ambas cosas, en direcciones opuestas:

**Donde la primera pasada fue demasiado generosa:** con la comparación completa de los 15 criterios de salida, T10 no es el único débil. Lo son **T8, T12 y T14** también — y ese no es un detalle.

| Task | Criterio                                                          | Problema                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T8   | "Test: sin fila de MP, el checkout **rechaza** con mensaje claro" | **Se cumple con el defecto que debía detectar.** El checkout rechaza _precisamente porque_ la fila nunca se creó (ítem 104). El criterio pasa mientras `encryptToken` falle en silencio |
| T10  | "una tabla de tests que cubre las 8 combinaciones"                | Sin efecto observable                                                                                                                                                                   |
| T12  | "recorrido completo en local... Sin errores de consola"           | Subjetivo, no automatizable                                                                                                                                                             |
| T14  | "El panel **no ofrece acciones** fuera de su estado"              | Nombra la enforcing, no exige verificarla. Es S5, sin empezar                                                                                                                           |

**Donde la primera pasada fue demasiado amplia:** los demás criterios (T1, T3, T4, T5, T7, T9, T11) **sí exigen efecto observable**. T5 hasta exige verificación en rojo — mutar el `WHERE` y comprobar que el test falla. El plan no es culturalmente débil.

**La formulation correcta:** los 4 criterios débiles **no están dispersos al azar — son exactamente las tasks donde vive el enforcement** (config MP, guard de permisos, onboarding, panel). En las tasks donde el enforcement no está en juego, el plan verifica bien. Y H-F3-v2-1 (T11) confirma el mismo patrón en un quinto lugar.

La consecuencia práctica es más barata y más accionable que "cambiar la cultura del plan": **comparar los criterios de salida entre tasks es un control de revisión de minutos que habría atrapado los cinco.**

---

## Análisis de procesos

| Proceso                             | ¿Funcionó?                      | Evidencia                                                                                                            |
| ----------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Issues por slice                    | **Mejoró**                      | #252–#256 cubren S3b–S6                                                                                              |
| Issues abiertos = trabajo pendiente | **Parcial**                     | #253 ("aplicar guards") ya sabía que faltaban, pero #250 se cerró como si no faltaran. **Dos issues se contradicen** |
| Cierre de issues                    | **Falló**                       | #250 cerrado con criterios incumplidos. La regla de AGENTS.md verifica `state`, no contenido                         |
| Specs actualizados                  | **No**                          | `spec:329` dice que 65 y 67 bloquean; cerraron en S2                                                                 |
| Ritual de cierre                    | **Falló 1 vez (2ª ocurrencia)** | S4a sin bitácora → "entrada tardía". El ítem 102 lo predijo y reincidió                                              |
| Migraciones antes del código        | **Falló en S4a**                | `bitacora.md:4695` — `logoUrl` commiteado antes de `0004`, 7 tests en rojo                                           |
| **Workflows de DB**                 | **Falló**                       | H-F3-v2-2: la regla estaba escrita en `e2e.yml` y no se aplicó                                                       |
| Engram antes del commit             | **Funcionó**                    | Todos los slices con memoria commiteada                                                                              |
| Falsos positivos de PowerShell      | **No se repitió**               | Ninguno de los dos subagentes reportó mojibake. El ítem 106 empieza a dar resultado                                  |

---

## Recomendación

**La primera pasada no se equivocó en su veredicto. Se refuerza: Fase 3 no sigue a S3b.**

Orden actualizado (incorporando lo que encontró esta pasada):

| Orden | Acción                                                                                                  | Por qué                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | **Decidir el alcance del ítem 103** y corregir el criterio de salida de T10 **junto con T8, T12 y T14** | Los 4 comparten el defecto. Corregir solo T10 deja los otros 3                                                      |
| 2     | **H-F3-v2-1: decidir la fuente de verdad del logo** antes de S5                                         | S5 construye UI de onboarding. Construir sobre dos fuentes de verdad multiplica el costo                            |
| 3     | **H-F3-v2-2: agregar los 3 archivos a `e2e.yml`**                                                       | 25 tests sin ejecutar, incluido el endpoint público de alta. Es lo más barato de la lista y lo que más riesgo cubre |
| 4     | Ítem 18 / 104 dentro de T8                                                                              | ~1 h, desbloquea S3b                                                                                                |
| 5     | Ítems 104–106 (`turbo.json`, plan vs slices)                                                            | Docs/config                                                                                                         |

**Lo que cambió respecto de la primera pasada:** la lista de "cosas que no son un problema" es más corta de lo que parecía. El ítem 98 era menos grave de lo reportado (no es un skip silencioso por variable faltante), pero la causa real es peor — **CI nunca corre esos 39 tests, y 25 de ellos no corren en ningún lado**.

---

## Limitaciones

- **Segunda pasada "warm"**: los subagentes leyeron #257 antes de verificar. No es verificación independiente en el sentido de un revisor ciego; sesga hacia "confirmar lo que #257 ya afirmaba". La mitigación fue exigir veredicto **CONFIRMADO / REFUTADO / IMPRECISO** con evidencia `archivo:línea`, y los REFUTADOS resultaron justificados.
- **No se corrieron `pnpm build` ni la suite completa** en esta pasada. @QA ejecutó 5 archivos puntuales contra Neon: 39/39 verdes.
- **El escenario E2 (20 tests en rojo sin `DATABASE_APP_URL`) es razonamiento estático**, no ejecución: no se puede simular "variable ausente" sin editar `.env.local`, que quedaba fuera del alcance read-only.
- **El refut de E1 se hizo con `tsc --noEmit --listFiles`**, que es el mismo programa que usa Next, pero **no** se ejecutó `next build` real. No se descartó al 100 % el efecto del cache de turbo sobre la anécdota `TS2741`.
- **No se revisaron Playwright E2E ni la UI de Fase 3** (S5 no empezó).
- Las 2 claims ALTO nuevas fueron verificadas por el principal de forma independiente antes de registrarse.
