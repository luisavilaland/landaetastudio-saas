---
id: 40
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f448d99d0ffeCS9MRqGB57jm6p
created_at: "2026-09-26 16:09:28"
updated_at: "2026-09-26 16:09:28"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Encoding Windows: la consola miente sobre encoding"
---

# Encoding Windows: la consola miente sobre encoding

La consola de Windows miente sobre encoding (3 falsos positivos en una sesión). Verificar SIEMPRE a nivel de bytes (xxd, file, git grep) antes de asumir corrupción. El mojibake visual puede ser solo el terminal renderizando UTF-8 con ANSI.

---
*Session*: [[session-ses_f448d99d0ffeCS9MRqGB57jm6p]]
