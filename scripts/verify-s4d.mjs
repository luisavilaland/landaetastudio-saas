/**
 * Harness de verificacion del gate de S4d.
 *
 * Levanta apps/admin con `pnpm start` (build de produccion) detras de un proxy
 * HTTPS local con certificado self-signed, para que el navegador acepte la
 * cookie `__Secure-authjs.session-token-admin` como en produccion. Si ya hay un
 * server levantado, `VERIFY_NO_SERVER=1` evita arrancar nada.
 *
 * Valida: gate de dashboard/suspended, cookie de sesion, header
 * `x-panel-access`, guard de API, logout y una prueba de sanidad del harness.
 *
 * Requisitos:
 * - Una base con los 3 tenants de S4d. Crearlos con:
 *     node scripts/seed-s4d-tests.mjs        (ver PR #313)
 * - Variables de entorno requeridas:
 *     DATABASE_URL
 *     DATABASE_APP_URL
 *     SEED_ALLOWED_HOST       (hostname exacto de la rama de Neon)
 *     S4D_ACTIVE_PASS
 *     S4D_SUSP_SUB_PASS
 *     S4D_SUSP_NOSUB_PASS
 * - Opcionales:
 *     VERIFY_BASE_URL        (default https://localhost:3443 si el harness
 *                             arranca el server; http://localhost:3001 con
 *                             VERIFY_NO_SERVER=1; host localhost o 127.0.0.1)
 *     VERIFY_NO_SERVER       (1 = no arrancar apps/admin, usar el que ya corre)
 *     ALLOW_REMOTE_VERIFY    (true = permitir VERIFY_BASE_URL fuera de localhost)
 *
 * El certificado self-signed se genera con PowerShell (New-SelfSignedCertificate),
 * asi que el arranque con TLS requiere Windows. En otra plataforma usar
 * VERIFY_NO_SERVER=1 con un server ya levantado.
 *
 * Aborta si los hosts de DB no coinciden con SEED_ALLOWED_HOST, si apuntan a
 * produccion, o si VERIFY_BASE_URL no es local.
 *
 * Uso:
 *   node scripts/verify-s4d.mjs
 */

