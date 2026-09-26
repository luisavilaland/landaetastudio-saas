# Auditoría de cierre de Fase 1 — Modelo de datos

**Proyecto:** SaaS eCommerce multi-tenant  
**Blueprint:** v2.6  
**Fecha:** 2026-09-24  
**Rama:** `chore/audit-fase1`  
**Alcance:** T1–T14, ADRs, schema, migraciones 0012–0014, RLS, seed, documentación, tests y deuda acumulada.  
**Modalidad:** Auditoría read-only. No se modificó código de producción.

## Resumen ejecutivo

La implementación central de Fase 1 está presente y es coherente en lo esencial: existen `plans`, `subscriptions` y `tenant_mp_config`; los tres tiers usan precios en centavos; las migraciones 0012, 0013 y 0014 forman el orden esperado; y el seed crea las suscripciones iniciales esperadas.

Sin embargo, el cierre documental y el DoD de la fase no están completos:

- **T11** sigue abierto: no existe el test dedicado de RLS cross-tenant.
- **T12** está parcialmente cubierto por mocks, sin roundtrip real contra la DB.
- **T13** está abierto: las tres variables de cifrado/plataforma no están en `.env.local.example` ni en Zod.
- **T14** está parcialmente cubierto: la bitácora tiene entradas T1, T6 y T8–T10, pero no una entrada consolidada con el DoD solicitado.
- El helper `encryptToken` solo ejecuta `UPDATE`; no hay una ruta de `INSERT` para crear la primera configuración MP.
- El estado de Fase 1 está internamente contradictorio: el README y la sección principal del Blueprint la marcan completada, pero la tabla de Roadmap del Blueprint todavía dice `ARRANCAR` y el Blueprint enumera cinco estados mientras la spec transversal define seis.

### Bloqueantes antes de Fase 2

1. **T13 / configuración de credenciales:** `MP_TOKEN_ENCRYPTION_KEY`, `MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` no están declaradas en el template ni validadas por Zod.
2. **Estado de fase:** reabrir o condicionar formalmente el cierre de Fase 1 hasta cerrar T11 y T13.
3. **T11:** agregar una prueba real de aislamiento; el test actual de `encryption.test.ts` es mock-tautológico.

`encryptToken` UPDATE-only no bloquea directamente el webhook de Fase 2 si las filas MP ya existen, pero sí debe resolverse antes del autoservicio de Fase 3.

## 1. Consistencia inter-tarea T1–T10

### Schema final

**Conforme:** `packages/db/src/schema.ts:38-123`.

- `dbPlans` contiene los límites y `features` del catálogo.
- `dbSubscriptions` contiene `tenantId`, `planId`, `status`, `currentPeriodEnd`, `mpPreapprovalId`, `expiredAt`, `abandonedAt` y `lastProcessedPaymentId`.
- `dbTenantMpConfig` contiene `accessTokenEnc` y `webhookSecretEnc` como `bytea`, con `publicKey` e `isVerified` adicionales.
- Los nombres de columnas son camelCase y las FKs tienen la política de borrado esperada.

### Helper de cifrado

**Parcialmente alineado con el plan:** `packages/commerce/src/encryption.ts:21-60` y `:68-108`.

- `pgp_sym_encrypt` y `pgp_sym_decrypt` reciben la clave como bind parameter.
- No se usa `SET LOCAL` ni `set_config` para la clave.
- El helper documenta que el caller debe leer `MP_TOKEN_ENCRYPTION_KEY` y fallar temprano (`encryption.ts:21-23`).
- Esto difiere del plan, que describía la lectura de la clave desde el entorno por el helper (`docs/superpowers/plans/2026-09-fase1-modelo-datos.md`, T6/DoD).
- `encryptToken` ejecuta únicamente `UPDATE` sobre `tenant_mp_config` (`encryption.ts:42-60`). No se encontró una ruta de `INSERT` para crear la primera fila; un `UPDATE` sin fila affected no falla.

### Seed

**Conforme funcionalmente, con riesgos registrados:** `packages/db/seed.ts`.

- Los planes usan 200000, 400000 y 800000 centavos.
- `tienda1` recibe Starter y `tienda2` Business, ambas `active`.
- `currentPeriodEnd` se calcula aproximadamente un mes en el futuro.
- El seed sigue siendo destructivo; esto ya está registrado como ítem 16 de deuda técnica.

## 2. Migraciones 0012–0014 y RLS

### Narrativa y orden

**Conforme en el código:** `packages/db/migrations/0012_tearful_supreme_intelligence.sql`, `0013_ensure_rls_and_grants.sql` y `0014_enable_rls_new_tables.sql`.

