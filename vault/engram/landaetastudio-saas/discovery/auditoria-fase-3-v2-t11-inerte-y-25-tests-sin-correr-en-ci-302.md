---
id: 302
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:51:12"
updated_at: "2026-10-14 15:51:12"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoria Fase 3 v2: T11 inerte y 25 tests sin correr en CI"
---

# Auditoria Fase 3 v2: T11 inerte y 25 tests sin correr en CI

**What**: Segunda pasada de la auditoria mid-phase de Fase 3 (worktree Paseo wks_cdc020039c635b06, rama audit/fase3-midphase-v2). 2 subagentes en paralelo: @QA (mimo-v2.6-flash) y @Orquestador (nemotron-3-ultra). Resultado: 9 claims confirmadas en sustancia, 5 errores en #257, 7 hallazgos nuevos.
**Why**: Precedente de #197, cuya segunda pasada hallo 4 errores en la primera. Segunda pasada "warm": los subagentes leyeron el consolidado de #257 antes de verificar.
**Where**: vault/04_Fases/auditoria-fase3-midphase-v2.md (nuevo), vault/03_Deuda/deuda-tecnica.md (items 107-113 nuevos; 98 y 100 corregidos), vault/02_Bitacora/bitacora.md (append).
**Learned**:
- **La primera pasada no tuvo hallazgos falsos**: sus 9 se sostienen. Los 5 errores son de mecanismo, no de direccion.
- **E1 (importante)**: el item 100 era FALSO como regla general. Solo apps/admin excluye sus tests del programa tsconfig; storefront (16), superadmin (4) y packages si los incluyen. Consecuencia real peor: `next build` usa el MISMO tsconfig, asi que los **28 test files de apps/admin no los typechequea NINGUN comando del DoD**. Vitest transpila sin typecheckear. No es "falta typecheck", es "falta todo". Item 109.
- **E2**: el mecanismo del item 98 estaba mal. No es "falta DATABASE_APP_URL -> skip silencioso": 2 de 5 archivos guardan con DATABASE_URL, y faltando solo la de app esos 20 tests darian ROJO (el `beforeAll` revienta con el throw de db/index.ts:6-11). El skip silencioso real es en CI.
- **Item 107 (ALTO, NUEVO)**: **T11 branding esta INERTE**. Escribe `dbTenants.logoUrl` y NADIE lo lee; el storefront lee `settings.logoUrl` (jsonb viejo). Dos fuentes de verdad y la visible es la anterior: el logo que sube el tenant nunca aparece en la tienda. Es la CUARTA ocurrencia de "construido pero no aplicado" (tras items 61, 94, 103).
- **Item 108 (ALTO, NUEVO)**: **25 tests de DB no corren en NINGUN workflow**. e2e.yml corre solo 2 archivos contra Neon; ci.yml:48-49 escribe URLs dummy y el job build los saltea siempre. El comentario de e2e.yml:129-130 ya lo advertia y no se aplico. El endpoint publico de alta de tenant tiene cobertura efectiva CERO en CI.
- **Correccion al diagnostico v1**: T10 no es el unico criterio de salida debil. Lo son tambien T8, T12 y T14. T8 es el mas agudo: "sin fila de MP el checkout rechaza" SE CUMPLE con el defecto (el checkout rechaza porque la fila nunca se creo). Pero los otros 7 si exigen efecto observable y T5 exige verificacion en rojo. Formulacion correcta: **los 4 criterios debiles son exactamente las tasks donde vive el enforcement**.
- **Item 104 es LATENTE, no activo**: `encryptToken` no tiene llamadores productivo (solo tests y re-export). Y `EncryptionError('TENANT_NOT_FOUND')` esta declarado y muerto.
- Ningun subagente reporto mojibake: el item 106 empieza a dar resultado.
- El reporte de reincorporacion de esta sesion afirmo lo del typecheck sin verificar. Era el mismo error que E1.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
