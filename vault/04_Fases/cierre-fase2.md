# Cierre — Fase 2: Webhook de suscripciones + checkout dinámico

**Fecha:** 2026-10-06
**Versión:** 1.0
**Estado:** Cerrada
**Plan:** `docs/superpowers/plans/2026-10-01-fase2.md`
**Spec:** `docs/superpowers/specs/2026-10-01-fase2-webhook-checkout.md`
**Design:** `docs/superpowers/specs/2026-10-01-fase2-design.md`
**Spike T0:** `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md`
**Base del cierre:** `develop` en `c2b477e`

## Resumen

Fase 2 implementó el webhook de suscripciones de MercadoPago y el checkout
dinámico. El plan estimaba 10 días hábiles; se ejecutó del 2026-10-02 (T0) al
2026-10-06 (T8), 4 días calendario, e incluyó además 3 fixes de auditoría
(H1-H3), 1 mini auditoría de calidad de tests y 2 mini-PRs documentales.

El cierre no es una re-verificación de T1-T7: es la consolidación del DoD, el
registro de lo que quedó abierto y la firma formal.

## Tasks completadas

| Task | Descripción                       | PR      | Estado                        |
| ---- | --------------------------------- | ------- | ----------------------------- |
| T0   | Spike: contrato MP                | #164    | ✅ H1 confirmada, P6 refutado |
| T1   | Migración: índice único parcial   | #165    | ✅                            |
| T2   | Setup: env vars + getAdminBaseUrl | #166    | ✅                            |
| T3   | Helpers de dominio                | #167    | ✅                            |
| T4   | Endpoints API                     | #168    | ✅ 5 endpoints                |
| T5   | Webhook de suscripciones          | #169    | ✅ Flujo A                    |
| T6   | Tests de integración              | #201    | ✅ suite a 705                |
| T7   | Docs + memoria                    | #203    | ✅                            |
| T8   | Cierre                            | este PR | ✅                            |
| T9   | Polling                           | —       | ❌ cancelado (H1 confirmada)  |

## Fixes de auditoría

La auditoría mid-phase (#197, `auditoria-fase2-midphase.md`) encontró tres
defectos funcionales confirmados que impedían cerrar la fase. Los tres están
resueltos y registrados como ADR.

| #   | Hallazgo                                             | Fix                                                                   | PR   | ADR     |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------- | ---- | ------- |
| H1  | La estrategia L nunca resolvía: RLS devuelve 0 filas | Función `SECURITY DEFINER` que resuelve el tenant por `preapprovalId` | #199 | ADR-026 |
| H2  | `pause` sin confirmación; `resume` inalcanzable      | `decideTarget` con target `paused`                                    | #198 | —       |
| H3  | `planId` nunca se escribía                           | El endpoint escribe tras confirmar con MP                             | #200 | ADR-027 |

H1 era bloqueante: sin resolverlo ningún test de integración real de la
resolución de tenant podía pasar, porque la ruta que T1 indexó nunca se
ejecutaba.

## Mini auditoría de T6

PR #202. **Veredicto: T6 pasa.** Mutation-lite 7/7 detectada.

| Hallazgo | Severidad | Detalle                                                                                                                     |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| H-T6-1   | ALTO      | El aislamiento cross-tenant es invisible a tests con mock: quitar el `tenantId` de un `WHERE` deja la suite verde. Item 61. |
| H-T6-2   | BAJO      | 5 mocks de logger apuntan a `@/lib/logger` en vez de `@repo/logger`                                                         |
| H-T6-3   | BAJO      | Un `it()` sin `expect()` y un `skipIf` sin documentar                                                                       |

**H-T6-1 es el único bloqueante declarado de Fase 3.** La mitigación es mover
el aislamiento a un invariante de tipos: que `applyTransition` reciba el `row`
ya filtrado y no construya el `WHERE`.

## Mini-PRs documentales

**PR #204 — drift de SETUP.md.** La sección de MP listaba 3 topics para
suscribir en el panel; el código clasifica 4. Al verificar contra
`packages/commerce/src/mp-webhook-events.ts` aparecieron **dos** errores, no
uno:

1. `subscription_preapproval_plan` faltaba por completo en la documentación.
2. `payment` estaba etiquetado `(legacy)` y no lo es: tiene handler propio
   (`handlePayment`) y es el único topic que necesita `live_mode` y `action`.

**PR #205 — precondiciones de T8.** La auditoría #197 §7 definía cuatro
precondiciones "Antes de T8". Este PR cumple #2 (blueprint v2.6 marcado **no
normativo**) y #3 (`arquitectura.md` indexa Fase 2, spec, design, plan,
auditorías y ADR-026/027). #1 la cumplieron los PRs #199 y #200; #4 la cumple
este documento.

## Infraestructura

