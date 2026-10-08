---
id: 205
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 12:37:16"
updated_at: "2026-10-08 12:37:16"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Cluster 69+70 resuelto: compare-and-set sin locks, reserva con centinela en preapproval"
---

# Cluster 69+70 resuelto: compare-and-set sin locks, reserva con centinela en preapproval

**What**: Cluster de items H-F2 resuelto con compare-and-set, sin locks. **Item 69** (`POST /api/subscriptions/preapproval`): `mpPreapprovalId` ahora admite un centinela `pending:<subId>` que ocupa el slot mediante `UPDATE ... WHERE id AND tenantId AND (mpPreapprovalId IS NULL OR (mpPreapprovalId LIKE 'pending:%' AND updatedAt < now - TTL)) RETURNING id` ANTES de llamar a MP. 0 filas → 409 con `retryInSeconds` sin haber tocado MP. El cierre también es condicional (`AND mpPreapprovalId = 'pending:<id>'`): si otro tomó la reserva, el preapproval queda huérfano y se registra con `logger.error` + 409 que no promete un alta inexistente. `PENDING_RESERVATION_TTL_MS` = 5 min para recuperar un proceso muerto. **Item 70** (`applyTransition`): el UPDATE suma `eq(dbSubscriptions.status, current)` y se inspecciona `.returning()`; 0 filas → `{ applied: false, reason: 'concurrent_update' }` + log. ADR-028 creado. Items 69/70 → RESUELTOS; 73 y 74 registrados.

**Why**: Item 69: dos POST concurrentes leían `null`, los dos creaban un preapproval en MP y el segundo `UPDATE` pisaba al primero, dejando un huérfano que hay que cancelar a mano — el design §6.5 no lo impedía. Item 70: dos webhooks concurrentes competían por last-write-wins y podían dejar `active` mientras MP decía `cancelled`.

**Where**: `apps/admin/app/api/subscriptions/preapproval/route.ts`, `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`applyTransition` en la línea ~497, NO en un `handlers.ts` que no existe), sus `__tests__/route.test.ts` y `__tests__/handler.test.ts`, `vault/01_ADRs/ADR-028-reserva-condicional-antes-de-crear.md`, `vault/03_Deuda/deuda-tecnica.md`, `vault/05_Specs/arquitectura.md`, `vault/02_Bitacora/bitacora.md`. Rama `fix/h-f2-69-70-mutation-serialization` desde `develop` @ `9633f37`.

**Learned**: (1) **`handlers.ts` no existe.** `applyTransition` vive en el `route.ts` de 791 líneas. Un plan que nombra un archivo inexistente hace perder el trabajo de ubicarlo. (2) **Un `returning()` que devuelve `[{ id }]` siempre es un test que no testea nada**: el test de concurrencia habría pasado idéntico con y sin el fix. Hubo que construir un mock que simula el slot como compare-and-set real sobre estado compartido, con el takeover ocurriendo *durante* la llamada a MP. (3) **La reserva introduce un estado nuevo en una columna compartida**: `mpPreapprovalId` dejó de ser "id de MP o null". Hay que revisar cada lector — la estrategia L del webhook busca por `preapproval_id` real, así que un centinela nunca desvía un webhook, pero eso se verificó, no se|club假设`. (4) **El 409 del perdedor ahora dice "creación en curso", no "ya tenés un preapproval"**: son estados distintos y confundirlos manda al tenant a un preapproval que no existe. (5) `FOR UPDATE` y `pg_advisory_lock` se descartaron: el primero no cubre una llamada de red entre transacciones; el segundo necesita lock y unlock en la MISMA conexión del pool, y con postgres-js eso no está garantizado — un candado que puede fallar abierto es peor que ninguno. El precedente del item 1 (TOCTOU checkout) ya tenía la solución probada. (6) **Dead code encontrado (item 74)**: la rama `target === current` de `applyTransition`, que devuelve `reason: 'converged'`, es inalcanzable — recorridos los cuatro caminos de `decideTarget` contra `CANCELLABLE`/`PAUSABLE`/`REVIVABLE` y ninguno devuelve un valor igual a `current`. El primer test del item 70 la asumía alcanzable y falló con `expected 'no_transition' to be 'converged'`.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