import { spawn, spawnSync, execSync, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

import { abort, assertSafeEnv } from './lib/env-guards.mjs'

const STARTS_SERVER = process.env.VERIFY_NO_SERVER !== '1'
const DEFAULT_BASE_URL = STARTS_SERVER
  ? 'https://localhost:3443'
  : 'http://localhost:3001'
const BASE_URL = (process.env.VERIFY_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/+$/,
  '',
)
// Se neutralizan las credenciales de servicios externos para que el harness no
// pueda llamar a un servicio real aunque el `.env.local` del entorno tenga las
// de produccion.
// Se preservan a proposito DATABASE_URL y DATABASE_APP_URL (son la base bajo
// prueba), AUTH_SECRET y MP_TOKEN_ENCRYPTION_KEY (claves internas que no llaman
// a ningun servicio; reemplazarlas romperia la validacion de entorno sin
// aportar aislamiento).
const NEUTRALIZED_ENV = {
  R2_ENDPOINT: 'https://invalid.test',
  R2_ACCESS_KEY_ID: 'fake-access-key',
  R2_SECRET_ACCESS_KEY: 'fake-secret-key',
  R2_BUCKET_NAME: 'fake-bucket',
  MINIO_ENDPOINT: 'localhost.invalid',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'fake-minio-access',
  MINIO_SECRET_KEY: 'fake-minio-secret',
  MINIO_BUCKET: 'fake-bucket',
  MINIO_USE_SSL: 'false',
  RESEND_API_KEY: 're_fake_key',
  RESEND_FROM_EMAIL: 'noreply@invalid.test',
  MERCADOPAGO_ACCESS_TOKEN: 'fake-mp-token',
  MERCADOPAGO_WEBHOOK_SECRET: 'fake-mp-secret',
  MP_PLATFORM_ACCESS_TOKEN: 'fake-mp-platform-token',
  MP_PLATFORM_WEBHOOK_SECRET: 'fake-mp-platform-secret',
  STOREFRONT_URL: 'https://storefront.invalid',
  REDIS_URL: 'redis://127.0.0.1:6399',
  UPSTASH_REDIS_REST_URL: 'https://fake.upstash.invalid',
  UPSTASH_REDIS_REST_TOKEN: 'fake-upstash-token',
  SENTRY_DSN: 'https://fake@sentry.invalid/1',
  NEXT_PUBLIC_SENTRY_DSN: 'https://fake@sentry.invalid/1',
  // Un token vacio desactiva el upload de source maps de Sentry; un token falso
  // no vacio intentaria subir a un proyecto real y podria romper el build.
  SENTRY_AUTH_TOKEN: '',
}

const SERVER_ENV = {
  ...process.env,
  AUTH_TRUST_HOST: 'true',
  AUTH_URL: BASE_URL,
  NEXTAUTH_URL: BASE_URL,
  ...NEUTRALIZED_ENV,
}
const PROD_SESSION_COOKIE = '__Secure-authjs.session-token-admin'
const NEXT_PORT = 3001
const PROXY_PORT = 3443
const TIMEOUT_MS = 45_000
const SANITY_TIMEOUT_MS = 8_000
const WARMUP_TIMEOUT_MS = 60_000
const WARMUP_WRONG_PASSWORD = 'warmup-deliberately-wrong'

const EMAILS = {
  ACTIVE: 's4d-test-active@test.invalid',
  SUSP_SUB: 's4d-test-susp-sub@test.invalid',
  SUSP_NOSUB: 's4d-test-susp-nosub@test.invalid',
}

const results = []

// ---------------------------------------------------------------------------
// Guardas: DB segura y server local. Corren antes de arrancar el servidor.
// ---------------------------------------------------------------------------

let env
try {
  env = assertSafeEnv({ requireAllowSeed: false })
} catch (error) {
  abort(error instanceof Error ? error.message : String(error))
}

console.log(`DB host: ${env.allowedHost}`)

let baseUrlHost
try {
  baseUrlHost = new URL(BASE_URL).hostname
} catch {
  abort('VERIFY_BASE_URL no es una URL valida')
}

if (
  baseUrlHost !== 'localhost' &&
  baseUrlHost !== '127.0.0.1' &&
  process.env.ALLOW_REMOTE_VERIFY !== 'true'
) {
  abort(
    `VERIFY_BASE_URL apunta a ${baseUrlHost}. Solo se permite localhost o 127.0.0.1; para un host remoto exportá ALLOW_REMOTE_VERIFY=true.`,
  )
}

const isLocalHost = ['localhost', '127.0.0.1'].includes(baseUrlHost)

const credentials = {
  ACTIVE: process.env.S4D_ACTIVE_PASS,
  SUSP_SUB: process.env.S4D_SUSP_SUB_PASS,
  SUSP_NOSUB: process.env.S4D_SUSP_NOSUB_PASS,
}

const missingCredentials = Object.entries(credentials)
  .filter(([, password]) => !password)
  .map(([key]) => `S4D_${key}_PASS`)

if (missingCredentials.length > 0) {
  abort(`faltan credenciales en el entorno: ${missingCredentials.join(', ')}`)
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

const serverLog = []
let serverProcess = null

function startServer() {
  const child = spawn('pnpm', ['start'], {
    cwd: 'apps/admin',
    shell: true,
    env: SERVER_ENV,
    // Permite matar el grupo con process.kill(-pid) fuera de Windows.
    detached: process.platform !== 'win32',
  })

  child.stdout.on('data', (chunk) => serverLog.push(chunk.toString()))
  child.stderr.on('data', (chunk) => serverLog.push(chunk.toString()))

  return child
}

function buildAdmin() {
  const result = spawnSync('pnpm', ['build'], {
    cwd: 'apps/admin',
    shell: true,
    stdio: 'inherit',
    env: SERVER_ENV,
  })

  if (result.status !== 0) {
    abort(
      `pnpm build fallo en apps/admin (status ${result.status ?? 'desconocido'}). No se arranca el server.`,
    )
  }
}

function printBuildId() {
  try {
    const buildId = fs
      .readFileSync(path.join('apps/admin', '.next', 'BUILD_ID'), 'utf8')
      .trim()
    console.log(`BUILD_ID: ${buildId || '(no disponible)'}`)
  } catch {
    console.log('BUILD_ID: (no disponible)')
  }
}

function lastServerLines(count) {
  return serverLog
    .join('')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-count)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function httpsStatus(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const request = https.request(
      url,
      { rejectUnauthorized: !isLocalHost, timeout: timeoutMs },
      (response) => {
        response.resume()
        resolve(response.statusCode ?? 0)
      },
    )
    request.on('error', () => resolve(0))
    request.on('timeout', () => {
      request.destroy()
      resolve(0)
    })
    request.end()
  })
}

