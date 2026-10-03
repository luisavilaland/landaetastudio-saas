---
id: 120
type: discovery
project: landaetastudio-saas
scope: project
topic_key: tooling/powershell-verification-traps
session_id: ses_efdd2f1e3ffelclOLYDsLzgp4I
created_at: "2026-10-03 15:08:41"
updated_at: "2026-10-03 15:08:53"
revision_count: 2
tags:
  - landaetastudio-saas
  - discovery
aliases:
  - "Gotcha PowerShell 5.1 con gh y git: stderr nullo $? y rompe el chaining"
---

# Gotcha PowerShell 5.1 con gh y git: stderr nullo $? y rompe el chaining

**What**: En PowerShell 5.1 los binarios nativos gh y git escriben texto normal a stderr, por ejemplo "Already on 'develop'" o "From https://github.com/...". PowerShell lo envuelve en NativeCommandError y pone LASTEXITCODE visible pero $? en false, aunque el comando haya salonsado bien. Un chaining del tipo "cmd1; if ($?) { cmd2 }" se salta cmd2 silenciosamente.

**Why**: Casi me salteo un paso del protocolo al cerrar el PR 183. El checkout de develop devolvio "Already on 'develop'" por stderr, $? quedo false, y el pull mas el log del mismo comando nunca corrieron. El sintoma es desconcertante porque el output parece un error de git cuando en realidad es exito.

**Where**: Todos los comandos con gh y git en este proyecto, en Windows. El binario gh vive en la carpeta temporal del usuario bajo gh/bin/gh.exe.

**Learned**: encadenar con la comprobacion de $? es inseguro con binarios nativos en este shell; encadenar con punto y coma y verificar el exit code, o correr cada paso en su propio comando. El redirect 2>&1 en PowerShell 5.1 convierte stderr en records de error, asi que un Select-Object sobre el output puede mostrar solo el error y esconder el resultado real. El JSON de statusCheckRollup de gh pr view trae los nombres en dos campos distintos: name para CheckRun y context para StatusContext; hay que leer ambos o se pierde informacion. Y el gate de merge: el check build del workflow CI puede seguir IN_PROGRESS mientras los tres checks de Vercel ya estan en verde, asi que un humano mirando solo Vercel concluye CI verde antes de tiempo. El unico check que valida lint, format, typecheck, build y test es build.

---
*Session*: [[session-ses_efdd2f1e3ffelclOLYDsLzgp4I]]
*Topic*: [[topic-tooling]]
