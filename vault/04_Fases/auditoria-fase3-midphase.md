# Auditoría — Fase 3 mid-phase (Autoservicio de tenants)

**Fecha:** 2026-10-14
**Base:** `develop` @ `ef401aa` (merge de S4b, PR #251)
**Rama:** `audit/fase3-midphase`
**Precedente:** #197 (mid-phase de Fase 2) y #207 (cierre de Fase 2)

---

## Resumen ejecutivo

- **Scope:** S1, S2, S3, S4a, S4b (5 slices declarados como completos).
- **Total de hallazgos:** 9 — 1 CRÍTICO, 2 ALTO, 4 MEDIO, 2 BAJO.
- **Veredicto:** **Fase 3 NO puede seguir hacia S3b sin una decisión explícita.**
  Un hallazgo CRÍTICO (H-F3-1) invalida la premisa de que S4b está completo, y dos
  ítems (18 y 101) bloquean trabajo ya planificado.

### El hallazgo que domina el resto

**S4b se cerró como "guard puede publicar/vender", y no hay ningún guard.**

El issue #250 (cerrado el 2026-10-14) define tres puntos de aplicación y promete
tests de integración para cada uno. **Ninguno de los tres existe.** La matriz de
permisos es correcta, exhaustiva y bien testeada como función pura — y no la lee
nadie fuera del endpoint que la devuelve como dato.

Esto no es un defecto de implementación. Es un defecto de **criterio de salida**:
T10 se cerró con "una tabla de tests que cubre las 8 combinaciones", y esa tabla
existe. El criterio nunca dijo "el guard se aplica". El plan dejó el trabajo a
medio camino sin que el typecheck ni los tests pudieran notarlo.

Es el patrón que el proyecto ya conoce y ya bautizó: _item 61_, "un control que
acompaña y no verifica".

---

## Metodología

1. **Baseline del DoD con `--force`.** La corrida inicial (`pnpm lint`,
   `pnpm typecheck`, `pnpm build`) fue **100% replay de cache de turbo**: 18 tasks,
   0 trabajo real. Se repitió con `pnpm turbo run lint typecheck build --force`
   para obtener evidencia real.
2. **Verificación de skipped reales** (item 98) vía el reporter JSON de vitest
   (`--outputFile`), no por parsing de texto, para no depender del resumen que
   "no reporta skipped".
3. **12 discrepancias doc↔código** verificadas leyendo ambos lados.
4. **Búsqueda de defectos** por categoría A-E, con `git grep` de consumidores.
5. **Decisiones del plan** D1–D17 cotejadas contra el código.
6. **Análisis de procesos**: issues, bitácora, rituales de cierre.

**Read-only sobre el código de producción.** Ningún archivo de `apps/` ni
`packages/` fue modificado en este PR.

---

## Hallazgos

### H-F3-1 — **CRÍTICO** · Código / Proceso

**S4b cerró un guard que no existe. `canSell`, `canWrite` y `canAccessPanel` no
tienen ningún consumidor que los imponga.**

- **Categoría:** código + proceso
- **Evidencia:**
  - `packages/commerce/src/subscription-permissions.ts:315` — `deriveTenantPermissions` definida.
  - `apps/admin/app/api/subscriptions/route.ts:102` — **único** consumidor en producción. Es un `GET` que **devuelve** los permisos.
  - `canSell`, `canWrite`, `canAccessPanel`: `git grep` sin `__tests__` → **cero** coincidencias fuera de su propia definición.
  - Issue #250 (CLOSED 2026-10-14): "**Puntos de aplicación. Tres, no veinte:** `canSell` en checkout y checkout/preference; `canPublish` en los endpoints de escritura de admin; `canAccessPanel` en el middleware de admin." Y en Tests: "8 tests de la matriz pura ... **mas tests de integracion de los 3 puntos de aplicacion**".
- **Impacto:** el estado de suscripción **no controla nada**. Un tenant `cancelled` o `expired` sigue creando productos; un tenant `pending` tiene su tienda vendiendo si el proxy lo deja pasar. La asimetría D17 (`past_due` **vende** pero **no publica**) existe únicamente como documento. El tenant `suspended` no está bloqueado: `canAccessPanel: 'none'` viaja en la respuesta de un GET que el cliente puede ignorar.
- **Recomendación:** reabrir #250 o usar #253 (S4c) como el cierre real. Antes de eso, **corregir el criterio de salida de T10** en el plan: un guard sin punto de aplicación no está terminado. La redacción actual permite repetir el fallo.
- **Costo:** ~6 h para los 3 puntos + tests de integración. No es opcional.

### H-F3-2 — **ALTO** · Código

**El ítem 18 no solo bloquea T8: falla en silencio.**

- **Categoría:** código
- **Evidencia:** `packages/commerce/src/encryption.ts:58` — `UPDATE "tenant_mp_config" SET ... WHERE "tenantId" = $n`. Sin `INSERT`, sin `ON CONFLICT`, y **sin verificar filas afectadas**. El retorno es `Promise<void>`.
- **Impacto:** un tenant recién creado (S3 no crea fila de MP) llama a `encryptToken`, el `UPDATE` afecta **0 filas, no lanza error**, y la función retorna `void`. El tenant cree que guardó sus credenciales de MercadoPago. El síntoma aparece mucho después, en el checkout, vía `decryptToken` → `null` (`encryption.ts:103`). Convertir un error de configuración en un error de pago.
- **Recomendación:** `encryptToken` debe fallar ruidosamente si no hay fila. T8 (S3b) ya dice que la fila "se crea completa o no se crea", pero la función actual no puede distinguir esos dos casos.
- **Costo:** ~1 h dentro de T8.

### H-F3-3 — **ALTO** · Proceso / Docs

**El plan de Fase 3 describe 6 slices. La realidad tiene 9. S4c, S4d y S3b no
existen en el plan.**

- **Categoría:** proceso / docs
- **Evidencia:**
  - `docs/superpowers/plans/2026-10-09-fase3.md:148-150` — "### S3 — El alta de tenant / **Tasks:** T7, T8 / ~11 h / ~430 líneas".
  - `docs/superpowers/plans/2026-10-09-fase3.md:448` — nota de alcance del 2026-10-10: "T8 se corrió fuera de S3 y pasa a **S3b**". La tabla de slices **nunca se actualizó**.
  - `git grep "S4c\|S4d"` en el plan y los specs: **cero coincidencias**. S4c y S4d solo existen en `vault/03_Deuda/deuda-tecnica.md:4325-4335` y `bitacora.md:4668`.
  - Issues que sí existen: #252 (S3b), #253 (S4c), #254 (S4d), #255 (S5), #256 (S6).
- **Impacto:** el plan es la fuente de dependencia del resto del equipo. Dice que S3 son 11 h / 430 líneas cuando son dos slices distintos, y no menciona dos slices que ya tienen issue asignado. Quien lea el plan para estimar no encuentra S4c/S4d, que son justamente los que cierran H-F3-1.
- **Recomendación:** actualizar la tabla de slices del plan con el estado real (S1, S2, S3, S3b, S4a, S4b, S4c, S4d, S5, S6) y marcar S3b/S4c/S4d como añadidos después del 2026-10-10.
- **Costo:** ~0.5 h.

### H-F3-4 — **MEDIO** · Proceso

**El issue #250 se cerró con criterios de aceptación incumplidos y sin verificación.**

- **Categoría:** proceso
- **Evidencia:** el body de #250 promete "tests de integracion de los 3 puntos de aplicacion". No existen. El issue está `CLOSED` desde el 2026-10-14T14:52:08Z. Contrastar con `AGENTS.md`: "todo issue de implementación se cierra a mano, verificando con `gh issue view <n> --json state,closedAt`". Se verificó el estado, no el contenido.
- **Impacto:** el cierre prematura de #250 es lo que convirtió H-F3-1 en algo invisible. Sin #250 cerrado, el guard faltante habría seguido abierto.
- **Recomendación:** verificar los criterios de aceptación del issue, no solo su `state`, antes de cerrar. Aplicar a los cinco issues de Fase 3 abiertos.
- **Costo:** ~0.5 h (proceso).

### H-F3-5 — **MEDIO** · Proceso

**La bitácora de S4a se escribió como "entrada tardía": el ritual de cierre se volvió a saltear (item 102, segunda ocurrencia).**

- **Categoría:** proceso
- **Evidencia:** `vault/02_Bitacora/bitacora.md:4671` — "## 2026-10-14 - S4a: activacion desde el webhook (T9) + branding (T11) - **entrada tardia**". La entrada existe ahora, pero se titula así porque S4a (PR #249, mergeado 2026-10-14) se cerró sin bitácora y se corrigió después.
- **Impacto:** el item 102 predice exactamente esto y ya cumplió. Es la segunda ocurrencia del patrón, no la primera.
- **Recomendación:** bitácora como paso del checklist de cierre de PR, antes del merge. No al día siguiente.
- **Costo:** ~0 h (disciplina).

### H-F3-6 — **MEDIO** · Configuración

**Variables de Fase 3 fuera de `turbo.json`: el build puede fallar en Vercel y no en local.**

- **Categoría:** configuración
- **Evidencia:** `SETUP.md:683` y `PROMPTS.md:562` — "Si agregás una variable nueva en Vercel, agregala también en `turbo.json`". `turbo.json` → `tasks.build.env` **no** lista `PLATFORM_HOST` ni `ENABLE_DEFAULT_TENANT_FALLBACK`, ambas validadas en `packages/validation/src/env.ts:66-92`.
- **Impacto:** bajo mientras el build pase en local, pero es exactamente el modo de fallo que la regla existe para evitar.
- **Recomendación:** agregar ambas a `tasks.build.env`.
- **Costo:** ~0.2 h.

### H-F3-7 — **MEDIO** · Código

**El archivo de test no se llama como el archivo que testea.**

- **Categoría:** código / legibilidad
- **Evidencia:** `packages/commerce/src/__tests__/tenant-permissions.test.ts` importa y testea `deriveTenantPermissions`, que vive en `subscription-permissions.ts`. No existe `tenant-permissions.ts`. Junto a él, `subscription-permissions.test.ts` testea `derivePermissions`, del mismo archivo.
- **Impacto:** bajo, pero rompe el Default de "el nombre del test dice qué testeás" y complica la búsqueda. Agrava el hecho de que **dos archivos de test cubren un solo archivo fuente**, lo que hace la cobertura de `subscription-permissions.ts` menos evidente de lo que aparenta.
- **Recomendación:** renombrar `tenant-permissions.test.ts` → `deriveTenantPermissions.test.ts`, o fusionarlo en `subscription-permissions.test.ts`. **No hacerlo en este PR** (es código).
- **Costo:** ~0.3 h.

### H-F3-8 — **BAJO** · Docs

**Cuatro ítems de la auditoría previa no correspondían o están desactualizados.**

- **Categoría:** docs
- **Evidencia:**
  - **Item 103 no existe.** La auditoría previa y el encargo de esta auditoría lo citan; `vault/03_Deuda/deuda-tecnica.md` tiene 101 headings, máximo 102, y el único hueco es el 99.
  - **Items 93 y 97** figuran `ABIERTO` (`deuda-tecnica.md:3923`, `:4124`) pero están resueltos (S1 y S4b). El 97 tiene un bloque `RESUELTO` en `:4149` sin cambiar el `Estado:` de cabecera.
  - **Item 98**: el riesgo **no se materializó** en esta corrida. Ver abajo.
- **Recomendación:** cerrar 93 y 97 (ver PASO 7). No crear un item para 103: el hecho de que se lo cite no lo hace existir.

### H-F3-9 — **BAJO** · Código

**`catch (e: any)` en `encryption.ts`, en un paquete que no pasa lint.**

- **Categoría:** código
- **Evidencia:** `packages/commerce/src/encryption.ts:61,99,100` usan `catch (e: any)`. `AGENTS.md`: "**No usar `any`**: preferir `unknown` + type guard". `@repo/commerce` **no tiene script `lint`**, así que `turbo run lint` (6 workspaces) nunca lo revisa.
- **Impacto:** bajo por sí mismo; relevante porque conecta con el ítem 10 de deuda y muestra que la brecha de lint tiene consecuencias concretas, no teóricas.
- **Recomendación:** `unknown` + type guard. Registrar la brecha de lint como ítem propio.

---

## Verificación del ítem 98 (crítico para el DoD)

**Resultado: el riesgo NO se materializó en esta corrida, y el conteo real es 889.**

Se corrió vitest con `--reporter=json --outputFile` para no depender del resumen de texto:

```
passed=889  failed=0  skipped=0  other=0  totalFiles=78
```

Las cinco suites con `describe.skipIf` **sí ejecutaron**, porque `DATABASE_APP_URL`
está configurada en este entorno:

| Suite                                                             | Assertions | Estado       |
| ----------------------------------------------------------------- | ---------- | ------------ |
| `apps/storefront/.../register-tenant/__tests__/route.test.ts`     | 15         | todas passed |
| `packages/db/src/__tests__/rls-cross-tenant.test.ts`              | 8          | todas passed |
| `packages/db/src/__tests__/preapproval-tenant-resolution.test.ts` | 6          | todas passed |
| `packages/commerce/src/__tests__/tenant-lifecycle.test.ts`        | 5          | todas passed |
| `packages/commerce/src/__tests__/subscription-transition.test.ts` | 5          | todas passed |

**39 tests de integración real contra Neon se ejecutaron.** No hubo skips.

El ítem 98 sigue **ABIERTO** y describe un riesgo real: en un entorno sin
`DATABASE_APP_URL` (CI sin secrets, o una dev sin `.env.local`) esos 39 tests
desaparecen en silencio y `pnpm test` sigue verde. Verificado que el reporte de
vitest **no** distingue ese caso del verde completo. Lo que esta corrida prueba es
que _hoy, acá_, no se ocultó nada.

---

## Discrepancias doc↔código

Las 12 verificadas. Todas reales.

| #    | Doc dice                                                 | Código hace                                                                       | Veredicto    | Acción                                                                     |
| ---- | -------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| 1    | `README.md:515` — 889 tests / 78 archivos                | 889 / 78                                                                          | **Correcto** | Ninguna                                                                    |
| 2    | `README.md:548` — 769 tests / 73 archivos                | Contradice `:515` **en el mismo archivo**                                         | Real         | Actualizar el changelog (append-only: agregar línea, no tocar la anterior) |
| 3    | `README.md:234` — `docs/adr/`, "ADR-001 a ADR-022"       | `docs/adr` **no existe**; hay 28 ADRs en `vault/01_ADRs/`                         | Real         | Corregir ruta y rango                                                      |
| 4    | `README.md:26` — Fase 3 "🔜 Pendiente"                   | Fase 3 en curso, 5 slices hechos                                                  | Real         | Marcar en curso                                                            |
| 5    | `README.md:25` — Fase 2 "🔜 Pendiente"                   | `arquitectura.md:76` y `bitacora.md:3620`: cerrada el 2026-10-06                  | Real         | Marcar cerrada                                                             |
| 6-12 | Tabla de endpoints de `README.md:259-367`                | Faltan 6 rutas de `apps/admin/app/api/subscriptions/*` y `config/tenant/branding` | Real         | Agregar las 6                                                              |
| 13   | Ítem 93 `ABIERTO`                                        | Resuelto en S1                                                                    | Real         | Cerrar (PASO 7)                                                            |
| 14   | Ítem 97 `ABIERTO`                                        | Resuelto en S4b                                                                   | Real         | Cerrar (PASO 7)                                                            |
| 15   | Spec `:329` — "65 y 67 abiertos, ninguno bloquea Fase 3" | 65 y 67 cerraron en S2                                                            | Real         | Actualizar spec                                                            |
| 16   | Plan `:148-150` — S3 = T7, T8                            | T8 se movió a S3b (nota en `:448`)                                                | Real         | Actualizar tabla de slices                                                 |

**Extra, no estaba en las 12:** el plan no menciona S4c ni S4d (H-F3-3).

---

## Decisiones del plan

| Decisión                                                   | ¿Implementada?                 | Evidencia                                                                                                               |
| ---------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **D1** `PLATFORM_HOST` en el proxy, antes de los fallbacks | **Sí**                         | `apps/storefront/proxy.ts:58`; test `proxy-platform-host.test.ts`                                                       |
| **D2** El proxy filtra `status = 'active'`                 | **Sí**                         | `proxy.ts:31,75,100,138` — los 3 caminos de resolución filtran                                                          |
| **D3** `tenantId` pre-generado en la app                   | **Sí**                         | `register-tenant/route.ts:148` — `crypto.randomUUID()`                                                                  |
| **D4** `tenants.status` → pgEnum, default `pending`        | **Sí**                         | `0003_tenants_status_enum.sql`; 4 valores en `proxy.ts:21`                                                              |
| **D5** `activateTenant` como función propia, 1 capa        | **Sí**                         | `packages/commerce/src/tenant-lifecycle.ts` + test contra Neon                                                          |
| **D9** Token manual de MP (T8)                             | **No** — pendiente (S3b, #252) | —                                                                                                                       |
| **D12** Reusar `transitionSubscription`, hoja por caso     | **Sí**                         | `packages/commerce/src/subscription-transition.ts` (Fase 2, item 61)                                                    |
| **D13** Todo endpoint nuevo con test de 2 capas            | **Parcial**                    | `register-tenant` y `branding` tienen test. El punto de aplicación de `canSell` **no existe** (H-F3-1)                  |
| **D17** `past_due` vende pero no publica                   | **Matriz sí, aplicación no**   | Definido en `subscription-permissions.ts:154-165` y testeado en `tenant-permissions.test.ts:126-136`. **Nadie lo lee.** |
| **D18** Slug nunca se reutiliza + 16 reservados            | **Sí**                         | `packages/commerce/src/tenant-slug.ts` + test                                                                           |

**D6, D7, D8, D10, D11, D14, D15, D16** no se auditaron en detalle: son de alcance
(producto) o de tareas aún no despachadas (T12–T15).

---

## Análisis de procesos

| Proceso                              | ¿Funcionó?                               | Evidencia                                                                                                                             |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Issues por slice                     | **Mejoró**                               | #252–#256 cubren S3b, S4c, S4d, S5, S6. La omisión histórica de S2/S3 está corregida de facto                                         |
| Issues abiertos = trabajo pendiente  | **Parcial**                              | #253 "aplicar los guards a los endpoints" **ya knew** que faltaban, pero #250 se cerró como si no faltaran. Dos issues se contradicen |
| Specs actualizados con el código     | **No**                                   | Items 96 y 97 cambiaron el comportamiento; `spec:329` sigue desactualizado                                                            |
| Ritual de cierre (bitácora + Engram) | **Falló una vez**                        | S4a sin bitácora → "entrada tardia" (`bitacora.md:4671`). El item 102 lo predijo y reincidió                                          |
| Engram antes del commit              | **Funcionó**                             | Todos los slices tienen memoria en `vault/engram/` commiteada                                                                         |
| Migraciones antes del código         | **Falló en S4a**                         | `bitacora.md:4695` — se commiteó `logoUrl` antes de aplicar la 0004, 7 tests en rojo. Documentado y resuelto                          |
| **Falsos positivos de PowerShell**   | **Se repitió 3 veces en esta auditoría** | Ver abajo                                                                                                                             |

### El patrón de los falsos positivos

Durante esta auditoría, **tres** lecturas de archivos vía PowerShell reportaron
mojibake que **no existía**:

| Archivo reportado                     | U+FFFD real (Node) | BOM |
| ------------------------------------- | ------------------ | --- |
| `packages/commerce/src/encryption.ts` | 0                  | no  |
| `packages/auth/src/index.ts`          | 0                  | no  |
| `packages/validation/src/env.ts`      | 0                  | no  |

`pnpm check:encoding` → **0 hallazgos**. Los archivos están sanos.

Es la trampa de `AGENTS.md` §6.5, confirmada por tercera vez, y el mecanismo de
fallo se repite exactamente igual: **`Get-Content` y `Select-String` decodifican
UTF-8 como ANSI**. Un agente que reporte lo que ve en la consola produce seis
defectos inexistentes.

**Regla operativa para toda auditoría futura:** medir encoding solo con Node o
`git diff --numstat`, nunca desde salida de shell. Amplía el ítem 79.

---

## Lo que #197 y #207 no vieron

1. **H-F3-1 no es un defecto de código: es un criterio de salida.** Las auditorías
   anteriores verificaban que los tests estuvieran verdes. Acá hay ~30 tests verdes
   sobre una función que nadie llama. El test suite es _correcto_ y el sistema _no
   funciona_. Ningún control del DoD distingue los dos casos.
2. **La divergencia plan↔realidad en el número de slices (H-F3-3)**, que viene de
   amendments escritos dentro de las tasks en vez de actualizar la tabla.
3. **El silencio de los skips.** #197 y #207 corrieron `pnpm test` y leyeron el
   resumen. El resumen no reporta `skipped`. Hizo falta el reporter JSON.

---

## Recomendación

**Fase 3 no debería avanzar a S3b todavía.** Antes de seguir:

| Orden | Acción                                                                        | Por qué                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Decidir el alcance de H-F3-1**                                              | Es un CRÍTICO y cambia qué significa "S4b terminado". Si se acepta que S4b = matriz solamente, el issue #250 debe reabrirse o redactarse distinto |
| 2     | **Corregir el criterio de salida de T10** en el plan                          | Si no, el slice siguiente repite el patrón                                                                                                        |
| 3     | **Resolver el ítem 18** dentro de T8                                          | Es 1 h y desbloquea S3b. T8 no es segura sin él                                                                                                   |
| 4     | **Actualizar la tabla de slices del plan** (H-F3-3)                           | S4c y S4d son los que cierran H-F3-1; no están en el plan                                                                                         |
| 5     | Luego seguir con #252 (S3b) → #253 (S4c) → #254 (S4d) → #255 (S5) → #256 (S6) | El orden de los issues ya es correcto                                                                                                             |

T12 y T13 (S5, #255) siguen técnicamente desbloqueados, pero **no son
recomendables** hasta que H-F3-1 esté decidido: construir UI de onboarding sobre
una matriz que nadie impone es el patrón que el ítem 101 ya descrebe como
"un control que acompaña y no verifica".

---

## Limitaciones

- **Primera pasada.** El precedente de #197 y #207 sugiere que una segunda pasada
  con otro perfil encuentra errores nuevos.
- **No se auditó el frontend de S5** porque S5 no empezó.
- **No se ejecutó un smoke test manual contra Neon** más allá de los tests de
  integración que ya corren. Redis estuvo **degradado** en esta corrida (fail-open,
  esperado), así que los paths de Redis se ejercitaron **solo en su rama
  degradada**.
- **No se modificó código de producción**, por instrucción explícita. Los
  hallazgos se registran, no se arreglan.
