---
id: 307
type: architecture
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_ec516745affeWwc5BP90dypB2d
created_at: "2026-10-14 17:50:12"
updated_at: "2026-10-14 17:50:12"
revision_count: 1
tags:
  - landaetastudio-saas
  - architecture
aliases:
  - "S4c: refinamiento validado (68->11), 3 archivos pendientes"
---

# S4c: refinamiento validado (68->11), 3 archivos pendientes

**What**: S4c (issue #253). Refinamiento VALIDADO y aplicado: los tests de endpoint mockean `getPermissions` (la fuente), NO el guard. Progreso de 68 -> 11 tests en rojo. Typecheck 9/9 verde.

**Why**: Luis refinó la opción (b): mockear la fuente en vez del guard, para que el cableado del guard se verifique en cada test.

**Where**: Rama `feat/s4c-apply-guards`. Commit `faa4343` (helper getPermissions + 10 tests + fix de naming). SIN COMMITEAR: 2 permission-guard.ts, 13 route.ts con 17 guards, 13 test files, docstring de makeTxMock.

**Learned**:
- **PROBADO que el refinamiento cierra el hueco del item 61.** En `products/__tests__/route.test.ts` se removio el guard del endpoint -> los 3 tests de denegacion FALLARON (3 failed | 7 passed). Con el guard -> 10/10. Si se hubiera mockeado `denyIfNoPermission`, borrar el guard habria dejado los tests en verde.
- **Por que el prefijo de colas no servia**: el mock por indice no distingue tablas. `[{status:'active'}]` insertado como fila de `tenants` tambien servia como fila de `categories` en el select siguiente -> 409 donde se esperaba 201. Un test que pasa por la razon equivocada, en un guard de seguridad.
- **Patron aplicado a 13 archivos**: `vi.mock('@repo/commerce', ...)` preservando el resto con `importActual`, `FULL_ACCESS` como default en `beforeEach`. Sin tocar `makeTxMock`.
- **Ojo con 6 archivos**: no tienen `beforeEach` de nivel superior; hay que CREARLO (no solo inyectar). Se detecto porque el script reportaba `sin beforeEach` y hacia `continue` SIN escribir.
- **ESTADO EXACTO AL CORTAR**: 11 tests en rojo en 3 archivos, todos `apps/admin/app/api/products/`: `[id]/images/__tests__/route.test.ts`, `[id]/images/[imageId]/__tests__/route.test.ts`, `import/__tests__/route.test.ts`. Fallan con **500 inesperado** (no 403 ni 200). El mock esta bien puesto (verificado: import + vi.mock + FULL_ACCESS presentes, y `vi.mock('@repo/db')` tambien). Hipotesis a verificar: esos 3 archivos importan DOS routes (`../route` y `../[imageId]/route`) y/o tienen `uploadImage`/`deleteImage` mockeados sin valor resuelto.
- **Proximo paso**: debuggear esos 3 archivos uno por uno. Despues: `permission-guard.test.ts` centralizado (admin + storefront) con la matriz completa, deny tests por endpoint, item 103 RESUELTO + item 116, bitacora, DoD y PR.
- Recordatorio de seguridad: NO commitear con tests en rojo.

---
*Session*: [[session-ses_ec516745affeWwc5BP90dypB2d]]