- CI migrado de self-hosted a `ubuntu-latest` (PR #198).
- `@vitest/coverage-v8` instalado y declarado (PR #201, cierra item 59).
- ADR-026: resolución de tenant por `preapprovalId` sin contexto.
- ADR-027: `planId` se escribe en el endpoint, no en el webhook.

## Coverage — medido sobre `develop` en `c2b477e`

Cifras medidas con `pnpm exec vitest run --coverage` y leídas de
`coverage/coverage-final.json`. **No son estimaciones.**

| Archivo                                             | Coverage                      |
| --------------------------------------------------- | ----------------------------- |
| `commerce/src/mp-amounts.ts`                        | 100%                          |
| `commerce/src/mp-webhook-events.ts`                 | 100%                          |
| `admin/lib/subscriptions/mutate.ts`                 | 100%                          |
| `commerce/src/subscription-permissions.ts`          | 100%                          |
| `admin/app/api/subscriptions/cancel/route.ts`       | 100%                          |
| `admin/app/api/subscriptions/pause/route.ts`        | 100%                          |
| `admin/app/api/subscriptions/resume/route.ts`       | 100%                          |
| `admin/lib/subscriptions/handlers.ts`               | 96.9%                         |
| `commerce/src/webhook-signature.ts`                 | 95.9%                         |
| `admin/app/api/subscriptions/plan/route.ts`         | 94.7%                         |
| `commerce/src/subscription-proration.ts`            | 92.9%                         |
| `admin/app/api/subscriptions/preapproval/route.ts`  | 92.2%                         |
| `admin/app/api/subscriptions/route.ts`              | 90.9%                         |
| `commerce/src/mp-subscriptions.ts`                  | 81.4%                         |
| `admin/app/api/webhooks/.../subscriptions/route.ts` | 81.3%                         |
| `storefront/app/api/webhooks/mercadopago/route.ts`  | 68.9%                         |
| **Global**                                          | **78.12% stmts · 74.45% fns** |

**Dos advertencias honestas sobre estas cifras:**

- El webhook de suscripciones de plataforma (`admin/.../subscriptions/route.ts`)
  queda en **81.3%**, y `mp-subscriptions.ts` en **81.4%**. No alcanzan el 92-100%
  que sehebía supuesto para Fase 2.
- El archivo más bajo (68.9%) es el webhook de órdenes del **tenant** en
  storefront, que es Fase 1, no Fase 2. Se incluye para que la cifra global sea
  auditable.

## Contadores finales

| Métrica         | Valor                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Tests           | **705 / 705**, 69 archivos                                                        |
| Coverage global | 78.12% stmts · 74.45% fns                                                         |
| Migraciones     | 3 (`0000_baseline`, `0001_dapper_revanche`, `0002_resolve_tenant_by_preapproval`) |
| ADRs nuevos     | 2 (ADR-026, ADR-027)                                                              |
| DoD             | lint 6/6 · typecheck 9/9 · build 3/3 · format:check · migraciones OK              |

## Acción operacional pendiente (no código)

**El panel de MercadoPago tiene suscritos 3 de los 4 topics.** Falta
`subscription_preapproval_plan`, el topic que avisa cambios de _plan_. Sin él, los
eventos de cambio de plan no llegan por webhook.

Registrado en Engram obs 119 (2026-10-02): se suscribieron manualmente
`subscription_preapproval`, `subscription_authorized_payment` y `payment`. El
cuarto nunca entró. El PR #204 corrigió la documentación que reproducía ese
error, pero **el panel sigue con la suscripción incompleta**.

**Acción: suscribir `subscription_preapproval_plan` en el panel de MP.** Es lo
único de esta fase que no se resuelve desde el código.

## Nota sobre H2 del spike T0

En obs 119 se descartó la hipótesis H2 (_"faltan topics en el panel"_) porque
"se suscribieron todos". Si el cuarto topic nunca entró, H2 no estaba del todo
descartada.

No cambia la conclusión material: H1 (MP no entrega a previews de Vercel) sigue
siendo la causa raíz de P1 y el webhook funciona en producción. Pero la
conclusión histórica era parcialmente incorrecta, y queda registrada acá para
que nadie la lea como definitivo.

## Items de deuda abiertos

Items 35-38 (transversal, pre-Fase 2) + 56-61 (Fase 2):

| #   | Severidad | Descripción                                                 | Estado                          |
| --- | --------- | ----------------------------------------------------------- | ------------------------------- |
| 35  | ALTA      | Spec transversal usa nombres de evento inexistentes         | ABIERTO                         |
| 36  | MEDIA     | Spec transversal afirma que MP no soporta prorrateo (falso) | ABIERTO                         |
| 37  | ALTA      | Spec transversal define URL templated (imposible)           | ABIERTO                         |
| 38  | MEDIA     | Estado `paused` no modelado                                 | SUPERSEDED por H2               |
| 56  | MEDIA     | La función de H1 es superficie de seguridad permanente      | ABIERTO                         |
| 57  | MEDIA     | `planId` puede quedar desalineado si falla el GET de MP     | ABIERTO                         |
| 58  | BAJA      | `pnpm test --coverage` no mide nada                         | ABIERTO                         |
| 59  | —         | `@vitest/coverage-v8` nunca declarado                       | **RESUELTO (#201)**             |
| 60  | BAJA      | El reporter de texto oculta archivos por truncado           | ABIERTO                         |
| 61  | ALTO      | Aislamiento cross-tenant no verificable con mocks           | ABIERTO — **bloqueante Fase 3** |

Items 35, 37 y 61 son los de mayor severidad. Los tres comparten la misma
raíz: **documentación o tests que afirman algo que el código no puede
garantizar.** 35 y 37 nacieron del blueprint (hoy no normativo, PR #205); 61
nace del límite de los mocks.

## Qué queda para Fase 3

1. **Item 61 (ALTO, bloqueante).** Mover el aislamiento cross-tenant a un
   invariante de tipos antes de multiplicar endpoints con mocks.
2. **Acción operacional.** Suscribir el cuarto topic en el panel de MP.
3. No bloqueantes: items 35-37, 56-58, 60.

## Próximo paso

**Auditoría de Fase 2**, equivalente a `auditoria-fase1.md` (#140) para Fase 1.
Este documento es el cierre; no su validación. La auditoría debe tratar
específicamente el hallazgo H-T6-1, porque Fase 3 multiplica exactamente la
carencia que lo habilitó.
