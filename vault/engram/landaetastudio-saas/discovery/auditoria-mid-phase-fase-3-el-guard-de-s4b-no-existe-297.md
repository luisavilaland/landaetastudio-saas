---
id: 297
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:15:43"
updated_at: "2026-10-14 15:15:43"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoria mid-phase Fase 3: el guard de S4b no existe"
---

# Auditoria mid-phase Fase 3: el guard de S4b no existe

**What**: Auditoria mid-phase de Fase 3 (S1-S4b) sobre develop@ef401aa. 9 hallazgos: 1 CRITICO, 2 ALTO, 4 MEDIO, 2 BAJO. Veredicto: Fase 3 no sigue a S3b hasta decidir el alcance de H-F3-1.
**Why**: Equivalente a la auditoria #197 de Fase 2, pero a mitad de fase y antes de S3b/S4c.
**Where**: vault/04_Fases/auditoria-fase3-midphase.md (nuevo), vault/03_Deuda/deuda-tecnica.md (items 103-106 nuevos, 93 y 97 cerrados), vault/02_Bitacora/bitacora.md (append). Rama audit/fase3-midphase. Read-only sobre apps/ y packages/.
**Learned**:
- **H-F3-1 (CRITICO)**: el guard de S4b no existe. canSell, canWrite y canAccessPanel tienen CERO consumidores en produccion; el unico que lee deriveTenantPermissions es `apps/admin/app/api/subscriptions/route.ts:102`, un GET que devuelve el permiso como dato. El issue #250 se cerro el 2026-10-14 declarando 3 puntos de aplicacion + tests de integracion para cada uno. Ninguno existe.
- **La causa raiz es el criterio de salida de T10** (`plans/2026-10-09-fase3.md:505`): decia "una tabla de tests que cubre las 8 combinaciones" y NUNCA "el guard se aplica". ~30 tests verdes sobre una funcion que nadie llama: el suite es correcto y el sistema no funciona.
- **H-F3-2 (ALTO)**: `encryption.ts:58` hace UPDATE sin upsert y falla EN SILENCIO (0 filas, sin error, retorno void). El item 18 lo describe como UPDATE-only pero no como fallo silencioso. Un tenant nuevo cree que guardo sus credenciales MP; el error aparece en el checkout.
- **H-F3-3 (ALTO)**: el plan define 6 slices; la realidad tiene 9. S3b existe solo como nota dentro de T8 (la tabla de slices nunca se actualizo) y S4c/S4d NO existen en plan ni specs, solo en la deuda y la bitacora. Los issues #252-#256 si existen.
- **Item 98 verificado con reporter JSON, no con el resumen**: passed=889 failed=0 skipped=0. Las 5 suites con describe.skipIf SI ejecutaron (39 tests contra Neon) porque DATABASE_APP_URL esta configurada aca. El riesgo sigue abierto para entornos sin esa variable.
- **El baseline del DoD sin --force fue 100% cache replay** (18 tasks, 0 trabajo real). Con --force: 18/18, 0 cacheadas, 80s.
- Patron: es el **item 61 aplicado a la autorizacion** — "un control que acompana y no verifica". El repo ya tenia el nombre para esto.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
