---
id: 310
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 19:29:20"
updated_at: "2026-10-14 19:29:20"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoría S4c: property 16/16 pero cobertura 7/16"
---

# Auditoría S4c: property 16/16 pero cobertura 7/16

**What**: Auditoría S4c completa (issue #261, ref PR #260). 2 subagentes en paralelo sobre worktree de Paseo. Property verificada en 16/16, 5 items nuevos (117-121), conteo 17→16 corregido.

**Why**: Verificar que el cierre del item 103 (guard aplicado) se hizo bien, no solo que se hizo.

**Where**: vault/04_Fases/auditoria-s4c.md (nuevo); vault/03_Deuda/deuda-tecnica.md (items 117-121 + corrección item 103); vault/02_Bitacora/bitacora.md. Rama audit/s4c.

**Learned**:
- **La property se sostiene en 16/16, pero la cobertura solo llega a 7/16.** Al borrar el guard: 7 tests fallan (correcto), 6 pasan EN SILENCIO ABSOLUTO, 3 fallan con un 500 por acoplamiento de `callCount` (el guard consume la transacción #1 de la cola del mock). Eso último NO es cobertura. **Item 103 ("el guard se aplica") y item 117 ("el guard se aplica y alguien lo verifica") no son lo mismo.**
- **`derivePermissions('constructor')` devuelve una Function en vez de tirar.** Lookup por indexación de objeto plano, sin `Object.hasOwn`. También `toString` y `__proto__`. Sin escalación (Function.canWrite es undefined → guard cae a 403), pero el contrato "estado desconocido = fallar ruidosamente" está violado, y `subscriptions.status` es `text` SIN CHECK constraint → ese mapa TS es el único validador. Los tests solo cubrían estados ordinarios (`mystery_status`), que sí tiran.
- **`shipping/[id].test.ts` es un TOY**: define handlers locales y nunca importa el route real. Da cobertura falsa. Y su `route.test.ts` promete en el header "si borra el guard el test falla" pero tiene CERO asserts de 403.
- **`orders/[id]` con `canSell` es la decisión más defendible del slice**: `past_due` tiene canSell:true/canWrite:false → el vendedor puede enviar el pedido en gracia pero no crear productos. Castigar al vendedor no evita que el comprador espere.
- **`config/tenant/domain` (PUT) sin guard NO estaba en la lista explícita** que yo enumeré. No es defecto funcional, pero una lista de decisiones que omite un caso no es auditable.
- **El flake de Redis NO existe**: 2/2 suite completas pasaron; el test es hermético (mockea ioredis). Los warnings `Redis unavailable` los emite el código de producción ejercitado por OTROS tests (rate limit de checkout), no el de redis. No amerita ítem.
- **TRAMPA METODOLÓGICA (me costó un round)**: mi primer script de corrección del conteo imprimió "0 ocurrencias de '17 guards'" y lo leí como éxito. NO lo era: la deuda decía "17 **handlers** de 13 endpoints", el patrón no matcheaba, y no se había cambiado NADA. **Un grep que devuelve 0 puede significar que buscaste mal, no que esté limpio.** Rehice con el texto real y aserciones que fallan si no encuentran.
- **Los subagentes arrancaron en `gentle-orchestrator`, no en `build`**: `paseo_create_agent` descartó el bloque `settings` (y rechaza `background`). Un auditor en modo orquestador habría intentado delegar en vez de auditar. Hay que setear el modo explítaxamente después de crear.
- Engram: obs #309 (hallazgos de @QA).

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
