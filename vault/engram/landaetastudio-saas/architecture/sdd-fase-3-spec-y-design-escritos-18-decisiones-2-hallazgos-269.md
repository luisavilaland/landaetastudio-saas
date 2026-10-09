---
id: 269
type: architecture
project: landaetastudio-saas
scope: project
topic_key: architecture/sdd-fase3-autoservicio
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 14:12:58"
updated_at: "2026-10-09 14:12:58"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "SDD Fase 3: spec y design escritos, 18 decisiones, 2 hallazgos de arquitectura"
---

# SDD Fase 3: spec y design escritos, 18 decisiones, 2 hallazgos de arquitectura

**What**: SDD de Fase 3 (autoservicio de tenants) - spec (QUÉ) y design (CÓMO) escritos. P1 y P2 resueltas por Luis. 18 decisiones (D1-D18). Commit `9a856c1` (anotaciones), `6185742` (item 90), spec+design. Issue #238.

**Why**: El item 61 desbloqueó Fase 3. El SDD arranca con baseline limpio en `develop` @ `f093d78`, 759 tests verdes.

**Where**: `docs/superpowers/specs/2026-10-09-fase3-autoservicio-tenants.md`, `docs/superpowers/specs/2026-10-09-fase3-design.md`, rama `docs/sdd-fase3`.

**Learned**:
- **P1 era una contradiccion real entre documentos, no una ambiguedad.** El plan de fase decia "el pago usa MP del tenant"; el spec transversal (L38, L117 + 5 transiciones) y el codigo de Fase 2 decian plataforma con `MP_PLATFORM_*`. Luis lo resolvio: la plataforma cobra la suscripcion, el MP del tenant es para cobrar a SUS compradores. **No habia chicken-and-egg** porque son dos cuentas distintas - el confounding era el nombre "MP" para dos cosas.
- **El proxy de storefront tiene dos restricciones que la migracion de status tiene que absorber:** (a) `proxy.ts:95-98` devuelve 404 si no resuelve tenant, asi que la landing SaaS necesita `PLATFORM_HOST` antes de los tres fallbacks; (b) **`proxy.ts:60` busca por slug SIN filtro de status** - sin agregar `status = 'active'` al lookup, el `pgEnum` es cosmetico: un tenant `pending` tendria su tienda publica. **El enum no hace nada hasta que el proxy lo consulta.**
- **La ausencia de RLS invierte el criterio de testing.** Con `subscriptions` (con RLS) un `WHERE` mal escrito queda enmascarado por la policy y hacen falta 2 capas. Con `tenants` (sin RLS) **no hay nada que lo enmascare**: un filtro mal escrito cambia la fila ajena y el test lo ve en 1 sola capa. El enmascaramiento venia de haber una capa de proteccion, no de la falta de ella.
- **Decision de no-diseño importante: NO una abstraccion generica tipo `updateWhere(table, tenantId, values)`.** Seria el "cajon de sastre" desde el dia 1, y reintroduce justo el problema del item 61: volveria imposible leer la firma y saber si el `WHERE` incluye `status`. Criterio: si aparece una tercera transicion, se escribe una tercera funcion hoja. **Tres funciones que dicen que hacen > una que puede hacer todo.**
- **`/api/register` YA existe pero es de comprador** (`dbCustomers`), no de tenant. El alta de tenant es genuinamente nueva. El nombre lo hace parecer mas cerca de lo que esta.
- **El proxy tiene 3 fallbacks que siempre resuelven en local** (`localhost -> tienda1`, `DEFAULT_TENANT_SLUG`), asi que un host de plataforma no se puede probar localmente sin tocarlos primero.
- **Varios "respuestas" del SDD dependen de defaults del repo que hay que conocer antes de escribir el plan:** los 45 call sites de `withTenantContext` en produccion (23 admin, 16 storefront, 6 commerce), mas que los "30" que decia el diseno del item 61.
- El item 65 (el 409 sin `initPoint`) tiene un test que **consagra la forma equivocada**: arreglarlo es cambiar un test verde. Es el trabajo que se pospone y despues cuesta, y por eso la auditoria lo pidio antes de que exista la UI.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-architecture]]