1. 0012 crea el modelo de datos.
2. 0013 agrega grants y reinforces RLS de las ocho tablas preexistentes.
3. 0014 agrega `ENABLE` + `FORCE` RLS y `tenant_isolation` a `subscriptions` y `tenant_mp_config`.

El journal contiene los índices 12, 13 y 14 de forma secuencial. La auditoría no revalidó la DB real en este worktree porque no tenía `.env.local`; por tanto, el estado runtime de `relforcerowsecurity` y el tracking de `drizzle.__drizzle_migrations` queda como verificación pendiente de esta sesión.

### Seguridad

- `plans` permanece sin RLS por diseño: es catálogo global.
- `subscriptions` y `tenant_mp_config` tienen RLS y policy `tenant_isolation` según la migración 0014.
- `app_user` tiene grants en las tres tablas nuevas (`0013_ensure_rls_and_grants.sql:1-4`).
- Riesgo: `app_user` también recibe `INSERT`, `UPDATE` y `DELETE` sobre `plans`, que no tiene RLS. El rol runtime podría modificar el catálogo global si existe un bug de aplicación. Debe confirmarse si el grant DML es intencional o reducirse a `SELECT` para runtime.
- El orden de migraciones y la política fail-closed con `current_setting(..., true)` son coherentes con el patrón existente.

## 3. ADR-023, ADR-024 y ADR-025

### ADR-024 —pgcrypto

**Conforme.** La implementación usa `BYTEA`, columnas `*Enc` y bind params. Los tests de cifrado y descifrado existen en `packages/commerce/src/__tests__/encryption.test.ts`.

Observación menor ya registrada como ítem 12: `TENANT_NOT_FOUND` está exportado pero no se lanza; `decryptToken` retorna `null` cuando no encuentra fila.

### ADR-023 — dos flujos MP

**Pendiente para Fase 2, no para el schema de Fase 1.**

- El webhook de suscripciones `/api/webhooks/mercadopago/subscriptions/:tenantId` aún no existe.
- El webhook de órdenes existente todavía no consume `tenant_mp_config.access_token` por tenant.
- `external_reference` compuesto para el flujo de suscripciones queda para Fase 2.

La ausencia de este route es una dependencia esperada de Fase 2, pero la configuración de `MP_PLATFORM_*` debe resolverse antes de arrancarla.

### ADR-025 — plantillas/composiciones

**Fuera de alcance de Fase 1;future dependency crítica.**

No existen `apps/storefront/templates/`, `lib/templates.ts`, mapa de plantillas ni selector/API. ADR-025 describe alcance para Fase 7, por lo que no bloquea el cierre de Fase 1, pero debe permanecer explícitamente fuera de los DoD de Fase 1.

## 4. Blueprint v2.6 y spec transversal

| Requisito                               | Estado | Evidencia                                                                |
| --------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Tres tablas                             | ✅     | `packages/db/src/schema.ts:38-123`                                       |
| RLS en subscriptions y tenant_mp_config | ✅     | `0014_enable_rls_new_tables.sql`                                         |
| Precios en centavos                     | ✅     | `packages/db/seed.ts`                                                    |
| Seed de planes y suscripciones          | ✅     | `packages/db/seed.ts`                                                    |
| `abandoned` en estados                  | ⚠️     | Spec sí; Blueprint enumera cinco                                         |
| Variables MP en template/Zod            | ❌     | `.env.local.example` y `packages/validation/src/env.ts` no las contienen |
| Cifrado como Blueprint/ADR              | ⚠️     | Bind params conformes; lectura de env y upsert no conformes al plan      |
| Estado de Fase 1 documentado            | ⚠️     | Sección principal completada, tabla Roadmap aún `ARRANCAR`               |

La spec transversal define seis estados, incluyendo `abandoned`, y columnas `expiredAt`, `abandonedAt` y `lastProcessedPaymentId` (`docs/superpowers/specs/2026-09-subscription-lifecycle.md:11-22`). El schema las contiene. El drift de naming snake_case de la sección 4 de la spec ya está registrado como ítem 9.

## 5. Tests y cobertura

| Área                  | Estado     | Evidencia                                                                  |
| --------------------- | ---------- | -------------------------------------------------------------------------- |
| Helper de cifrado     | ⚠️ Parcial | `encryption.test.ts:209-320` cubre roundtrip mock, empty key y bind params |
| RLS cross-tenant real | ❌ Ausente | No existe `packages/db/src/__tests__/rls-cross-tenant.test.ts`             |
| Seed/planes           | ❌ Ausente | No hay `*seed*.test.ts` ni test de datos de planes                         |
| Tests E2E existentes  | ✅         | Hay specs cross-tenant para APIs, pero no reemplazan el test RLS de Fase 1 |

El test de aislamiento en `encryption.test.ts:188-206` compara dos respuestas de mocks y no prueba una política RLS ni una transacción real.

