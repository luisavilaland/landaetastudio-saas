---
id: 158
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef62da1e9ffex72NXjeEAou0Hp
created_at: "2026-10-05 02:38:47"
updated_at: "2026-10-05 02:38:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Auditoria mid-phase T1-T5: 3 hallazgos bloqueantes (RLS estrategia L, paused, planId)"
---

# Auditoria mid-phase T1-T5: 3 hallazgos bloqueantes (RLS estrategia L, paused, planId)

**What**: Auditoria READ-ONLY mid-phase T1-T5 completada: 8 hallazgos, 3 bloqueantes para T6 — (1) CRITICO: estrategia L del handler muerta por RLS (query con `db` plano sin set_tenant_id en route.ts:398-409 devuelve 0 filas siempre; T1 anulado, fallback remoto obligatorio); (2) ALTO: `POST /pause` devuelve 202 pero el handler nunca transiciona a `paused` (decideTarget route.ts:548-565 no tiene target paused; REVIVABLE L56), `resume` inalcanzable -> siempre 409; (3) ALTO: `PUT /plan` 202 nunca escribe `planId` (handler sin refs a planId/priceUyu) -> divergencia permanente + falso 409 "Ya tenes ese plan" (plan/route.ts:136). Ademas MEDIO: guard live_mode ausente (liveMode param muerto), codificación dual permisos sin test de enlace; BAJO: comentarios "6 estados" obsoletos, AGENTS.md:633 contradice :652 (item 50 incompleto), item 52 mitigación no aplicada al item 40.

**Why**: Mandato de auditoria mid-phase de Fase 2 antes de T6-T8; los 3 bloqueantes hacen que tests de integracion de T6 fallen o que flujos ya mergeados (pause/resume/plan) no funcionen en produccion.

**Where**: apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts (398-409, 548-565, 168), apps/admin/app/api/subscriptions/{pause,resume,plan}/route.ts, vault/03_Deuda/deuda-tecnica.md (items 48-53 verificados), AGENTS.md:633

**Learned**: (a) handler.test.ts:164-176 mockea db.select y hace pasar el test de estrategia L aunque con DB real devuelva 0 filas (test tautologico); (b) deuda item 49 afirma "la transicion la dispara POST /pause" — falso en codigo; (c) issue #168 nota de cierre repite "el webhook confirma" — tambien falso para paused y planId; (d) rls-cross-tenant.test.ts usa describe.skipIf(!DATABASE_APP_URL) — salta silencioso sin .env.local; (e) los 3 control-chars del item 52 ya no estan en los archivos (scan codepoints = 0) pero el scan del item 40 sigue sin rama de control chars.

---
*Session*: [[session-ses_ef62da1e9ffex72NXjeEAou0Hp]]
