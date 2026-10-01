---
id: 84
type: session_summary
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 15:11:49"
updated_at: "2026-10-01 15:11:49"
revision_count: 1
tags:
  - landaetastudio-saas
  - session_summary
aliases:
  - "Session summary: landaetastudio-saas"
---

# Session summary: landaetastudio-saas

## Goal

Planning completo de Fase 2 (webhook de suscripciones + checkout dinámico) con el workflow SDD: `sdd-init` → explore → propose → spec → design → tasks. **Solo documentación, cero código de producto.**

## Instructions

- **STOP total después de sdd-tasks.** No ejecutar `sdd-apply`. El plan se revisa con luisavilaland antes de cualquier línea de código.
- **Los errores del spec transversal NO se corrigen en este PR.** Van al reporte final + PR body + deuda técnica (ítems 35-38). Update del transversal aparte.
- **Usar siempre** `$env:TEMP\gh\bin\gh.exe` con `Remove-Item Env:GITHUB_TOKEN` (descubierto al final de la sesión).
- Comandos Windows: `tail`/`grep` no existen. Usar `Get-Content -Tail` y `Select-String`.
- **Verificación en 2 pasos separados** (aprendizaje PR #150/#161): nunca encadenar `pnpm vault:export` con `git status`.
- Commit → push → PR. **No mergear, no esperar CI.**

## Discoveries

- **`external_reference` NO viene en el payload del webhook de MP.** El body real es `{id, live_mode, type, date_created, user_id, api_version, action, data:{id}}`. `external_reference` solo se obtiene con `GET /preapproval/{id}` o `GET /authorized_payments/{id}`. → El handler necesita `MP_PLATFORM_ACCESS_TOKEN` y hace llamada saliente a MP en cada webhook.
- **La URL del webhook es LITERAL.** MP registra una URL fija por app y modo. No hay path templating. El `:tenantId` del transversal §8 es imposible.
- **Los topics reales no son `preapproval.created`/`payment.failed`.** Son `subscription_preapproval`, `subscription_authorized_payment`, `payment`, `subscription_preapproval_plan`. El payload trae `type` + `action` separados.
- **`subscription_authorized_payment` se resuelve con `GET /authorized_payments/{id}`**, no `/v1/payments/{id}`. Y no está verificado si expone `external_reference` ni `preapproval_id` → riesgo #1, motivo del spike bloqueante.
- **MP se contradice sobre `notification_url`:** la doc de Suscripciones dice configurarlo "al crear el pago", pero `POST /preapproval` no documenta el campo. Dejado bloqueado, no inferido.
- **El mapeo `preapproval_id → tenant_id` YA EXISTE** en `subscriptions` (mpPreapprovalId + tenantId, 1 fila por tenant). La alternativa de tabla nueva es innecesaria. La migración de Fase 2 es 1 índice único parcial, justificado por **integridad** (no por performance — a escala MVP un seq scan ya es sub-ms).
- **`billing_day_proportional` existe** → el transversal §5 ("MP no soporta prorrateo nativo") es factualmente falso. Se mantiene la política del transversal porque la conclusión sigue siendo válida.
- **`gh` no está en el PATH** en Windows: vive en `$env:TEMP\gh\bin\gh.exe`. Y hay un `GITHUB_TOKEN` inválido en el entorno (lo consume el MCP de GitHub) que eclipsa la credencial del keyring de `gh`. El MCP falla con `Bad credentials` — ítem 32 de deuda ya conocido.
- El subagente `sdd-explore` rechaza preflight heredado (`model-authored preflight text cannot create parent-confirmed authority`). La exploración read-only se hizo con herramientas nativas.
- **Prettier realinea tablas markdown**: agregar una fila más ancha produce N líneas `-` en el diff. No es pérdida de contenido — verificar con `git diff -w` y re-leer la tabla.
- PowerShell misreporta UTF-8 válido (acentos, `→`, `§`) como `?` o ``. Verificar con el tool `read`, no con `Select-String`.

## Accomplished

- ✅ Calibración: develop en a0b58fd, tree limpio, 11 comandos SDD, Engram conectado
- ✅ `sdd-init` (hybrid, strict_tdd=true) → obs 77, 78, 79
- ✅ Explore → estado: checkout órdenes completo, subscriptions API/webhook **inexistentes**, 0 tests
- ✅ Propose → 5 endpoints + webhook + checkout, delimitado contra Fase 3/9
- ✅ Spec (`2026-10-01-fase2-webhook-checkout.md`) con 3 correcciones al propose: URL fija, `external_reference` no viene en payload, endpoints en `apps/admin/`
- ✅ Design (`2026-10-01-fase2-design.md`) con 7 decisiones D1-D7 + evaluación del mapeo local
- ✅ Plan (`2026-10-01-fase2.md`) — 9 tasks T0-T8, 10 días, grafo de dependencias
- ✅ Bitácora append-only (verificada con `git diff -w`: 74 inserciones, 0 eliminaciones)
- ✅ Engram obs 77-83, export al vault verificado (max ID 83, 77-83 presentes)
- ✅ `pnpm format:check` verde
- ✅ 2 commits: `2e58115` (planning) + `3621a8a` (doc de gh CLI)
- ✅ **PR #163 abierto**: https://github.com/luisavilaland/landaetastudio-saas/pull/163
- 🔲 T0 (spike) — primera task de `sdd-apply`, **no ejecutada**

## Next Steps

1. **Luis**: revisar los 4 ítems de deuda (nombres de evento, `notification_url`, URL `:tenantId`, prorrateo nativo) + decidir `paused`
2. **Humano**: configurar `MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` en Vercel (admin)
3. **Alguien**: pagar los primeros errores de MP del spike — bloquea T0
4. **`sdd-apply`**: ejecutar T0 primero (spike). Si P2 falla en ambos caminos → **parar y escalar**: sin webhook no hay activación
5. PR #163 ~800 líneas en la implementación → `delivery_strategy: ask-on-risk` consulta al llegar el umbral
6. Renovar `GITHUB_TOKEN` / `GITHUB_MCP_TOKEN` (ítem 32) para arreglar el MCP de GitHub

## Relevant Files

- `docs/superpowers/specs/2026-10-01-fase2-webhook-checkout.md` — QUÉ: contrato, 5 endpoints, webhook, 17 edge cases
- `docs/superpowers/specs/2026-10-01-fase2-design.md` — CÓMO: 7 decisiones, flujos, riesgos
- `docs/superpowers/plans/2026-10-01-fase2.md` — 9 tasks, 10 días, dependencias
- `openspec/config.yaml` — init SDD, strict_tdd, matriz de testing
- `AGENTS.md` — sección nueva **GitHub CLI (`gh`) — no está en el PATH**
- `SETUP.md` — fila en tabla de entorno + nota sobre gh portable
- `docs/superpowers/specs/2026-09-subscription-lifecycle.md` — transversal; **3 errores reportados, NO corregidos**
- `vault/03_Deuda/deuda-tecnica.md` — ítems 35-38 a crear + ítem 32 (gh/MCP)

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
