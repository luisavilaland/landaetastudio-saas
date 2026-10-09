---
id: 268
type: discovery
project: landaetastudio-saas
scope: project
topic_key: bugfix/check-encoding-no-cubre-cjk
session_id: ses_ee3363414ffepuVav38D5l1MbQ
created_at: "2026-10-09 14:03:07"
updated_at: "2026-10-09 14:03:07"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "El item 90 se reprodujo en vivo: check:encoding dio verde con 4 CJK en el archivo"
---

# El item 90 se reprodujo en vivo: check:encoding dio verde con 4 CJK en el archivo

**What**: El item 90 (CJK no detectado por `check:encoding`) se reprodujo EN VIVO mientras escribia el spec de Fase 3. Escribi 4 caracteres CJK (U+75D5, U+9ED8, U+8BA4, U+503C) dentro de `docs/superpowers/specs/2026-10-09-fase3-autoservicio-tenants.md`, y `pnpm check:encoding` reporto **"0 con hallazgos nuevos"** sobre ese archivo.

**Why**: El SDD de Fase 3 arranca con el spec como primer documento. Escribiendo español normal se colaron caracteres CJK, y el unico control del repo que deberia detectarlo paso el archivo por verde.

**Where**: `docs/superpowers/specs/2026-10-09-fase3-autoservicio-tenants.md`. Detector: `scripts/check-encoding.mjs`. Item 90 en `vault/03_Deuda/deuda-tecnica.md`.

**Learned**:
- **El item 90 no es una hipotesis: es el comportamiento por defecto.** No hace falta un caso raro para reproducirlo. Escribir en español y que el modelo produzca un caracter CJK es suficiente, y pasa. El item 90 esta subestimado en severidad.
- **El detector tiene un hole exacto: no cubre el rango CJK en absoluto**, no "lo cubre mal". Los rangos que chequea son U+FFFD, U+FEFF, doble encoding de 2 y 3 bytes, y control chars. Un CJK entra por la puerta de atrás porque **no esta en la lista**, no porque el umbral falle.
- **El "0 hallazgos" de `check:encoding` NO es evidencia de que el archivo este limpio.** Es evidencia de que el detector no vio lo que hay que ver. Este es el mismo patron del item 61 con RLS: **una capa que parece cubrir y no cubre**. El item 61 fue RLS enmascarando el WHERE; el 90 es el detector enmascarando el CJK. La forma del defecto se repite.
- **La defensa que funciono fue externa al repo:** escanear el archivo con un regex de rangos CJK en PowerShell, algo que el agente puede hacer pero el CI no. Mientras tanto, cada `.md` nuevo que escriba el agente debe pasar por un chequeo explicito de rangos CJK antes del commit, porque el control del repo no lo cubre.
- **Escribi tambien mojibake en prosa** (`"documento que crashed para esta fase"`), que si lo detecta el doble-encoding pero no el mojibake de palabra en ingles. El chequeo de bytes detecta el mecanismo, no el resultado.
- La lesson del item 90 sobre falsos positivos (CJK es una categoria amplia, un solo caracter rompe un archivo) es real, pero la conclusion "por eso no se cubre" es incorrecta: **la respuesta correcta es un allowlist por linea o un umbral, no dejar la categoria entera fuera**.

---
*Session*: [[session-ses_ee3363414ffepuVav38D5l1MbQ]]
*Topic*: [[topic-bugfix]]
