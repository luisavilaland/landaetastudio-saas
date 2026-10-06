---
id: 179
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ef68d0836ffeXOwN7vKHESE3y3
created_at: "2026-10-06 19:29:47"
updated_at: "2026-10-06 19:29:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Cierre de Fase 2: decisiones D1-D7 y resultados del spike T0"
---

# Cierre de Fase 2: decisiones D1-D7 y resultados del spike T0

**What**: Cierre de Fase 2 (T0-T7) con las 7 decisiones arquitectónicas que definen la fase.

**Why**: Registrar las decisiones en un solo lugar recuperable. Cada una ya tiene su memoria y su PR; esta es la vista de conjunto para quien necesite "como quedo Fase 2" sin recorrer 8 PRs.

**Where**: `docs/superpowers/plans/2026-10-01-fase2.md`, PRs #184-#193 (T1-T5), #197 (auditoria), #198 (H2), #199 (H1), #200 (H3), #201 (T6), #202 (mini auditoria), T7 (este PR). ADRs 026 y 027.

**Learned**:
- **D1 (H1)**: `paused` es estado de primera clase. No se colapsa a `approved: false`. El item 38 quedo **superseded** por el 38-bis: decia "el webhook registra warn y no transiciona", y el spike T0 lo refuto porque `paused` es reversible en ambas direcciones. `PAUSABLE = ['active','past_due']`.
- **D2 (H1)**: el tenant se resuelve con `resolve_tenant_by_preapproval`, funcion `SECURITY DEFINER` acotada que corre como `neondb_owner` (BYPASSRLS) y expone solo el `tenantId`. ADR-026. NO se puede consultar `subscriptions` con `db` directo: `FORCE ROW LEVEL SECURITY` + policy contra `current_setting('app.tenant_id', true)::UUID`, que sin contexto nunca es TRUE.
- **D3 (H3)**: `planId` lo escribe `PUT /api/subscriptions/plan` tras confirmar con MP; el webhook solo verifica. ADR-027. Mapear `transaction_amount` a un plan no es inyectivo en el tiempo ni acotado a eventos de cambio.
- **D4**: CI en `ubuntu-latest`. El runner self-hosted (AlmaLinux) aceptaba jobs y moria durante typecheck. Ya no se usa.
- **D5**: la cobertura ahora es medible. `@vitest/coverage-v8` no estaba declarado en ningun `package.json` pese a que la config lo pedia desde el inicio (item 59, resuelto en #201).
- **D6**: un PR mergeado con worktree de Paseo deja **tres** registros, y cada uno se limpia con su propia API: worktree de git, rama local, workspace de Paseo. Verificar solo con git deja el workspace huerfano, porque Paseo sobrevive al worktree y lo degrada de `isolation: worktree` a `isolation: local`.
- **D7**: los mocks de logger van a `@repo/logger`, **no** a `@/lib/logger`. `apps/admin/lib/logger.ts` es un shim de re-export: son dos modulos distintos en el registro de vitest, asi que mockear el shim no afecta al import directo que hace la ruta. Ese error hizo que 9 tests de H3 pasaras sin testear, y la mini auditoria (#202) lo encontro **5 veces mas** en archivos de T1-T5.
- **Resultado del spike T0 (#188)**: confirmo que MP **si** entrega webhooks a produccion (la hipotesis de "no hay topics suscritos" quedo descartada, todos estaban marcados en el panel). **P6 quedo refutado**: `PUT /preapproval/{id}` con `status: cancelled` y con `auto_recurring.transaction_amount` **si** aplican despues del primer cobro (la hipotesis de "solo lectura" era falsa). T9 cancelado. Ademas: `notification_url` no se persiste por API, y un `2xx` de MP no es evidencia de que la operacion se haya aplicado (regla: verificar con `GET` posterior).

---
*Session*: [[session-ses_ef68d0836ffeXOwN7vKHESE3y3]]
