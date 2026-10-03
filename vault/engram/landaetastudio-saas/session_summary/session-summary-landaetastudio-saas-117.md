---
id: 117
type: session_summary
project: landaetastudio-saas
scope: project
topic_key: ""
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-03 14:26:21"
updated_at: "2026-10-03 14:26:21"
revision_count: 1
tags:
  - landaetastudio-saas
  - session_summary
aliases:
  - "Session summary: landaetastudio-saas"
---

# Session summary: landaetastudio-saas

## Goal
Cerrar la saga del spike T0 de MercadoPago (suscripciones) y dejar el repo limpio tras mergear PR #178, #180, #181 y #182. La sesion termino con `develop` en `0c21165`, 0 PRs abiertos y vault sincronizado.

## Instructions
- El humano decide cuando arrancar cada fase. NO arrancar H2 ni T1 sin OK explicito.
- Proxima sesion: calibracion + T1 (migracion del indice unico parcial).
- Nada de force-push a `develop`. Nada de commits directos: todo va por PR.
- Todos los comandos de git/geek planeados se ejecutan en el worktree principal salvo que se indique worktree de Paseo.

## Discoveries
- **Un `2xx` de MercadoPago no significa que la operacion se aplico.** Cuatro casos lo probaron en el spike. Regla: toda escritura con efecto de estado se verifica con `GET` posterior.
- **`PUT /preapproval/{id}` es inerte tras el primer cobro** (P6). `status:"cancelled"` -> 200 sin efecto, `status:"paused"` -> 200 sin efecto, `status:"canceled"` -> 400, `transaction_amount` -> 200 sin efecto. `last_modified` nunca se movio. **La cancelacion y pausa quedan fuera de alcance de Fase 2.**
- **`MP_PLATFORM_ACCESS_TOKEN` en `.env.local` es el token del seller test** (`APP_USR-...-3360257364`), verificado por SHA-256. No es un token OAuth de plataforma, asi que P6 no esta probado para credenciales de produccion.
- **`drizzle-kit@0.31.10` + `hanji@0.0.8` tragan los errores de migracion en CI.** `renderWithTask` hace `terminal.reject(err)` y luego `process.exit(1)` sincrono; ademas la vista no tiene rama para `rejected`. Descartados: `CI: true` (drizzle nunca lee `process.env.CI`), `--verbose` (no existe), stderr (vacio), shim de `process.exit`. **Item 43, abierto, severidad ALTA.**
- **El fallo de `seed` en CI nunca fue de migraciones.** Era `nftables` en el VPS del runner bloqueando el puerto 5432 (regla creada despues de un `LOGDROPOUT`). Fix manual del humano.
- **`seed.ts` trunca 10 de 13 tablas**; quedan fuera `subscriptions`, `tenant_mp_config`, `shipping_methods`. `subscriptions` es la de Fase 2 -> tests flaky en T4/T5. Item 46.
- **`pnpm db:seed` trunca la base compartida en cada push a develop.** Item 44, severidad BAJA durante desarrollo con dos gatillos: primer tenant real y primer deploy con trafico.
- **Los dos secrets de base deben moverse JUNTOS.** Mover solo uno produce un fallo que no parece de configuracion (assert de Playwright). Item 45, resuelto.
- **Escanear encoding sobre salida de `git` es estructuralmente incapaz de detectar CJK**: la salida nativa se decodifica con la codificacion de consola y los ideogramas llegan como `?` antes del regex. Escanear el archivo con `Get-Content -Encoding UTF8`.
- **`iconv -f UTF-8 -t CP1252 | iconv -f CP1252 -t UTF-8` es identidad**: no arregla doble-encoding y corrompe acentos legitimos en archivos sanos. Usar reemplazo dirigido con mapeo explicito.
- **Solo `.env.local` tenia mojibake.** Los `.example` (trackeados) estaban limpios: sus no-ASCII son acentos, guion de caja y emoji.
- **Mi conclusion inicial del spike era incorrecta.** Se verifico que no hubo entrega, pero nunca se verifico que la suscripcion a topics estuviera activa en el panel. Confundir "no hubo entrega" con "no hay entrega posible".
- **El baseline de migraciones esta sano**: commit `6756a38` (PR #141) en develop; `sha256(0000_baseline.sql)` coincide con el hash en `drizzle.__drizzle_migrations` de production. **El tracking vive en el schema `drizzle`, no en `public`** (consultar `public.__drizzle_migrations` da 42P01).

## Accomplished
- Spike T0 completo (PR #178, `e97b0c8`): P2/P5 negativos, P3 positivo, P6 confirmado, P1 reframeado a pendiente.
- Reframe del spike: H1 (preview domain) vs H2 (sin topic suscrito) siguen abiertas.
- Items de deuda 39-46 registrados; 41 y 45 resueltos; 43 y 46 abiertos; 44 BAJA con gatillos; 23 desactualizado (candidato a cierre por redaccion).
- Item 40 (reglas de escritura .md en PowerShell) con la causa raiz del fallo del escaneo de CJK.
- PR #180 mergeado (`4728dc8`), PR #181 mergeado (`7ac8006`), PR #182 mergeado (`0c21165`).
- Bitacora actualizada: entradas del 2026-10-02 y 2026-10-03 (spike, fix del runner, items 44-46, correccion del diagnostico de .env).
- `.env.local` reparado localmente (0 mojibake, sin BOM, 21 vars byte-identicas al backup). Sigue gitignored.
- Repo limpio: `develop` = `0c21165` sincronizado, 2 ramas, 1 worktree, 0 PRs, vault `116 == 116`.
- 116 observaciones en Engram, todas exportadas.

## Next Steps
1. **Calibracion de la nueva sesion** con este resumen.
2. **H2 (5 min, bloquea T5):** confirmar en el panel de MP que los topics `subscription_preapproval` + `subscription_authorized_payment` estan suscritos. El panel muestra "ETAPA 1 DE 5", lo que sugiere que no. Si H2 es la causa, T5 se reduce a configurar topics.
3. **T1:** migracion del indice unico parcial `subscriptions_mp_preapproval_uidx`. Bloqueada indirectamente por item 43 (el PR saldria con seed rojo si el migrate falla en CI), pero el seed ya pasa en verde desde el fix de nftables.
4. **Pregunta a MercadoPago:** si el access token OAuth de plataforma puede mutar `PUT /preapproval/{id}`. Define si T4 tiene backend de cancelacion o redirige al portal de MP.
5. **Urgente, fuera del repo:** dos preapproals de prueba con cobro agendado el **2026-11-02** (`32f3e2a8575d4797a7841d98390e52bc` y `f7b02efc00cb4638a0fe25da2013018d`). Cancelar desde el panel de MP; la API no funciona (P6).
6. **Rotar dos tokens** que quedaron expuestos en el chat: el de Vercel y el del seller de pruebas.

## Relevant Files
- `vault/03_Deuda/deuda-tecnica.md` - 46 items. Item 43 (drizzle traga errores, ALTA) y 46 (subscriptions sin truncar, MEDIA) son los tecnicos abiertos.
- `vault/02_Bitacora/bitacora.md` - narrativa de los dias 02 y 03 de octubre.
- `docs/superpowers/plans/2026-10-01-fase2.md` - T5 reducida a sonda (1 dia), T9 fallback condicional.
- `docs/superpowers/specs/2026-10-02-spike-t0-resultado.md` - resultado del spike con tabla de hipotesis H1/H2/H3.
- `docs/superpowers/specs/2026-10-01-fase2-design.md` - §2.4 resuelto (notification_url no existe), §5.1 anotado (cancel/reactivate/plan sin backend).
- `apps/admin/app/api/webhooks/mercadopago/subscriptions/route.ts` - stub endurecido v2, con firma HMAC y limite de 100 KB. Temporal, NO es T5.
- `packages/db/seed.ts` - trunca 10 de 13 tablas; falta `subscriptions`.
- `.github/workflows/e2e.yml` - jobs `seed` y `e2e`, ambos con diagnostico de conexion Neon.
- `docs/superpowers/specs/2026-09-blueprint-v2.6.md` - Fase 10 (go-live) tiene el gatillo del item 44 como punto 8.
- `scripts/check-migrations.sh` - guard de migraciones inmutables, cableado en CI.

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
