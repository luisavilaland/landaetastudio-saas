# ADR-028: Reserva condicional antes de crear un recurso externo

**Fecha:** 2026-10-07
**Autor:** Equipo LandaetaStudio
**Estado:** Aceptado
**Resuelve:** item 69 (H-F2-7) y contribution al item 70 (H-F2-8) de la auditoría de cierre de Fase 2 (#207)

## Contexto

`POST /api/subscriptions/preapproval` crea un preapproval en MercadoPago para el tenant.
El flujo original era read-then-act en tres pasos separados:

1. Leer `subscriptions.mpPreapprovalId` (transacción 1).
2. Si es `null`, llamar a `POST /preapproval` de MercadoPago (**fuera de toda
   transacción**, ~300 ms de red).
3. Escribir el `mpPreapprovalId` devuelto (transacción 2).

Dos requests concurrentes leen `null`, los dos pasan el check, los dos crean un preapproval
en MP, y el segundo `UPDATE` pisa al primero. El resultado es un preapproval **huérfano en
MercadoPago** que hay que cancelar a mano, y el design §6.5 —que existe precisamente
para impedir "dos suscripciones → dos cobros"— no lo impedía.

El `rate_limit` (10/min por IP) no ayuda: dos clicks caen muy por debajo del límite.

## Decisión

Cuando un request **crea un recurso en un sistema externo** y después lo persiste local,
**el slot local se ocupa de forma condicional antes de la llamada externa**, con un
compare-and-set en el `WHERE` de la escritura.

En este caso, `subscriptions.mpPreapprovalId` admite un valor centinela
`pending:<subscriptionId>`:

```sql
-- 1. Reserva (antes de llamar a MP)
UPDATE subscriptions
   SET mpPreapprovalId = 'pending:<id>', updatedAt = now()
 WHERE id = ? AND tenantId = ?
   AND (mpPreapprovalId IS NULL
        OR (mpPreapprovalId LIKE 'pending:%' AND updatedAt < now - PENDING_RESERVATION_TTL_MS))
RETURNING id
```

Si afecta 0 filas → otra petición ganó → **409 sin llamar a MP**. Si afecta 1 fila, se
llama a MP y se cierra la reserva:

```sql
-- 2. Cierre (después de llamar a MP)
UPDATE subscriptions
   SET mpPreapprovalId = <id real de MP>, updatedAt = now()
 WHERE id = ? AND tenantId = ? AND mpPreapprovalId = 'pending:<id>'
RETURNING id
```

Si el cierre afecta 0 filas, otro proceso tomó la reserva: el preapproval ya creado en MP
queda huérfano. Se registra con `logger.error` y se devuelve 409 que **no** promete un alta
que no ocurrió.

## Alternativas consideradas

1. **`FOR UPDATE` sobre la fila de la suscripción.** Descartado: la llamada a MP ocurre
   **entre** dos transacciones, así que un lock de fila no la cubre. Habría que sostenerlo
   durante los ~300 ms de red, bloqueando cualquier otra escritura de esa suscripción. Peor
   que el problema que resuelve.
2. **`pg_advisory_lock` de sesión.** Descartado: necesita que `lock` y `unlock` caigan en la
   **misma conexión** del pool. Con `postgres-js` cada `db.execute()` puede tomar una
   conexión distinta, así que el par lock/unlock puede no serializar nada — y si la conexión
   se pierde, el lock se filtra hasta que el pool la cierre. Un candado que puede fallar
   abierto es peor que no tener candado.
3. **GET al recurso remoto antes de crear** (preguntarle a MP si ya existe). Descartado como
   mecanismo de serialización: no resuelve la carrera (dos requests consultan, las dos
   ven "no existe", las dos crean) y agrega latencia. Sirve para reconciliar, no para
   mutually-excluir.
4. **Índice único parcial sobre el estado pending.** El índice ya existe
   (`subscriptions_mp_preapproval_idx`) pero no sirve: impide dos filas con el **mismo** id,
   y el bug produce dos ids **distintos**. Pasa a ser la red de seguridad de la reserva, no
   el mecanismo.
5. **Una columna `preapprovalReservedAt`.** Descartado por costo: migración nueva, entrada
   en `_journal.json`, y el guard de migraciones inmutables. `updatedAt` ya existe y la
   reserva lo actualiza, así que la edad sale de ahí sin tocar el schema.

## Consecuencias

### Positivas

- **La ventana queda cerrada sin lock y sin migración.** La condición de concurrencia vive
  en el `WHERE`, que es el único lugar que la base de datos serializa.
- **No se crea el huérfano.** El perdedor recibe 409 **antes** de tocar MP. Ese era el
  daño real: no el 409 duplicado, sino el preapproval que nadie puede cancelar desde la app.
- **Recuperable ante crash.** `PENDING_RESERVATION_TTL_MS` (5 min) deja que otro request
  tome el lugar si el proceso anterior murió con la reserva viva.
- **Reutilizable.** El mismo mecanismo sirve para cualquier "crear en externo, persistir
  local": cupones que generan códigos, invitaciones que generan tokens, exportaciones que
  crean jobs.

### Negativas

- **`mpPreapprovalId` deja de ser "un id de MP o null".** Cualquier código que lo lea tiene
  que tolerar el centinela. Hoy el único lector es este endpoint y la estrategia L del
  webhook, que busca por `preapproval_id` recibido de MP: un valor `pending:` nunca
  matchea un id real, así que no puede desviar un webhook.
- **Fail-closed con ventana de espera.** Si MP rechaza la creación (502, 503, timeout), la
  reserva sigue viva hasta el TTL y el tenant recibe 409 con `retryInSeconds` en vez de
  poder reintentar al instante. Es un costo consciente: elegir entre "reintentá en 5
  minutos" y "un preapproval huérfano porCancelar a mano".
- **Un centinela es una convención, no un tipo.** Nada impide que alguien escriba un valor
  mal formado. El prefijo y el test son la única barrera.

## Aplicación en el item 70

El mismo principio — **la condición de concurrencia va en el `WHERE` de la escritura, no en
un lock** — se aplica a `applyTransition` del webhook: el `UPDATE` ahora incluye
`eq(status, current)` y se inspecciona `.returning()`. Si afecta 0 filas, la transición se
descarta con `reason: 'concurrent_update'`. Es el mecanismo del item 1 (TOCTOU checkout),
que ya estaba en producción; por eso **no se crea un ADR aparte** para esa parte.

## Referencias

- Item 69 y item 70 de `vault/03_Deuda/deuda-tecnica.md`
- Auditoría de cierre de Fase 2 (#207), H-F2-7 y H-F2-8
- Item 1 (TOCTOU checkout): precedente del compare-and-set en `WHERE` + `.returning()`
- ADR-023: separación de los dos flujos de MercadoPago
- Design de Fase 2 §6.5: por qué "dos suscripciones → dos cobros" hay que impedirlo
