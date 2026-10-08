---
id: 225
type: bugfix
project: landaetastudio-saas
scope: project
topic_key: bugfix/items-76-77-reconstruccion-byte-level
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-08 20:50:16"
updated_at: "2026-10-08 20:50:16"
revision_count: 1
tags:
  - landaetastudio-saas
  - bugfix
aliases:
  - "Items 76 y 77 resueltos: reconstruccion byte-level, KNOWN_CORRUPT vacio"
---

# Items 76 y 77 resueltos: reconstruccion byte-level, KNOWN_CORRUPT vacio

**What**: Items 76 y 77 resueltos. `bitacora.md` y `deuda-tecnica.md` reparados con reemplazo dirigido byte a byte. `KNOWN_CORRUPT` de `check-encoding.mjs` quedo VACIO y `check:encoding` corre sin excepciones con exit 0.

**Why:** 42 puntos de corrupcion: 34 `U+FFFD`, 4 control chars, 4 `?` rotos que el detector NO contaba, y 1 BOM. Con los dos archivos en `KNOWN_CORRUPT`, el unico control del repo que detecta doble encoding reportaba en vez de bloquear.

**Where**: `vault/02_Bitacora/bitacora.md`, `vault/03_Deuda/deuda-tecnica.md`, `scripts/check-encoding.mjs`, `scripts/__tests__/check-encoding.test.ts`. Items 87 y 88 nuevos.

**Learned**:
- **El commit que "repara" encoding puede ser el que lo destruye.** `77ea187b`, titulado "fix(bitacora): reparar encoding mojibake preexistente", convertio la corrupcion `i¿½` (doble-encoding de los bytes EF BF BD) en `U+FFFD`. Los bytes originales no existen mas en ninguna rama. Los 33 U+FFFD de hoy son el residual que ese repair dejo. Y la entrada del 2026-08-08 **nacio corrupta** en `a49747f2`: el commit anterior tiene 128 lineas. **0 de 34 eran recuperables de git.**
- **El procedimiento que funciona: par → texto, con conteo esperado verificado + autoverificacion.** Por offset los offsets se corren. El conteo esperado convierte "repare lo que encontre" en "repare exactamente lo que habia". La autoverificacion (reescanear al final y abortar si queda un hallazgo) **aborto dos veces antes de escribir** — un patron mal escrito y un token con backticks. Pre-validar TODOS los pares de una vez, para reportar los 30 fallos juntos.
- **Dos casos con verificacion dura, no inferencia:** el hash `<U+0007>44612f` es `a44612f`, confirmado por `git log --diff-filter=A -- .prettierrc` (es el commit que agrego `.prettierrc`). Y el U+FFFD de deuda-tenia la palabra correcta **30 caracteres mas adelante en la misma frase**: es copia, no reconstruccion.
- **El ejemplo de mojibake tambien necesitaba reparacion, y no era un "arreglo".** L1527 citaba literalmente un archivo roto como ejemplo, violando `AGENTS.md` L104-106 ("ni siquiera como ejemplo en el detector"). Mientras el literal siga ahi, el detector lo ve como hallazgo real y `KNOWN_CORRUPT` no puede quedar vacio. Reescrito como `String.fromCharCode(0x00c3, 0x00b1)`: el ejemplo sigue entendible y ahora cumple la regla. **Esta es la razon por la que el set pudo quedar vacio.**
- **El detector tiene un hole: `?`.** 42 puntos, no 39. No se anadio un patron para `?` porque darias falsos positivos: este repo cita `? Migración existente modificada`, que es la salida real de `check-migrations.sh`. Item 87. Y un segundo hole: **tampoco ve CJK**, y `bitacora.md` tiene 12 (L976/L977 son el documento del incidente del item 52; L3910 parece corrupcion real).
- **`formatReport` dependia del estado de produccion.** Sus tests codificaban `bitacora.md` como fixture de "conocido", asi que al vaciar `KNOWN_CORRUPT` fallaron. Se le dio un parametro `knownCorrupt` con default, para que los tests verifiquen comportamiento y no estado. Se agrego el caso inverso: con el set vacio, cualquier hallazgo es nuevo y bloquea.
- **Este fix no respeto append-only, y esta bien.** El diff muestra 17 lineas con `-` en bitacora porque repara bytes dentro de lineas existentes. No se perdio contenido: numero de lineas identico antes y despues (4399) y ninguna se borro. **La regla de "el diff debe mostrar solo adiciones" NO debe usarse para restaurar este archivo a su version previa: eso reintroduce la corrupcion.** Item 88.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
