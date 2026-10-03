---
id: 106
type: config
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 02:11:58"
updated_at: "2026-10-03 02:11:58"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "Test de conexion a Neon con SSL en CI - trampas de backtick y BOM en PowerShell"
---

# Test de conexion a Neon con SSL en CI - trampas de backtick y BOM en PowerShell

**What**: Reemplazado el step de diagnostico por un test de conexion real con el driver `postgres` y `ssl: 'require'`, validado localmente antes de pushear. El objetivo es obtener el codigo de error real (ECONNREFUSED / ETIMEDOUT / 28P01 / ENOTFOUND) que drizzle-kit traga.

**Why**: El test anterior solo imprimia el host sin conectar. No distinguia una conexion rechazada de un fallo posterior de drizzle. `/dev/tcp` no sirve para Neon porque rechaza conexiones sin TLS/SNI.

**Where**: `.github/workflows/e2e.yml` job `seed`, step `Verificar conexion a Neon (con SSL)`. Branch `chore/deuda-items-40-42`, PR #181.

**Learned**:

1. **Dato previo consolidado (del step anterior):** `DATABASE_URL` **esta seteada** y su host es `ep-dawn-hat-amtrizsw.c-5.us-east-1.aws.neon.tech`, **identico al de `.env.local`**. CI y dev comparten la misma base. Se descartaron las hipotesis de secret vacio y de secret que apunta a otra DB. Node v22.23.2, pnpm 9.0.0.

2. **`postgres` SI resuelve desde la raiz del repo.** Esta dependencia esta declarada en las `dependencies` del `package.json` raiz (junto a drizzle-orm, drizzle-kit, ioredis, etc.), no solo en `packages/db`. `node -e "require('postgres')"` desde la raiz funciona. Verificado antes de pushear para no gastar un ciclo de CI.

3. **TRAMPA DE POWERSHELL al construir el snippet: el backtick.** En bash, un backtick dentro de comillas dobles dispara command substitution, asi que el tagged template `` s`SELECT 1` `` necesita escape `\``. Al construir ese string desde PowerShell:
   - Doble comilla `"..."` -> PowerShell **consume** los backticks como caracter de escape y el script llega a bash como `s\SELECT 1 ok\` (roto).
   - Here-string literal `@'...'@` -> conserva el texto intacto. **Es la forma correcta.**

4. **TRAMPA DE BOM (misma familia que el item 40).** `Set-Content` / `Out-File` con `-Encoding UTF8` en PowerShell 5.1 escribe BOM. Bash luego falla con `﻿node: command not found`. Para escribir un script que consuma bash hay que usar `[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))`.

5. **Validacion previa que evito un ciclo fallido:** se ejecuto el snippet con un host inexistente via Git Bash. Resultado: `ERROR CONEXION: ENOTFOUND getaddrinfo ENOTFOUND host.invalid.tld`. **Confirma que el escape sobrevive bash, que el driver se carga, y que el catch imprime codigo + mensaje.** Ese es exactamente el contrato que se busca del step en CI.

6. **Los casos a interpretar cuando corra:**
   - `CONEXION OK: 1` -> red, SSL y auth OK. El fallo es de drizzle-kit (investigar wrapper o upgrade).
   - `ECONNREFUSED` -> IP no permitida en Neon (Settings > Networking > IP Allow), endpoint suspendido, o firewall bloqueando 5432.
   - `ETIMEDOUT` -> la red no llega. Firewall del proveedor del runner.
   - `28P01` -> password incorrecta en el secret.
   - `ENOTFOUND` -> DNS del runner no resuelve `neon.tech`. Revisar `/etc/resolv.conf`.

7. **Nota sobre `ssl: 'require'`:** `postgres` ya usa SSL por defecto cuando la URL lo indica (`sslmode=require`). El flag explicito es redundante pero inofensivo, y deja la intencion documentada.

8. **El item 43 sigue vigente con independencia del resultado:** aunque el test revele la causa, `drizzle-kit` seguira tragando los errores de migracion en CI. Requiere wrapper propio o fix upstream (hanji sigue en `0.0.8`).

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
