---
id: 23
type: discovery
project: landaetastudio-saas
scope: project
topic_key: testing/rls-cross-tenant-timeout
session_id: ses_f2ad95fc9ffe5rNVe5NjpkKMEB
created_at: "2026-09-26 12:41:51"
updated_at: "2026-09-26 12:41:51"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Diagnose flaky RLS test timeout"
---

# Diagnose flaky RLS test timeout

**What**: Diagnostiqué el timeout de `rls-cross-tenant.test.ts:330` ejecutando el test aislado tres veces; las 3 pasaron (8/8) en 17.5s, 16.9s y 23.8s de pared.
**Why**: Confirmar si el fallo previo era flaky antes de tocar test o config durante la migración de docs.
**Where**: `packages/db/src/__tests__/rls-cross-tenant.test.ts`, `vitest.config.ts`.
**Learned**: El caso 8 abre una conexión `postgres(appUrl)` y consulta `subscriptions` + `tenant_mp_config`; Vitest no define `testTimeout`, por lo que usa el default de 5000ms. No hay config de Vitest en packages/db. La migración no toca packages/db y 0/3 corridas fallaron; el fix más acotado sería timeout por test de 15000ms, no global.

---
*Session*: [[session-ses_f2ad95fc9ffe5rNVe5NjpkKMEB]]
*Topic*: [[topic-testing]]