async function loginStatus() {
  if (BASE_URL.startsWith('https://')) {
    return httpsStatus(`${BASE_URL}/login`)
  }
  try {
    const response = await fetch(`${BASE_URL}/login`)
    return response.status
  } catch {
    return 0
  }
}

async function waitForServer(timeoutMs = 180_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if ((await loginStatus()) === 200) return
    await delay(1000)
  }
  throw new Error(`El servidor no respondio en ${timeoutMs / 1000}s`)
}

function killServer(child) {
  if (!child || child.pid === undefined) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(-child.pid)
    }
  } catch {
    // Ya estaba muerto o el arbol ya se cerro.
  }
}

// ---------------------------------------------------------------------------
// TLS local: el build elige cookies __Secure- segun NODE_ENV, y el navegador
// solo las acepta sobre HTTPS. El proxy sirve un cert self-signed.
// ---------------------------------------------------------------------------

function runPowerShell(script) {
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
  })
}

function removeCertFromStore(thumbprint) {
  if (!thumbprint || process.platform !== 'win32') return
  try {
    runPowerShell(
      `Remove-Item -Path "Cert:\\CurrentUser\\My\\${thumbprint}" -Force -ErrorAction SilentlyContinue`,
    )
  } catch {
    // El cert ya no estaba en el store.
  }
}

function generateCert() {
  if (process.platform !== 'win32') {
    abort(
      'generateCert requiere Windows (New-SelfSignedCertificate). En otra plataforma usá VERIFY_NO_SERVER=1 con un server ya levantado.',
    )
  }

  const passphrase = crypto.randomBytes(18).toString('base64url')
  const pfxPath = path.join(os.tmpdir(), `s4d-verify-${Date.now()}.pfx`)

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$cert = New-SelfSignedCertificate -DnsName @('localhost','127.0.0.1') -CertStoreLocation 'Cert:\\CurrentUser\\My' -FriendlyName 's4d-verify' -KeyExportPolicy Exportable -NotAfter (Get-Date).AddDays(1)",
    'Write-Output $cert.Thumbprint',
    `$pwd = ConvertTo-SecureString -String '${passphrase}' -AsPlainText -Force`,
    `Export-PfxCertificate -Cert $cert -FilePath '${pfxPath}' -Password $pwd | Out-Null`,
  ].join('; ')

  try {
    const output = runPowerShell(script)
    const match = output.match(/[0-9A-F]{40}/i)
    if (!match) {
      throw new Error('No se pudo leer el thumbprint del certificado')
    }
    return { pfxPath, passphrase, thumbprint: match[0] }
  } catch (error) {
    // Si el cert se creo antes de fallar el export, sacarlo del store.
    const stdout =
      error && typeof error.stdout === 'string' ? error.stdout : ''
    const match = stdout.match(/[0-9A-F]{40}/i)
    if (match) removeCertFromStore(match[0])
    throw error
  }
}

function startTlsProxy(pfxPath, passphrase) {
  const server = https.createServer(
    { pfx: fs.readFileSync(pfxPath), passphrase },
    (request, response) => {
      const upstream = http.request(
        {
          hostname: '127.0.0.1',
          port: NEXT_PORT,
          path: request.url,
          method: request.method,
          headers: {
            ...request.headers,
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'localhost:3443',
          },
        },
        (upstreamResponse) => {
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            upstreamResponse.headers,
          )
          upstreamResponse.pipe(response)
        },
      )

      upstream.on('error', (error) => {
        if (!response.headersSent) {
          response.writeHead(502, { 'content-type': 'text/plain' })
        }
        response.end(`proxy error: ${error.message}`)
      })

      request.pipe(upstream)
    },
  )

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PROXY_PORT, '127.0.0.1', () => resolve(server))
  })
}

async function closeProxy(server) {
  if (!server) return
  try {
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
  } catch {
    // Ya estaba cerrado.
  }
}

function deleteFile(filePath) {
  if (!filePath) return
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // Best effort.
  }
}

