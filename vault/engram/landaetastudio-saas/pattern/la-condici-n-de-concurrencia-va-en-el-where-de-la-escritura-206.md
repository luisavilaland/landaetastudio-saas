---
id: 206
type: pattern
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee8f0bdb6ffeQBTehsgXQas20X
created_at: "2026-10-08 12:37:47"
updated_at: "2026-10-08 12:37:47"
revision_count: 1
tags:
  - landaetastudio-saas
  - pattern
aliases:
  - "La condición de concurrencia va en el WHERE de la escritura, no en un lock; y el WHERE no puede probarse sin un mock que devuelva 0 filas"
---

# La condición de concurrencia va en el WHERE de la escritura, no en un lock; y el WHERE no puede probarse sin un mock que devuelva 0 filas

**What**: Patrón reusable para tres clases de defecto que el proyectoPHA encontrado repetidamente: (1) crear un recurso en un sistema externo y después persistirlo local; (2) leer-modificar-escribir una fila en base de datos; (3) un commento o una rama de código que describe un mecanismo que no está. En los tres casos la solución es la misma forma: **poner la condición de concurrencia en el `WHERE` de la escritura y verificar `.returning()`**, no un lock.

**Why**: Items 69, 70 y 74 del cluster H-F2, más el precedente del item 1 (TOCTOU checkout). Cuatro apariciones del mismo patrón en el mismo dominio (suscripciones y checkout), y en ningún caso `FOR UPDATE` resolvió algo.

**Where**: Aplicaciones en este repo: `apps/admin/app/api/subscriptions/preapproval/route.ts` (reserva con centinela, ADR-028), `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` (`applyTransition` con `eq(status, current)`), `apps/storefront/app/api/checkout/route.ts` (item 1, `gte(stock, qty)`). Contraejemplos de por qué no el otro camino: el `FOR UPDATE` no cubre una llamada de red entre dos transacciones; el `pg_advisory_lock` necesita lock y unlock en la misma conexión del pool, que postgres-js no garantiza.

**Learned**: (1) **La condición de concurrencia pertenece a la escritura, no a la lectura.** Escribir `SELECT ... FOR UPDATE` protege la lectura pero deja abierta la ventana entre transacciones; un `WHERE` con el valor leído es auto-atómico y no necesita estado. (2) **Un candado que puede fallar abierto es peor que no tener candado.** `pg_advisory_lock` con un pool de conexiones parece serializar y no lo hace si lock y unlock caen en conexiones distintas: el código pasa la revisión y no protege nada. Este proyecto ya tiene el antecedente con Redis (`redisClient.*` directo prohibido por `safeRun`,AGENTS.md). (3) **Un estado centinela en una columna compartida obliga a auditar sus lectores.** `mpPreapprovalId` dejó de ser "id de MP o null"; la revisión tenía que demostrar que la estrategia L del webhook (que resuelve por `preapproval_id` real) no se desvía, no asumirlo. (4) **Un `.returning()` que devuelve `[{ id }]` siempre es un test que no testea nada** — pasa idéntico con y sin el fix. Para probar un compare-and-set, el mock tiene que poder devolver 0 filas: simular el slot como estado compartido y dejar que el takeover ocurra en el momento real (durante la llamada externa). (5) **Comparar contra las tablas de verdad, no contra el comentario.** La rama `target === current` parecía un mecanismo activo de idempotencia; recorrer los cuatro caminos de `decideTarget` contra `CANCELLABLE`/`PAUSABLE`/`REVIVABLE` demostró que es inalcanzable. Un comentario que describe un mecanismo inexistente sobrevive años porque nadie lo ejecuta. (6) Cuando el fix introduce un estado intermedio nuevo, el mensaje de error tiene que distinguirlo del estado que ya existía: "ya tenés un preapproval" y "la creación está en curso" parecen equivalentes y son opuestos.

---
*Session*: [[session-ses_ee8f0bdb6ffeQBTehsgXQas20X]]
