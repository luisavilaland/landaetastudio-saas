---
id: 278
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-10 18:30:09"
updated_at: "2026-10-10 18:30:09"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "proxy.test.ts no importaba el proxy real"
---

# proxy.test.ts no importaba el proxy real

**What**: `proxy.test.ts` reimplementaba la resolucion de tenant con `split('.')` sobre strings y assertaba sobre esa copia. Habria pasado en verde si se borraba `proxy.ts` entero. Reescrito para importar `proxy()` de verdad: 11 tests que controlan el mock de `db.select` por caso y serializan el SQL del `where` con `PgDialect`.

**Why**: es el item 62 con un caso nuevo. Alli el nombre de una funcion mentia sobre el codigo; aqui miente el ARCHIVO ENTERO sobre si hay cobertura. Un reviewer que ve `proxy.test.ts` con 3 tests en verde marca el casillero de resolucion de tenant sin abrirlo.

**Where**: `apps/storefront/__tests__/proxy.test.ts`, `apps/storefront/proxy.ts`.

**Learned**:
(1) La primera asercion escrita (`queryChunks.length > 1`) NO detectaba la ausencia del filtro de status: paso en verde con la mutacion aplicada. Se sustituyo por `sqlToQuery().sql` conteniendo `"status"`.
(2) Este es el sexto caso del patron "un control que acompana y no verifica" (61 RLS enmascarando el WHERE, 62 el nombre hace la review, 67 external_reference sin validar, 90 el detector que no mira CJK, 94 db:migrate que no verifica, y ahora la asercion del propio test que documentaba el defecto).
(3) Verificacion en rojo con dos mutaciones independientes: quitar el filtro del subdominio y quitar el de la cookie. Cada una cae en su propio test.
(4) El patron de mock por caso (`rowsQueRetorna({rows: []}, {rows: [...]})`) documenta el orden de los lookups en el test, en vez de dejarlo implicito.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