// ---------------------------------------------------------------------------
// Helpers de navegacion
// ---------------------------------------------------------------------------

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
}

async function waitForUrl(page, predicate, timeoutMs = TIMEOUT_MS) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const currentUrl = page.url()
    let pathname = currentUrl
    try {
      pathname = new URL(currentUrl).pathname
    } catch {
      // Todavia no es una URL parseable: seguimos esperando.
    }
    if (predicate(pathname)) return { matched: true, url: currentUrl }
    await delay(200)
  }
  return { matched: false, url: page.url() }
}

async function collectDiagnostics(page) {
  let url = '(sin url)'
  let bodyText = '(sin body)'
  let formError = 'sin error visible'

  try {
    url = page.url()
  } catch {
    // Page ya cerrada.
  }

  try {
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    bodyText = text.replace(/\s+/g, ' ').trim().slice(0, 200) || '(vacio)'
  } catch {
    // Page ya cerrada.
  }

  try {
    const errorLocator = page
      .getByText(/Credenciales inválidas|Error al iniciar sesión/i)
      .first()
    if (await errorLocator.isVisible().catch(() => false)) {
      formError = (await errorLocator.innerText()).replace(/\s+/g, ' ').trim()
    }
  } catch {
    // Sin div de error.
  }

  return `url=${url} | formError=${formError} | body=${bodyText}`
}

