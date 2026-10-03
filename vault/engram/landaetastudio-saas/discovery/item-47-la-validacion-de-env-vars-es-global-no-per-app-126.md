---
id: 126
type: discovery
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 17:08:57"
updated_at: "2026-10-03 17:08:57"
revision_count: 1
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Item 47: la validacion de env vars es global, no per-app"
---

# Item 47: la validacion de env vars es global, no per-app

**What**: packages/validation/src/env.ts define un solo schema de produccion para las tres apps. Con el PR 185, MP_PLATFORM_ACCESS_TOKEN y MP_PLATFORM_WEBHOOK_SECRET son obligatorias en produccion, pero solo apps/admin las usa: son las credenciales de la cuenta de plataforma para cobrar suscripciones. Storefront y superadmin no las necesitan y sin embargo validateEnv() tira si faltan, o sea no arrancan.

**Why**: Hallazgo materializado durante el PR 185. Los preview deploys de storefront y superadmin fallaron con las vars sin configurar; configurar las tres en Vercel las dejo en verde. Registrado como item 47 de deuda tecnica con severidad MEDIA.

**Where**: packages/validation/src/env.ts, vault/03_Deuda/deuda-tecnica.md (item 47), vault/02_Bitacora/bitacora.md

**Learned**: (1) SALVEDAD IMPORTANTE: saas-admin paso a verde ANTES de la correccion. Si la causa fuera validateEnv, las tres deberian haber fallado. La correlacion configurar a verde es fuerte pero la causalidad NO esta probada: puede haber un factor propio de storefront y superadmin. El defecto de diseno es real e independiente del incidente; lo que no se afirma es que el incidente fuera exclusivamente por esto. (2) El impacto real no es el deploy: es que obliga a guardar el token de la plataforma en el entorno de dos procesos que nunca lo leen, que es superficie de exposicion gratuita, y frena el merge de cualquier PR que agregue una var de un solo scope. (3) Mitigacion preferida: validateEnv con scope por app, cada una declara lo que exige; solo admin valida MP_PLATFORM_*. Alternativa mas simple: productionBaseSchema mas adminProductionSchema. (4) En PowerShell 5.1 el redirect de git show a archivo escribe en ANSI y corrompe el archivo: dio 0 falsos positivos al escanear U+FFFD en develop. Para verificar si un hit es preexistente hay que usar git diff por hunks, no un redirect.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
