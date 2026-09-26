## Descripción

**Qué cambia y por qué:**
<!-- Descripción clara y concisa de los cambios -->

**Fase del blueprint (si aplica):**
<!-- Ej: Fase 1 — Modelo de datos, Fase 2 — Webhook suscripciones, etc. -->

**Issue relacionado:**
Closes #<!-- número del issue -->

**Spec/Plan referenciado:**
<!-- Enlace al spec o plan en docs/superpowers/specs/ o docs/superpowers/plans/ -->

**ADRs referenciados:**
<!-- Ej: ADR-023, ADR-024, ADR-025 -->

---

## Tipo de cambio

- [ ] feat — Nueva funcionalidad
- [ ] fix — Corrección de bug
- [ ] docs — Solo documentación
- [ ] chore — Tareas de mantenimiento (deps, configs, etc.)
- [ ] refactor — Refactorización sin cambio de comportamiento
- [ ] test — Agregar o corregir tests

---

## Checklist del autor

- [ ] Tests pasan localmente (`pnpm test`)
- [ ] Lint y typecheck pasan (`pnpm lint && pnpm typecheck`)
- [ ] Build pasa (`pnpm build`)
- [ ] Tests agregados para nueva funcionalidad (unitarios + E2E si aplica)
- [ ] Documentación actualizada (README, AGENTS, spec, bitácora)
- [ ] Env vars nuevas en `.env.local.example` y `turbo.json`
- [ ] Migraciones: respetar guard de CI (`pnpm db:generate` sin modificar existentes)

---

## Checklist del revisor

- [ ] Respeta AGENTS.md (tenantId en queries, precios en centavos, Zod, logger `@repo/logger`)
- [ ] Tests cubren lógica nueva y fallan si se revierte el código
- [ ] No hay código duplicado, imports sin usar, `any`, ni `console.log` fuera del logger
- [ ] Cambios coinciden con el spec/plan referenciado
- [ ] Hay algún ADR que debería crearse o actualizarse
- [ ] Documentación del blueprint sigue siendo válida (no hay drift)
- [ ] Deuda técnica nueva registrada en `vault/03_Deuda/deuda-tecnica.md`

---

## Notas adicionales

<!-- Screenshots, decisiones de diseño, dudas abiertas, contexto extra -->
