# Setup - Configuración del Proyecto

## Requisitos Previos

- Node.js 22+
- pnpm
- Cuentas activas en: Neon, Upstash, Cloudflare R2, Resend, MercadoPago

## Inicialización Rápida

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar .env.local.example a .env.local y llenar con credenciales reales
cp .env.local.example .env.local

# 3. Generar migraciones (si hay cambios en el schema)
pnpm db:generate

# 4. Aplicar migraciones
pnpm db:migrate

# 5. Ejecutar seed (limpia y crea datos de prueba)
pnpm db:seed
```

## Comandos de Base de Datos

| Comando            | Descripción                         |
| ------------------ | ----------------------------------- |
| `pnpm db:generate` | Genera migraciones desde el schema  |
| `pnpm db:migrate`  | Aplica migraciones pendientes       |
| `pnpm db:seed`     | Limpia la BD y crea datos de prueba |

## Migraciones

Para una base de datos nueva, el flujo es:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

- `pnpm db:migrate` ejecuta `drizzle-kit migrate` y aplica las migraciones del journal a la base de datos.
- `pnpm db:generate` solo se ejecuta cuando se modifica el schema.
- `0000_baseline.sql` representa el estado actual del schema.
- El historial anterior al baseline está preservado en `docs/migrations-archive/2026-09-24/`.

## Datos de Prueba

### admin

- **Email:** admin@tienda1.com
- **Password:** 123456
- **Rol:** admin (tenant: tienda1)

### superadmin

- **Email:** super@admin.com
- **Password:** 123456
- **Rol:** superadmin (sin tenant)

### Cliente

- **Email:** cliente@ejemplo.com
- **Password:** 123456
- **Rol:** customer (tenant: tienda1)

### Tenant

- **Slug:** tienda1
- **Nombre:** Tienda Demo

### Productos de Prueba

- **Remera Básica** (Categoría: Remeras) - 6 variantes (S/M/L x Rojo/Azul)
- **Pantalón Jeans** (Categoría: Pantalones) - 6 variantes (38/40/42 x Azul/Negro)
- **Gorra** (Categoría: Accesorios) - 1 variante (Único, Negra)

### Métodos de Envío (tienda1)

- **Envío estándar** - $150 (gratis sobre $2000, 3-5 días hábiles)
- **Envío express** - $350 (1 día hábil)

### Órdenes de Ejemplo

- Orden #1: **confirmed** (2 remeras M rojas + 1 jean 40 azul)
- Orden #2: **pending_payment** (1 gorra negra + 1 remera L azul)

## Variables de Entorno — 3 archivos

| Archivo              | Propósito                                            | Git         |
| -------------------- | ---------------------------------------------------- | ----------- |
| `.env.example`       | Template original del proyecto (legado)              | ✅ tracked  |
| `.env.local.example` | Template con servicios cloud como default            | ✅ tracked  |
| `.env.local`         | Credenciales reales (copiar de `.env.local.example`) | ❌ ignorado |

**Solo `.env.local` contiene las credenciales reales** y no debe subirse a git. Los otros dos son templates de referencia.

Los servicios locales (Docker) ya no se usan. En su lugar:

| Servicio Local      | Reemplazo Cloud |
| ------------------- | --------------- |
| PostgreSQL (Docker) | Neon            |
| Redis (Docker)      | Upstash         |
| MinIO (Docker)      | Cloudflare R2   |
| MailHog (Docker)    | Resend          |

## Validación de Variables de Entorno

La aplicación valida automáticamente las variables de entorno al arrancar (`packages/validation/src/env.ts`).

### Comportamiento por entorno

| Entorno                                 | Validación                                                                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desarrollo** (`NODE_ENV=development`) | Valida las variables core (`DATABASE_URL`, `DATABASE_APP_URL`, `AUTH_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MP_TOKEN_ENCRYPTION_KEY`). `MP_TOKEN_ENCRYPTION_KEY` requiere al menos 32 caracteres. `NEXTAUTH_URL` es opcional (NextAuth v5 la infiere del Host header). Las variables cloud son opcionales. |
| **Producción** (`NODE_ENV=production`)  | Valida las variables core y cloud (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `MERCADOPAGO_WEBHOOK_SECRET`, `STOREFRONT_URL`). `MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` son opcionales hasta Fase 2. |

### Si falta una variable

La app **no arrancará** y mostrará un error claro indicando qué variable falta o es inválida:

```
❌ Invalid environment variables for PRODUCTION:
  - RESEND_API_KEY: RESEND_API_KEY is required in production for email delivery
  - R2_ENDPOINT: R2_ENDPOINT must be a valid URL in production
