---
id: 296
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 15:07:38"
updated_at: "2026-10-14 15:07:38"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "12 discrepancias doc-vs-código verificadas + 35 tests tras skipIf"
---

# 12 discrepancias doc-vs-código verificadas + 35 tests tras skipIf

**What**: Mapeo doc-vs-código del 2026-10-14 sobre develop@ef401aa. 12 discrepancias verificadas leyendo ambos lados; 5 son de conteo/ruta yagging en docs.
**Why**: Reincorporación: detectar qué documentación quedó vieja frente al código real.
**Where**: README.md, SETUP.md, PROMPTS.md, TESTING.md, vault/03_Deuda/deuda-tecnica.md, docs/superpowers/specs/, docs/superpowers/plans/2026-10-09-fase3.md
**Learned**:
- README.md:234 dice ADR en `docs/adr/` (no existe) y "ADR-001 a ADR-022"; en realidad viven en `vault/01_ADRs/` y hay 28.
- README.md:515 dice 889 tests/78 archivos (correcto, coincide con la corrida); README.md:548 en el MISMO archivo sigue diciendo 769/73. Los changelog internos nunca se actualizan al append.
- README.md:26 marca Fase 2 como "Pendiente"; arquitectura.md:76 y bitacora:3620 la dan por cerrada el 2026-10-06.
- Faltan 11 rutas reales en la tabla de endpoints de README: `api/subscriptions/{preapproval,cancel,pause,resume,plan}`, `GET /api/subscriptions`, `api/config/tenant/branding`, `api/register-tenant`.
- Items 93 y 97 de deuda siguen marcados ABIERTO pero están resueltos (S1 y S4b). El spec de Fase 3 sigue diciendo "ninguno bloquea Fase 3" cuando los items 65 y 67 ya cerraron.
- 5 suites usan `describe.skipIf` con 35 tests total de integración Neon: register-tenant(11), subscription-transition(5), tenant-lifecycle(5), preapproval-tenant-resolution(6), rls-cross-tenant(8). Vitest no reporta `skipped` en el resumen → `pnpm test` puede dar verde sin ejecutarlos (item 98).

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
