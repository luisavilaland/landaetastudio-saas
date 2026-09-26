---
id: 3
type: config
project: landaetastudio-saas
scope: project
topic_key: external/anydesk-gui-approval
session_id: ses_f2781d7c1ffeGZhO9Dl7OPCLui
created_at: "2026-09-25 12:17:37"
updated_at: "2026-09-25 12:19:20"
revision_count: 2
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Acepté solicitud entrante de AnyDesk"
---

# Acepté solicitud entrante de AnyDesk

**What**: Hice un clic automatizado en el botón principal `Aceptar` de AnyDesk, usando coordenadas Derived de UIAutomation, y el diálogo de solicitud desapareció.
**Why**: El usuario confirmó explícitamente que quería aceptar la conexión entrante después de que `Enter` no funcionara.
**Where**: Sesión Windows interactiva; ventana AnyDesk `ad_win#3`, botón `Aceptar` de 272x32 px.
**Learned**: AnyDesk expone el botón como `Pane` sin `InvokePattern`; un clic físico único funcionó. La desaparición del diálogo confirma la aceptación, pero no prueba por sí sola que el escritorio remoto esté conectado.

---
*Session*: [[session-ses_f2781d7c1ffeGZhO9Dl7OPCLui]]
*Topic*: [[topic-external]]