```

### Clave de cifrado de MercadoPago

`MP_TOKEN_ENCRYPTION_KEY` es obligatoria en todos los entornos y debe tener al menos 32 caracteres. Generala localmente con `openssl rand -base64 32` y guardala únicamente en `.env.local` o en Vercel. La misma clave debe estar configurada en storefront, admin y superadmin; no se versiona ni se imprime.

`MP_PLATFORM_ACCESS_TOKEN` y `MP_PLATFORM_WEBHOOK_SECRET` quedan opcionales hasta Fase 2.

### Agregar nuevas variables

Si agregás una variable de entorno nueva, actualizá:

1. `packages/validation/src/env.ts` - agregala al schema correspondiente (dev o prod)
2. `.env.example` y `.env.local.example` - agregá el placeholder
3. `SETUP.md` - documentala si es relevante para el setup

## Desarrollo

```bash
# Levantar todas las apps (desarrollo)
pnpm dev

# Iniciar todas las apps (producción, requiere build previo)
pnpm start

# Opcional: levantar solo una app
pnpm --filter storefront dev  # http://localhost:3000
pnpm --filter admin dev      # http://localhost:3001
pnpm --filter superadmin dev # http://localhost:3002
```

## Vault de Obsidian

El vault vive en `vault/` y se trackea con Git. Contiene:

- `00_Inbox/`: entradas pendientes.
- `01_ADRs/`: 25 ADRs del proyecto.
- `02_Bitacora/bitacora.md`: bitácora del proyecto (append-only).
- `03_Deuda/deuda-tecnica.md`: ítems de deuda técnica.
- `04_Fases/`: auditorías y cierres de fases.
- `05_Specs/`: arquitectura, brief técnico y blueprint.

La convención `00-05` aplica solo a contenido **human-curated**. El contenido
**tool-managed** no lleva numeración porque su estructura la define la tool:

- `engram/`: exportaciones de Engram (auto-generado por `pnpm vault:export`,
  NO editar manualmente). El cache `.engram-sync-state.json` está en `.gitignore`.
- `.obsidian/`: config de Obsidian (ignorado en git).
- `.trash/`: papelera de Obsidian (ignorada en git).

`docs/` conserva únicamente los paths operativos que leen herramientas:
`migrations-archive/` (CI) y `superpowers/` (Paseo), más su README índice.

Para abrir el vault: **File → Open folder as vault** y seleccionar `vault/`.

El agente puede leer y escribir Markdown del vault mediante MCP (`second-brain-lite-mcp`).
El MCP `obsidian` está definido globalmente en `~/.config/opencode/opencode.json` con `enabled: false`; cada proyecto lo habilita en su `opencode.json` local con:

```json
{
  "mcp": {
    "obsidian": { "enabled": true }
  }
}
```

El path `vault/` se resuelve contra el root del proyecto.

## Exportación de Engram al vault

`engram` exporta las memorias del agente a Markdown compatible con Obsidian. Comando:

```bash
pnpm vault:export
```

Flags disponibles (vía `engram obsidian-export`):

- `--vault <path>`: raíz del vault (fijo: `vault/`).
- `--project <name>`: filtrar por proyecto.
- `--all`: exportar todos los proyectos.
- `--limit <n>`: limitar la cantidad de observaciones exportadas.
- `--since <date>`: exportar después de una fecha.
- `--force`: ignorar el estado incremental y reexportar.
- `--graph-config <mode>`: configurar el layout del grafo.
- `--watch`: activar auto-sync.
- `--interval <duration>`: intervalo de watch (default: `10m`).

## Ecosistema Gentleman AI

- gentle-ai 3.7.0 está instalado globalmente.
- Engram 2.2.0 está registrado como MCP en `~/.config/opencode/opencode.jsonc` (mayor prioridad en el layering de OpenCode).
- Los MCPs en `opencode.json` (menor prioridad) siguen activos: `open-design`, `supabase` y `obsidian` (`enabled: false` global).
- GGA v2.10.1 tiene un hook versionable en `.githooks/pre-commit`; se activa con `git config core.hooksPath .githooks`.
- La configuración de GGA vive en `.gga` (commiteada).
- Los archivos revisados por GGA están definidos en `FILE_PATTERNS`; se excluyen tests, `dist`, `build`, `node_modules` y `vault/`.
- Para commits triviales (docs, configuración) se puede usar `git commit --no-verify` para saltar la revisión.

### Modelo de IA configurado

- **OpenCode (default)**: `opencode/space-bunny-free` (Space Bunny Free).
- **GGA (code review)**: mismo modelo via `PROVIDER="opencode:opencode/space-bunny-free"`.
- **Nota**: Space Bunny es gratuito por tiempo limitado. Si deja de estar disponible, actualizar `.gga` (línea `PROVIDER`) y `~/.config/opencode/opencode.jsonc` (campo `model`).
- **Alternativa estable**: `anthropic/claude-sonnet-4-5` o similar (pago, no expira).

## Herramientas opcionales (ecosistema Gentleman)

El proyecto integra herramientas globales del entorno de un dev
(gentle-ai, Engram, GGA) pero son **opcionales para contribuir**:

- `.gga` está commiteado, pero solo se usa si tenés `gga` en PATH.
- El pre-commit hook de GGA es opt-in:

      git config core.hooksPath .githooks

- Si no tenés GGA instalado, el hook sale limpio (exit 0) y no
  bloquea commits.
- `pnpm vault:export` requiere Engram, pero no es obligatorio
  para contribuir al código.
- El MCP `obsidian` en `opencode.json` local requiere tener
  `second-brain-lite-mcp` accesible, pero solo se activa si usás
  OpenCode.

Si clonás el repo sin estas herramientas, todo el flujo de
desarrollo normal funciona sin cambios.

## Verificación del entorno

Antes de iniciar, confirmá que el entorno está listo:

| Herramienta | Comando | Esperado |
|-------------|---------|----------|
| Gentle-AI | `gentle-ai --version` | 3.7.0+ |
| Engram | `engram --version` | 2.2.0+ |
| Engram MCP | `opencode mcp list \| grep engram` | connected |
| GGA | `gga --version` | v2.10.1+ |
| Hook GGA | `ls .git/hooks/pre-commit` | existe |
| Obsidian | Abrir `vault/` como vault | vault reconocido |
| Vault export | `pnpm vault:export` | sin errores |

Si alguna falla, ver la sección correspondiente de este documento
o de `AGENTS.md`.

### Comandos SDD disponibles

Estos 11 comandos están disponibles (copiados al proyecto en `.opencode/commands/`):

`/sdd-apply`, `/sdd-archive`, `/sdd-continue`, `/sdd-explore`, `/sdd-ff`, `/sdd-init`, `/sdd-new`, `/sdd-onboard`, `/sdd-research`, `/sdd-status`, `/sdd-verify`

Notar la diferencia con las skills: las skills SDD son 11 pero otras 4 (`sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`) NO tienen command equivalente; se invocan por skill, no por slash command. Los 4 commands sin skill propia son meta-commands: `continue`, `ff`, `new`, `status`.

Verificar disponibilidad:
```bash
ls .opencode/commands/
ls ~/.config/opencode/commands/
```

SDD NO está inicializado en este repo (no existen `openspec/`, `.sdd/` ni `changes/`). El primer uso requiere `sdd-init`.

## Worktrees de Paseo

Los worktrees creados por Paseo (`paseo_create_workspace`) NO
traen consigo:

- `node_modules/` → correr `pnpm install` al entrar.
- `.env.local` → copiar del main worktree. Ubicarlo con `git worktree list` (la primera entrada es el worktree principal) y copiar desde esa ruta: los worktrees de Paseo viven fuera del repositorio, así que una ruta relativa (`../`) NO los alcanza.
- `.atl/` → se regenera con `gentle-ai skill-registry refresh`.

Pueden tener permisos de edición restringidos. Si Paseo bloquea
escritura en `vault/`, reportar al humano (no intentar sortear
el bloqueo).

## Tunnel para Webhooks (dotunnel)

Para recibir webhooks de MercadoPago en desarrollo, necesitas exponer tu localhost públicamente usando `dotunnel`.

### dotunnel (npx)

```bash
npx dotunnel
```

Te pedirá:

1. Puerto local (ej: 3000)
2. Nombre para el proxy (ej: saas-ecommerce)

Te devolverá una URL pública (ej: `https://saas-ecommerce-prxy.ayooub.me`)

