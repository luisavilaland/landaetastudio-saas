---
id: 311
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 22:04:22"
updated_at: "2026-10-14 22:04:22"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Item 117 resuelto: 9 deny tests, fix del 500 por callCount"
---

# Item 117 resuelto: 9 deny tests, fix del 500 por callCount

**What**: Item 117 (H-F3-s4c-1, ALTA) RESUELTO. 9 deny tests para los guards sin cobertura de S4c. 930/930 tests (921 → 930). Issue #275, rama fix/s4c-deny-tests.

**Why**: La auditoría S4c (#272) encontró que 9 de 16 guards no tenían deny test: 6 fallaban EN SILENCIO al borrar el guard, 3 con un 500 accidental. Item 103 decía "el guard se aplica"; faltaba "y alguien lo verifica".

**Where**: 7 archivos de test bajo apps/admin/app/api/{categories/[id], products/[id], products/[id]/variants, products/[id]/images, products/[id]/images/[imageId], products/import, shipping/[id]}/__tests__/route.test.ts. vault/03_Deuda (item 117 → RESUELTO), vault/02_Bitacora.

**Learned**:
- **El fix del 500 por callCount**: los mocks reservaban la transacción #1 para el guard (`GUARD_TX` en el índice 0 del `mockCalls`, o `callCount === 2` para la del handler). Al borrar el guard, el handler recibía la tx del guard en vez de la suya y reventaba con 500 — la señal útil quedaba tapada por un error de test. **La solución: el deny test usa la secuencia de transacciones DEL HANDLER, sin slot reservado.** El guard abre su propia tx y se queda con la primera, pero como `getPermissions` está mockeado NO LE IMPORTA cuál recibe. Con guard → 403; sin guard → el handler completa y devuelve 2xx.
- **Asertar el status ANTES de leer el body.** Un DELETE exitoso responde 204 SIN cuerpo y `res.json()` ahí tira → el catch del handler lo convierte en 500. Por eso el deny test PRE-EXISTENTE de `products/[id]` PUT fallaba con 500 y no con 200: no estaba mal cableado, miraba el body antes que el status. Un test que falla por la razón equivocada es ruido con forma de red de seguridad.
- Para handlers con 2 transacciones (images POST, import), una sola tx auto-encadenada que sirva lectura E insert es lo que hace el test independiente de la posición. `makeTxMock` necesita `repeatLastSelect: true` y `orderBy.mockResolvedValue([])` para que no agote la cola.
- **Residual honesto**: los happy paths de images e import siguen reservando GUARD_TX (con el guard presente el handler los necesita en las posiciones 2 y 3), así que al mutarlos fallan con 500. No afecta la cobertura: el deny test de cada archivo da señal limpia. Anotado en el ítem.
- **Dos errores propios**: (1) mi regex para borrar GUARD_TX se comió FULL_ACCESS entero y rompió 13 tests — lo detecté porque falló la suite completa, no por leer el diff. (2) Quité el slot de los happy paths creyendo que era la corrección y rompí los 3 tests de éxito; era al revés. **Lección: un regex con `[\s\S]*?` que arranca en el primer `/**` se lleva todo lo que haya hasta el match. Verificar el diff, no asumir.**
- H-F3-s4c-4: el header de shipping/[id]/route.test.ts prometía "si borras el guard el test falla" sin un solo assert de 403. Corregido con los deny tests + comentario honesto.
- 0 marcadores de mutación residuales; ni una línea de producción tocada.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