## 6. Deuda técnica acumulada

### Estado de ítems existentes

- **Ítem 6:** el journal actual muestra idx 10, 12, 13 y 14; la parte de journal está resuelta. Persisten snapshots históricos ausentes y el archivo huérfano `0005_add_admin_users.sql`; actualizar el ítem para dejar explícito ese residual.
- **Ítem 7:** resuelto; grants de las tablas nuevas agregados.
- **Ítem 8:** abierto; FKs `RESTRICT` pendientes antes de purga.
- **Ítem 9:** abierto; snake_case de la spec vs camelCase.
- **Ítem 12:** abierto; `TENANT_NOT_FOUND` muerto.
- **Ítem 13:** abierto; duplicación de cifrado.
- **Ítem 14:** abierto/no reverificado en esta auditoría; tracking real de DB no consultado.
- **Ítem 15:** abierto; snapshots no reflejan `isRLSEnabled`.
- **Ítem 16:** ya registrado; seed destructivo con guard por `NODE_ENV`.
- **Ítem 17:** ya registrado; `features` JSONB hardcodeado.

### Hallazgos nuevos a registrar

1. Variables MP/cifrado ausentes de template y Zod (T13).
2. Test RLS cross-tenant real ausente (T11).
3. `encryptToken` no realiza upsert.
4. El contrato del helper no lee `process.env`, en conflicto con el plan y asociado a T13.
5. Blueprint dice cinco estados y su Roadmap conserva `ARRANCAR` para Fase 1.
6. Grants DML sobre catálogo global `plans` sin RLS.
7. No existe test de seed/plans.
8. Bitácora con fragmento NUL/UTF-16 embebido alrededor del byte 128806, entrada T7.
9. Columnas `publicKey` e `isVerified` fuera de la definición mínima de T4/ADR-024.

## 7. Estado de issues T11–T14

| Issue    | GitHub | Estado real                                                           | Recomendación                                         |
| -------- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------- |
| #111 T11 | OPEN   | Test RLS real ausente                                                 | Mantener abierto; es bloqueante del DoD de Fase 1.    |
| #112 T12 | OPEN   | Tests unitarios mock cubren bind params/empty key; falta DB roundtrip | Mantener abierto o ajustar DoD a cobertura mock-only. |
| #113 T13 | OPEN   | Template y Zod no contienen las tres variables                        | Mantener abierto; bloqueante antes de Fase 2.         |
| #114 T14 | OPEN   | Bitácora parcial; README/AGENTS tienen cambios aislados               | Mantener abierto hasta completar entrada consolidada. |

## 8. Recomendaciones priorizadas

### Antes de iniciar Fase 2

1. Resolver T13: agregar `MP_TOKEN_ENCRYPTION_KEY` required y `MP_PLATFORM_*` opcionales a `.env.local.example` y Zod; documentar Vercel.
2. Resolver T11 con un test que use `withTenantContext` y Neon para demostrar que tenant B no lee ni modifica filas de tenant A.
3. Cambiar el estado documental de Fase 1 a “completada con pendientes” o reabrir formalmente hasta cerrar T11/T13.
4. Confirmar en Vercel la presencia de las tres variables sin imprimir valores.
5. Verificar en DB real el tracking de migraciones y `relforcerowsecurity` (`ítem 14`).

### Antes de Fase 3

1. Convertir `encryptToken` en upsert o agregar una ruta de creación explícita de `tenant_mp_config` y tests.
2. Confirmar si los grants DML de `plans` para `app_user` son necesarios; reducir privilegios si no.
3. Normalizar la sección 4 de la spec a camelCase.
4. Agregar test del seed o un módulo de datos de planes testeable.
5. Reparar la bitácora como append-only UTF-8 sin borrar historial.

### Futuro, no bloquea Fase 1

- ADR-025 y las seis plantillas son alcance de Fase 7.
- Webhook de suscripciones y checkout dinámico son Fase 2.

## Limitaciones de la auditoría

- Los subagentes trabajaron sin `.env.local` en el worktree de auditoría; no se hicieron consultas nuevas a Neon.
- La evidencia runtime de RLS y el tracking de `drizzle.__drizzle_migrations` proviene de verificaciones previas y debe repetirse al cerrar los issues.
- La documentación de GitHub issues fue verificada directamente para #111–#114.

## Conclusión

**Fase 1 no debe considerarse cerrada sin resolver los bloqueantes de Fase 2.** El modelo de datos y el seed están implementados, pero T11 y T13 son pendientes de alto impacto, y el estado documental debe corregirse antes de iniciar el webhook de suscripciones. No se recomienda arrancar Fase 2 hasta cerrar o aceptar explícitamente esos bloqueantes.