### Uso rápido

```bash
# Entrar puerto 3000
npx dotunnel

? Enter the local port of the service to expose (e.g., 8000): 3000
? Enter a name for the proxy (e.g., todo): saasecommerce

🌐 Forwarding to: http://localhost:3000
🔗 Public URL:    https://saasecommerce-prxy.ayooub.me
```

### STOREFRONT_URL (ya no se usa en storefront)

El storefront deriva la URL base de cada request (`x-forwarded-proto` + `host`) con `getStorefrontBaseUrl` para `back_urls` de MercadoPago y links de emails — sin variable de entorno ni fallbacks. `STOREFRONT_URL` se mantiene solo por la validación de entorno (`productionSchema` la exige): es **inerte** en storefront y no hace falta configurarla en `.env.local` para desarrollo.

### Testing del Webhook en Desarrollo

Para simular un webhook firmado correctamente (formato real de MercadoPago: `x-signature: ts=<ts>,v1=<v1>` con cadena canónica `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), genera `v1` con openssl y envialo contra el túnel:

```bash
# Simular webhook aprobado (paymentId 123456789)
TS=$(date +%s)
CANONICAL="id:123456789;ts:${TS};"   # sin x-request-id → la parte se omite
V1=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$MERCADOPAGO_WEBHOOK_SECRET" -hex | sed 's/^.*= //')
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=${TS},v1=${V1}" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"123456789"}}'

# Simular webhook rechazado (paymentId 000000)
TS=$(date +%s)
CANONICAL="id:000000;ts:${TS};"
V1=$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$MERCADOPAGO_WEBHOOK_SECRET" -hex | sed 's/^.*= //')
curl -X POST https://saasecommerce-prxy.ayooub.me/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=${TS},v1=${V1}" \
  -H "x-test-order-id: <order-id>" \
  -d '{"type":"payment","data":{"id":"000000"}}'
```

> **Nota:** La firma real en producción la genera MercadoPago (fail-closed), y `BYPASS_WEBHOOK_SIGNATURE=true` solo salta la verificación en desarrollo, nunca en producción. La ventana de validez del `ts` es de 300 segundos: si el webhook responde 401 por firma, verificá que el reloj esté sincronizado y que el `ts` sea actual.

> **Nota:** La URL del túnel cambia cada vez que reinicias `npx dotunnel`, a menos que uses un plan pago con dominio fijo. Si el webhook deja de funcionar, verifica que el túnel esté activo y actualiza la URL registrada en MP Developer Dashboard. El webhook es multi-tenant: una sola URL (`https://tienda1.landaetastudio.com/api/webhooks/mercadopago`) sirve para todos los tenants porque el tenant se resuelve por `external_reference` (`tenantId:orderId`), no por host.

## Troubleshooting

### Error de migraciones

```bash
# Eliminar todas las migraciones y regenerate
rm -rf packages/db/migrations
pnpm db:generate
pnpm db:migrate
```

## Testing Conventions

### Ejecutar Tests

```bash
pnpm test          # Todos los tests (vitest run)
pnpm test:e2e      # E2E Playwright (requiere apps corriendo + REDIS_URL)
pnpm lint          # Linting + formatting
pnpm typecheck     # TypeScript --noEmit
pnpm build         # Build de todas las apps
```

### Estado de Tests

**474 tests pasando, 0 fallos (57 archivos).** Todos los suites de test están operativos. Los helpers de test están centralizados en `@repo/test-utils` (`makeTxMock`, `session`, `mockReq`).

### Patrones de Testing

- **Handlers reales:** Los tests de endpoints importan los handlers reales (`import { GET, POST } from "../route"`) con mocks de dependencias (`withTenantContext`, Redis, storage). Patrón documentado en AGENTS.md → Helpers de test.
- **Ubicación:** `__tests__/` junto al archivo bajo test.
- **E2E:** Playwright en `e2e/` (ver sección E2E abajo).

### Herramientas adicionales

- **Logs estructurados:** `@repo/logger` con `createLogger('nombre')`. En desarrollo usa `pino-pretty` para logs legibles; en producción formato JSON. Incluir contexto (tenantId, userId, requestId) en cada log.
- **Sentry:** Integrado en las tres apps (`@sentry/nextjs`) para captura automática de errores en producción. Configuración condicional vía `SENTRY_DSN`. Si la variable no está presente, Sentry no se activa.
- **Validación de errores 409:** Todos los endpoints retornan `field` para identificar el campo conflictivo. Los formularios muestran errores inline con highlight visual rojo en el campo afectado.

### Tarjetas de prueba MercadoPago

Tarjetas de prueba del sandbox de MercadoPago, ya funcionales en el entorno de desarrollo. **Titular y documento:** cualquier nombre y cualquier documento (el sandbox no los valida).

| Tarjeta          | Número                | Código de resultado | CVV    | Vencimiento |
| ---------------- | --------------------- | ------------------- | ------ | ----------- |
| Visa             | `4509 9535 6623 3704` | `APRO`              | `123`  | `11/25`     |
| Mastercard       | `5031 7557 3453 0604` | `OTHE`              | `123`  | `11/25`     |
| American Express | `3711 8030 3257 522`  | `CONT`              | `1234` | `11/25`     |

El código de resultado simula el desenlace del pago:

- `APRO` — pago aprobado
- `OTHE` — rechazado / otro medio de pago
- `CONT` — pendiente de aprobación

### Multi-tenant local

```bash
# Usar lvh.me para probar resolución de tenant
tenant1.lvh.me:3000
```

---

## Redis (carrito)

El carrito anónimo persiste en Redis vía ioredis. **Hay dos variables distintas, no confundir:**

| Variable                                            | Cliente                       | Uso                                                                                   |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `REDIS_URL`                                         | ioredis (`rediss://...:6379`) | **El carrito** (`@repo/commerce/redis.ts`). Es la que importa. Sensible a mayúsculas. |
| `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` | REST HTTP                     | Legacy/validación de producción. **No** usada por el carrito.                         |

⚠️ **Trap de `isProduction` en `packages/validation/src/env.ts`:** si `NODE_ENV=production` y está presente cualquiera de (`UPSTASH_REDIS_REST_URL`, `RESEND_API_KEY`, `R2_*`), el schema de producción **exige todas** las cloud vars — falta alguna → la app no arranca. El carrito solo necesita `REDIS_URL` (que no dispara `isProduction`), así que **no hace falta** agregar `UPSTASH_*` si no están las demás vars de producción.

---

## E2E (Playwright)

- Config en la raíz: `playwright.config.ts` (6 projects, `storageState` para admin/superadmin vía `global-setup.ts`).
- Specs en `e2e/` (storefront, checkout, admin, superadmin, security, webhook) — 15 specs.
- Env vars (ver `.env.local.example`): `E2E_STOREFRONT_URL`, `E2E_STOREFRONT_T2_URL`, `E2E_ADMIN_URL`, `E2E_SUPERADMIN_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD`.
- GitHub Secrets del workflow: `NEON_DATABASE_URL` (owner, solo seed) y `NEON_DATABASE_APP_URL` (rol `app_user`, usado por T11 RLS).
- CI: `.github/workflows/e2e.yml` — corre en **runner self-hosted** (AlmaLinux). Requisitos del runner:
- Egress TCP a Neon (puerto 5432, IPv4 o IPv6) y red a los 3 dominios Vercel.
   - Si el host no tiene ruta IPv6, pin IPv4 del endpoint Neon en `/etc/hosts` (ver procedimiento completo abajo).
   - **Egress 5432 por firewall del host:** el runner actual (`mj20`) tiene firewall **nftables con front-end iptables-nft**, `policy drop` en la cadena OUTPUT con allowlist de puertos egress fijos (incluye 22/80/443 pero *no* 5432). `firewalld` está `masked`. Si el SYN a Neon 5432 da "Connection refused" desde el runner pero la IP responde desde otro host, falta abrir el egress (incidente 2026-09-17):
   ```bash
   iptables -I OUTPUT 1 -p tcp --dport 5432 -j ACCEPT
   # y persistir en el ruleset que carga en boot (/etc/nftables.conf con nftables.service,
   # o la regla equivalente en nft puro):
   # nft insert rule ip filter OUTPUT oifname != "lo" ip protocol tcp ct state new tcp dport 5432 accept
   ```
   Verificar con `timeout 3 bash -c 'echo >/dev/tcp/<IP-neon>/5432'` → `5432 OPEN`.
  - Libs de sistema de Chromium instaladas vía `dnf` (nss, atk, at-spi2-atk, cups-libs, libdrm, libxkbcommon, libXcomposite, libXdamage, libXfixes, libXrandr, mesa-libgbm, alsa-lib, pango, cairo, gtk3).
  - Guard anti-fork: los jobs se saltan PRs de forks (repo público + runner self-hosted = riesgo RCE).

### Runner self-hosted: pin IPv4 de Neon

El runner self-hosted no tiene ruta IPv6. El endpoint de Neon publica registros `AAAA` además de `A`, y el rollback del resolver puede devolver la IP IPv6 → el egress TCP a Neon en 5432 falla (`ECONNREFUSED`) aunque el host tenga IPv4. La mitigación es pin de la IPv4 del endpoint en `/etc/hosts` del runner.

1. **Resolver la IP IPv4 actual del endpoint.** El host del endpoint se ve en el dashboard de Neon (al crear un restore/branch), con formato `ep-xxxxxxxx.c-X.<region>.aws.neon.tech` (ej: `xxxxxxxx.eu-central-1.aws.neon.tech`):

   ```bash
   dig +short A <host-neon>
   # o bien
   getent ahostsv4 <host-neon>
   ```

2. **Aplicar el pin** (root/sudo). Verificar primero el estado actual del archivo y luego agregar la línea con la IP IPv4 obtenida:

   ```bash
   cat /etc/hosts
   echo "<IP-IPv4> <host-neon>" >> /etc/hosts
   ```

3. **Verificar conectividad:**

   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   # o corriendo el E2E del webhook:
   pnpm test:e2e
   ```

4. **Alternativa robusta:** si el proyecto Neon lo soporta, usar un endpoint **IPv4-only** o una IP allowlist del pool del proyecto, que elimina la dependencia de `/etc/hosts`.

5. **Mantenimiento:** las IPs del pool de Neon pueden rotar. Si el endpoint deja de responder y reaparece el problema de IPv6, hay que actualizar el pin (mantenimiento mensual o migrar a la alternativa IPv4-only). El pin es por máquina: replicar en cada runner.

## Nota

Última actualización: 12 de agosto de 2026 – Release v0.9.0 (430 tests, 15 specs E2E, factory de health check, E2E Playwright con CI self-hosted, sección Redis agregada). Rama `main`. Build limpio.

Release v0.10.0 (2026-09-17) — Modernización stack (TS6, Next 16.3.5, ioredis 6, vitest 5) + docs/deuda. 430 tests, 55 archivos. Ramas main + develop.

Actualización 20 de septiembre de 2026 – 464 tests, 15 specs E2E (post T6 + migración 0013). Rama `develop`.

Actualización 24 de septiembre de 2026 – 474 tests, 57 archivos, T11/T13 y 0015 preparada. Rama `chore/close-fase1`.

## URLs de producción (Vercel)

| App        | URL                                               |
| ---------- | ------------------------------------------------- |
| Superadmin | https://landaetastudio-saas-superadmin.vercel.app |
| Admin      | https://saas-admin-sable.vercel.app               |
| Storefront | https://landaetastudio-saas-storefront.vercel.app |

## Health Check / UptimeRobot

Cada app expone un endpoint **público** `GET /api/health` (sin auth) pensado para monitoreo. Creá un monitor **HTTP(S)** en [UptimeRobot](https://uptimerobot.com) por app:

| Monitor    | URL                                                |
| ---------- | -------------------------------------------------- |
| Storefront | `https://tienda1.landaetastudio.com/api/health`    |
| Admin      | `https://admin.landaetastudio.com/api/health`      |
| Superadmin | `https://superadmin.landaetastudio.com/api/health` |

Recomendaciones:

- **Intervalo:** 60 segundos (o el que toleres, hay cuota por plan).
- **Keyword check (opcional):** buscar `"status":"ok"` en la respuesta → alerta si la salud no es óptima. El endpoint responde `503 {"status":"degraded"}` cuando algún check falla.
- **Timeout del monitor:** mayor al timeout interno de cada check (4s por dependencia), por ejemplo 10s.

**Implementación:** los tres endpoints delegan en el factory compartido `createHealthCheckHandler({ appName, hasRedis })` de `@repo/commerce/health` — las routes solo delegan.

**Qué valida cada endpoint (sin requerir sesión):**

- **DB:** `SELECT 1` (`db.execute` directo, sin `withTenantContext` — no toca tablas RLS). Timeout 4s → `"error"`.
- **Redis:** `redisPing()` solo en storefront (`hasRedis: true` en `createHealthCheckHandler`) y si `REDIS_URL` está configurada; `"skipped"` en cualquier otro caso (admin/superadmin no tocan Redis). Timeout 4s → `"error"`.
- **MercadoPago:** `"ok"` si `MERCADOPAGO_ACCESS_TOKEN`; `"missing"` si no → 503.

En storefront, `/api/health` está excluida del matcher del proxy multi-tenant para evitar el 404 por resolución de tenant (ver `apps/storefront/proxy.ts`).

## Deploy en Vercel

Cada app es un proyecto independiente en Vercel conectado al mismo repositorio.

### Configuración por proyecto

| App        | Root Directory    | Build Command                                    |
| ---------- | ----------------- | ------------------------------------------------ |
| Storefront | `apps/storefront` | `cd ../.. && pnpm run build --filter=storefront` |
| Admin      | `apps/admin`      | `cd ../.. && pnpm run build --filter=admin`      |
| Superadmin | `apps/superadmin` | `cd ../.. && pnpm run build --filter=superadmin` |

Cada proyecto tiene su propio `vercel.json` en la carpeta de la app correspondiente.

### Variables de entorno en Vercel

Todas las variables cloud deben estar configuradas en cada proyecto:

- `DATABASE_URL`, `DATABASE_APP_URL`, `AUTH_SECRET` (core, obligatorias en todos)
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
- `MP_TOKEN_ENCRYPTION_KEY` (misma clave en las 3 apps, obligatoria en todos los entornos)
- `MP_PLATFORM_ACCESS_TOKEN`, `MP_PLATFORM_WEBHOOK_SECRET` (opcionales hasta Fase 2)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL` (ioredis — storefront)
- `RESEND_API_KEY`
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `STOREFRONT_URL` (solo validación — inerte en storefront: las URLs públicas se derivan del request)
- `SUPERADMIN_HOST`, `ADMIN_HOST`, `DEFAULT_TENANT_SLUG`

### turbo.json

Las env vars deben estar declaradas en `turbo.json` > `tasks.build.env` para que Turbo 2 las exponga durante el build. Si agregás una variable nueva en Vercel, agregala también en `turbo.json`.

## Variables de entorno adicionales

- `SUPERADMIN_HOST` — dominio del superadmin en Vercel
- `ADMIN_HOST` — dominio del admin en Vercel
- `DEFAULT_TENANT_SLUG` — tenant por defecto para el storefront (tienda1)