async function attempt(page, fn) {
  try {
    const detail = await fn()
    return { result: 'PASS', detail: detail ?? '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const diagnostics = await collectDiagnostics(page)
    return { result: 'FAIL', detail: `${message} | ${diagnostics}` }
  }
}

async function withNewPage(browser, fn) {
  const context = await browser.newContext({ ignoreHTTPSErrors: isLocalHost })
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)
  try {
    return await attempt(page, () => fn(page))
  } finally {
    await context.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Warm-up
// ---------------------------------------------------------------------------

async function warmUp(browser) {
  const context = await browser.newContext({ ignoreHTTPSErrors: isLocalHost })
  const page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)

  try {
    // Item 129: la primera query despierta la rama de Neon (cold start). Una
    // password incorrecta a proposito ejecuta la query sin crear sesion.
    await login(page, EMAILS.ACTIVE, WARMUP_WRONG_PASSWORD)

    // Solo sincroniza: espera a que el request de auth termine. No afirma que
    // la DB se haya despertado; el texto de error aparece fria o caliente.
    const errorLocator = page
      .getByText(/Credenciales inválidas|Error al iniciar sesión/i)
      .first()
    const startedAt = Date.now()
    while (Date.now() - startedAt < WARMUP_TIMEOUT_MS) {
      if (await errorLocator.isVisible().catch(() => false)) {
        break
      }
      await delay(500)
    }

    console.log(
      'Warm-up: login con password incorrecta enviado (no verifica el estado de la DB, solo fuerza la query)',
    )
  } catch {
    // El warm-up no es parte de la suite: si falla, se sigue igual.
  } finally {
    await context.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

async function loginFlow(page, email, password, expectedPath) {
  await login(page, email, password)
  const { matched, url } = await waitForUrl(page, (pathname) =>
    pathname.includes(expectedPath),
  )
  if (!matched) {
    throw new Error(`No llego a ${expectedPath}. URL final: ${url}`)
  }
  return `login -> ${new URL(url).pathname}`
}

async function activeHeaderFlow(page) {
  const response = await page.request.get(`${BASE_URL}/api/products`)
  const status = response.status()
  const header = response.headers()['x-panel-access']

  if (status !== 200 || header !== 'full') {
    throw new Error(
      `status ${status} x-panel-access=${header ?? '(ausente)'}`,
    )
  }

  return '200 x-panel-access=full'
}

async function apiGuardFlow(page) {
  const response = await page.request.get(`${BASE_URL}/api/products`)
  const status = response.status()
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  const passed =
    status === 403 &&
    body !== null &&
    typeof body === 'object' &&
    body.field === 'account'

  if (!passed) {
    throw new Error(`status ${status} body ${JSON.stringify(body)}`)
  }

  return '403 field=account'
}

async function logoutFlow(page) {
  await page.getByRole('button', { name: /Cerrar sesi/i }).click()
  const { matched, url } = await waitForUrl(page, (pathname) =>
    pathname.includes('/login'),
  )
  if (!matched) {
    throw new Error(`No llego a /login. URL final: ${url}`)
  }
  return `logout -> ${new URL(url).pathname}`
}

async function sanityFlow(page) {
  // El harness tiene que saber fallar: con credenciales ACTIVE no debe llegar
  // a /suspended. Si llegara, la expectativa del test seria falsa.
  await login(page, EMAILS.ACTIVE, credentials.ACTIVE)

  // Una URL distinta de /login no prueba autenticacion: /api/auth/error
  // tambien la cumple. Exigimos una sesion real con el email ACTIVE.
  const authStartedAt = Date.now()
  let sessionEmail = null
  while (Date.now() - authStartedAt < 20_000) {
    try {
      const response = await page.request.get(`${BASE_URL}/api/auth/session`)
      const body = await response.json()
      sessionEmail = body?.user?.email ?? null
      if (sessionEmail === EMAILS.ACTIVE) break
    } catch {
      sessionEmail = null
    }
    await delay(300)
  }

  if (sessionEmail !== EMAILS.ACTIVE) {
    throw new Error(
      `SANITY no pudo autenticarse (URL: ${page.url()}, session: ${sessionEmail ? 'otro email' : 'sin user'})`,
    )
  }

  const { matched } = await waitForUrl(
    page,
    (pathname) => pathname.includes('/suspended'),
    SANITY_TIMEOUT_MS,
  )
  if (matched) {
    throw new Error('el harness aceptaria una expectativa falsa')
  }
  return 'sesion valida, no llego a /suspended'
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

async function runAll(browser) {
  const activeContext = await browser.newContext({ ignoreHTTPSErrors: isLocalHost })
  const activePage = await activeContext.newPage()
  activePage.setDefaultTimeout(TIMEOUT_MS)

  // El contexto de SUSP_SUB se reutiliza en API_GUARD y LOGOUT.
  const suspContext = await browser.newContext({ ignoreHTTPSErrors: isLocalHost })
  const suspPage = await suspContext.newPage()
  suspPage.setDefaultTimeout(TIMEOUT_MS)

  try {
    results.push({
      name: 'ACTIVE',
      ...(await attempt(activePage, () =>
        loginFlow(activePage, EMAILS.ACTIVE, credentials.ACTIVE, '/dashboard'),
      )),
    })

    results.push({
      name: 'SESSION_COOKIE',
      ...(await attempt(activePage, async () => {
        const cookies = await activeContext.cookies()
        const sessionCookie = cookies.find(
          (cookie) => cookie.name === PROD_SESSION_COOKIE,
        )
        if (!sessionCookie || sessionCookie.secure !== true) {
          const names = cookies.map((cookie) => cookie.name).join(', ')
          throw new Error(`cookies presentes: ${names || '(ninguna)'}`)
        }
        return `${PROD_SESSION_COOKIE} secure=true`
      })),
    })

    results.push({
      name: 'ACTIVE_HEADER',
      ...(await attempt(activePage, () => activeHeaderFlow(activePage))),
    })

    results.push({
      name: 'SUSP_SUB',
      ...(await attempt(suspPage, () =>
        loginFlow(
          suspPage,
          EMAILS.SUSP_SUB,
          credentials.SUSP_SUB,
          '/suspended',
        ),
      )),
    })

    results.push({
      name: 'SUSP_NOSUB',
      ...(await withNewPage(browser, (page) =>
        loginFlow(
          page,
          EMAILS.SUSP_NOSUB,
          credentials.SUSP_NOSUB,
          '/suspended',
        ),
      )),
    })

    results.push({
      name: 'API_GUARD',
      ...(await attempt(suspPage, () => apiGuardFlow(suspPage))),
    })

    results.push({
      name: 'LOGOUT',
      ...(await attempt(suspPage, () => logoutFlow(suspPage))),
    })

    results.push({
      name: 'SANITY',
      ...(await withNewPage(browser, sanityFlow)),
    })
  } finally {
    await activeContext.close().catch(() => {})
    await suspContext.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------

function printResults() {
  const testWidth = Math.max('TEST'.length, ...results.map((r) => r.name.length))
  const resultWidth = 'RESULT'.length

  console.log('')
  console.log(
    `${'TEST'.padEnd(testWidth)} | ${'RESULT'.padEnd(resultWidth)} | DETALLE`,
  )
  console.log(
    `${'-'.repeat(testWidth)}-+-${'-'.repeat(resultWidth)}-+--------`,
  )
  for (const row of results) {
    console.log(
      `${row.name.padEnd(testWidth)} | ${row.result.padEnd(resultWidth)} | ${row.detail}`,
    )
  }

  const passed = results.filter((row) => row.result === 'PASS').length
  console.log(`\nPASS ${passed}/${results.length}`)

  const failed = results.filter((row) => row.result === 'FAIL').length
  if (failed > 0) {
    console.log('\n--- SERVER LOG (últimas 40) ---')
    const lines = lastServerLines(40)
    if (lines.length === 0) {
      console.log('(buffer del servidor vacio)')
    } else {
      for (const line of lines) {
        console.log(line)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight: las credenciales del env tienen que existir y matchear en la DB
// que el harness cree que esta usando.
// ---------------------------------------------------------------------------

async function preflight() {
  const ownerPath = new URL(env.ownerUrl).pathname
  const appPath = new URL(env.appUrl).pathname
  const dbMismatch = ownerPath !== appPath

  console.log(
    `Preflight DB: db_owner=${ownerPath} db_app=${appPath} db_mismatch=${dbMismatch}`,
  )

  const sql = postgres(env.ownerUrl, {
    max: 1,
    ssl: 'require',
    connect_timeout: 15,
  })

  const checks = []
  try {
    for (const key of ['ACTIVE', 'SUSP_SUB', 'SUSP_NOSUB']) {
      const email = EMAILS[key]
      const [row] = await sql`
        SELECT password FROM admin_users WHERE email = ${email}
      `
      const found = Boolean(row)
      const match = found
        ? await bcrypt.compare(credentials[key], row.password)
        : false
      checks.push({ email, found, match })
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {})
  }

  console.log('')
  console.log('EMAIL | found | match')
  for (const check of checks) {
    console.log(
      `${check.email} | found=${check.found} | match=${check.match}`,
    )
  }

  const failed = checks.filter((check) => !check.found || !check.match)
  if (failed.length > 0) {
    for (const check of failed) {
      if (!check.found) {
        console.error(
          `Preflight: ${check.email} found=false -> la app/seed no apuntan a la misma base o el usuario no existe.`,
        )
      } else {
        console.error(
          `Preflight: ${check.email} match=false -> la password del env no es la del hash guardado.`,
        )
      }
    }
    abort(
      `preflight fallo (${failed.length} de 3). No se corren los tests.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let browser
  let serverReady = false
  let tlsProxy = null
  let certInfo = null

  try {
    await preflight()
  } catch (error) {
    abort(error instanceof Error ? error.message : String(error))
  }

  try {
    if (process.env.VERIFY_NO_SERVER === '1') {
      console.log(`Server: usando ${BASE_URL} (VERIFY_NO_SERVER=1)`)
      printBuildId()
      serverReady = true
    } else {
      console.log(
        `Entorno del server: ${Object.keys(NEUTRALIZED_ENV).length} variables externas neutralizadas -> ${Object.keys(NEUTRALIZED_ENV).join(', ')}`,
      )
      buildAdmin()
      printBuildId()
      certInfo = generateCert()
      tlsProxy = await startTlsProxy(certInfo.pfxPath, certInfo.passphrase)
      serverProcess = startServer()
      await waitForServer()
      serverReady = true
      console.log(`Server: ${BASE_URL}`)
    }

    browser = await chromium.launch()
    await warmUp(browser)
    await runAll(browser)
    printResults()

    const passed = results.filter((row) => row.result === 'PASS').length
    process.exitCode =
      results.length > 0 && passed === results.length ? 0 : 1
  } catch (error) {
    if (!serverReady) {
      console.error('ABORT: el servidor no levanto a tiempo')
      for (const line of lastServerLines(40)) {
        console.error(line)
      }
    } else {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`ERROR: ${message}`)
    }
    process.exitCode = 1
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
    if (tlsProxy) {
      await closeProxy(tlsProxy)
    }
    if (serverProcess) {
      killServer(serverProcess)
    }
    if (certInfo) {
      deleteFile(certInfo.pfxPath)
      removeCertFromStore(certInfo.thumbprint)
    }
  }
}

main()
