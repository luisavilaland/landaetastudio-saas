/**
 * Harness de verificacion del gate de S4d.
 *
 * Levanta apps/admin en 3001 (o usa uno ya corriendo), hace login con los tres
 * tenants de prueba y valida: gate de dashboard/suspended, header
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
 *     VERIFY_BASE_URL        (default http://localhost:3001; host debe ser
 *                             localhost o 127.0.0.1)
 *     VERIFY_NO_SERVER       (1 = no arrancar apps/admin, usar el que ya corre)
 *     ALLOW_REMOTE_VERIFY    (true = permitir VERIFY_BASE_URL fuera de localhost)
 *
 * Aborta si los hosts de DB no coinciden con SEED_ALLOWED_HOST, si apuntan a
 * produccion, o si VERIFY_BASE_URL no es local.
 *
 * Uso:
 *   node scripts/verify-s4d.mjs
 */

import { spawn, execSync } from 'node:child_process'
import process from 'node:process'
import { chromium } from '@playwright/test'

import { abort, assertSafeEnv } from './lib/env-guards.mjs'

const BASE_URL = (process.env.VERIFY_BASE_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
)
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
  const child = spawn('pnpm', ['dev'], {
    cwd: 'apps/admin',
    shell: true,
    env: process.env,
    // Permite matar el grupo con process.kill(-pid) fuera de Windows.
    detached: process.platform !== 'win32',
  })

  child.stdout.on('data', (chunk) => serverLog.push(chunk.toString()))
  child.stderr.on('data', (chunk) => serverLog.push(chunk.toString()))

  return child
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

async function waitForServer(timeoutMs = 180_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/login`)
      if (response.status === 200) return
    } catch {
      // Todavia no acepta conexiones.
    }
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
  const context = await browser.newContext()
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
  const context = await browser.newContext()
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
  const activeContext = await browser.newContext()
  const activePage = await activeContext.newPage()
  activePage.setDefaultTimeout(TIMEOUT_MS)

  // El contexto de SUSP_SUB se reutiliza en API_GUARD y LOGOUT.
  const suspContext = await browser.newContext()
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  let browser
  let serverReady = false

  try {
    if (process.env.VERIFY_NO_SERVER === '1') {
      console.log(`Server: usando ${BASE_URL} (VERIFY_NO_SERVER=1)`)
      serverReady = true
    } else {
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
    process.exitCode = passed === 7 ? 0 : 1
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
    if (serverProcess) {
      killServer(serverProcess)
    }
  }
}

main()
