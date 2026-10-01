---
id: 82
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 15:00:05"
updated_at: "2026-10-01 15:00:05"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "Plan Fase 2: 9 tasks, 10 dias, spike bloqueante"
---

# Plan Fase 2: 9 tasks, 10 dias, spike bloqueante

**What**: Plan de 9 tasks (T0-T8) para Fase 2, orden SPIKE -> MIGRACION -> SETUP -> HELPERS -> API -> WEBHOOK -> TESTS -> DOCS -> CIERRE. 10 dias habiles.

**Why**: Desglose ejecutable del spec + design de Fase 2, listo para revision de luisavilaland antes de cualquier linea de codigo.

**Where**: docs/superpowers/plans/2026-10-01-fase2.md

**Learned**:
1. **T0 (spike) bloquea SOLO T5, no T4.** Los 5 endpoints de API se pueden implementar sin conocer los literales de evento. El webhook no. Eso permite avanzar en paralelo.
2. **Grafo de dependencias**: T1 (migracion), T2 (setup), T3 (helpers) no dependen del spike y son paralelizables. T6 se cierra al final aunque las pruebas se escriban junto a cada task (TDD estricto activo).
3. **T1 es la UNICA migracion**: indice unico parcial `subscriptions(mpPreapprovalId) WHERE mpPreapprovalId IS NOT NULL`. Ni tabla ni columna.
4. **T3 contiene 4 helpers puros** (derivePermissions, calcProration, classifyMpEvent) + 1 con deps (resolveTenant con estrategia L local / R remota, devuelve `strategy` en el retorno para testear). `calcProration` recibe `now` inyectado — sin `Date.now()` interno.
5. **Cancelar y reactivar devuelven 202 SIN escribir estado** — el estado lo confirma el webhook. `PUT /plan` SI escribe `planId` localmente (es intencion de negocio, no estado de MP). Esta asimetria es intencional: evita que la UI diga "cancelada" cuando MP rechazo.
6. **T5: el pipeline del webhook devuelve SIEMPRE 200** salvo firma invalida (401). Es deliberado — 5xx genera reintentos infinitos de MP. Esto incluye "MP caido" y "tenant no resoluble".
7. **3 tests de cross-tenant obligatorios** (no 1): (a) ruta de escritura — un preapproval de A no escribe de B; (b) aislamiento de DB — la query incluye `eq(tenantId)`; (c) no-confianza en el body — body con external_reference de A pero data.id que resuelve a B se procesa B. El test (c) documenta que el body NO decide.
8. **Patron de test critico**: `vi.mock('@repo/db')` mockea `withTenantContext` directamente, NO `db.transaction` (este cierra sobre el `db` real). Then: `vi.mocked(withTenantContext).mockImplementation(async (_, cb) => cb(makeTxMock()))`.
9. **Patron para URLs**: la firma HMAC usa el query param `data.id`, con fallback al body. El webhook de ordenes existente usa solo el body.
10. **Longitud PR**: ~800 lineas de codigo supera el umbral de 400. `delivery_strategy` = `ask-on-risk` -> se consulta al humano al detectar el umbral. NO se decide unilateralmente.
11. **Deuda a registrar (4 items, NO en este PR)**: (35) transversal §1/§6/§8 usa nombres de evento inexistentes [ALTA]; (36) transversal §5 dice que MP no soporta prorrateo nativo (falso) [MEDIA]; (37) transversal §8 define URL con :tenantId (imposible) [ALTA]; (38) MP tiene estado `paused` que el transversal no modela [MEDIA]. Verificar anti-duplicacion en `vault/03_Deuda/deuda-tecnica.md` antes de crear.

**Nota**: T0 NO se ejecuta en el planning — es la primera task de sdd-apply.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
