import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mockReq } from '@repo/test-utils'

/**
 * Test de integracion REAL de `POST /api/register-tenant` (S3 / T7).
 *
 * ## Capas: por que UNA sola, y por que alcanza
 *
 * A diferencia del test de `transitionSubscription` (que necesita dos capas
 * porque RLS enmascaraba el `WHERE`), este endpoint tiene una sola capa y no
 * necesita la segunda por una razon distinta: **`tenants` no tiene RLS** (tabla
 * raiz; el checklist del repo lo prohibe sin `tenantId` + policy), asi que no hay
 * mascara que quitar. `admin_users` tampoco tiene RLS por diseno. Lo que si
 * tiene RLS es `subscriptions`, y ahi el test verifica el resultado observable
 * de la transaccion, no un `WHERE` escrito a mano.
 *
 * La mascara real de este test es otra y hay que nombrarla: **si el endpoint
 * dejara de insertar la fila de `admin_users`, el test T7.1 lo detectaria**, pero
 * uno que solo mirara el status 201 pasaria. Por eso el happy path afirma sobre
 * las **tres** filas, no sobre el codigo de respuesta.
 *
 * ## Aislamiento y limpieza
 *
 * Los tenants se crean con slug unico y se borran en `afterAll`. El borrado va
 * en cascada a `subscriptions` (`onDelete: 'cascade'` desde tenant). `admin_users`
 * **no** tiene cascada desde tenant: su FK es `onDelete: 'set null'`, asi que
 * borrar el tenant dejaria el `admin_user` huerfano con el email global tomado.
 * Por eso se borran explicitamente, y en ese orden.
 *
 * NOTA sobre imports: `@repo/db` y la ruta lanzan al cargar si falta la config,
 * asi que se importan dentro de `beforeAll`. Arriba solo hay imports que no
 * ejecutan codigo de la base.
 */

type RouteModule = typeof import('../route')
type DbModule = typeof import('@repo/db')

function isUsableUrl(url: string | undefined): url is string {
  if (!url) return false
  if (/localhost|127\.0\.0\.1|dummy/i.test(url)) return false
  return true
}

const ownerUrl = process.env.DATABASE_URL
const canRun = isUsableUrl(ownerUrl)

let ownerClient: ReturnType<typeof postgres>
let POST: RouteModule['POST']
/** Cliente owner para leer y limpiar. Los inserts los hace el endpoint con app_user. */
let dbAdminUsers: DbModule['dbAdminUsers']
let dbTenants: DbModule['dbTenants']

const createdTenantIds: string[] = []
const createdAdminEmails: string[] = []

let planId: string

/** Slug valido y unico por corrida. Nunca colisiona con un reservado. */
function uniqueSlug(prefix = 's3'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function uniqueEmail(): string {
  return `${randomUUID()}@test.invalid`
}

async function request(body: Record<string, unknown>) {
  return POST(
    mockReq('POST', body) as unknown as Parameters<RouteModule['POST']>[0],
  )
}

describe.skipIf(!canRun)('POST /api/register-tenant - integracion Neon', () => {
  beforeAll(async () => {
    if (!isUsableUrl(ownerUrl)) {
      throw new Error('DATABASE_URL no utilizable para el test de integracion')
    }
    const db: DbModule = await import('@repo/db')
    dbAdminUsers = db.dbAdminUsers
    dbTenants = db.dbTenants
    ownerClient = postgres(ownerUrl, { max: 1, ssl: 'require' })

    const route: RouteModule = await import('../route')
    POST = route.POST

    // El endpoint devuelve 404 si el plan no existe, asi que hace falta uno real.
    // `plans` es catalogo global y no tiene RLS.
    const plans = await ownerClient<{ id: string }[]>`
      SELECT "id"::text FROM "plans" ORDER BY "id" LIMIT 1
    `
    const plan = plans[0]
    if (!plan)
      throw new Error('No hay planes en la base: el seed no esta cargado')
    planId = plan.id
  })

  afterAll(async () => {
    // `admin_users` primero: su FK a tenant es `set null`, no cascade. Si se
    // borrara el tenant primero, el admin_user quedaria huerfano con el email
    // global tomado y el test siguiente fallaria por un motivo que no es suyo.
    for (const email of createdAdminEmails) {
      await ownerClient`DELETE FROM "admin_users" WHERE "email" = ${email}`
    }
    for (const id of createdTenantIds) {
      await ownerClient`DELETE FROM "tenants" WHERE "id" = ${id}::uuid`
    }
    await ownerClient.end({ timeout: 5 })
  })

  describe('T7.1 happy path', () => {
    it('crea las TRES filas: tenant pending, admin_user role admin y subscription pending_first_payment', async () => {
      const slug = uniqueSlug()
      const email = uniqueEmail()

      const res = await request({
        name: 'Tienda de prueba',
        email,
        password: 'contrasena123',
        slug,
        planId,
      })

      expect(res.status).toBe(201)

      const body = (await res.json()) as { tenantId: string; slug: string }
      expect(body.slug).toBe(slug)
      createdTenantIds.push(body.tenantId)

      // Fila 1: el tenant nace `pending` (D2: el subdominio no resuelve todavia).
      const [tenant] = await ownerClient<{ status: string }[]>`
        SELECT "status"::text FROM "tenants" WHERE "id" = ${body.tenantId}::uuid
      `
      expect(tenant?.status).toBe('pending')

      // Fila 2: la credencial. `role: 'admin'` es el rol de tenant admin en este
      // schema; `authorize()` exige `role === 'admin'` y devolveria null con
      // cualquier otro valor, dejando una cuenta que no puede autenticarse.
      const [adminUser] = await ownerClient<
        { role: string; tenantId: string; hashed: boolean }[]
      >`
        SELECT "role", "tenantId"::text,
               "password" LIKE '$2%' AS "hashed"
        FROM "admin_users" WHERE "email" = ${email}
      `
      createdAdminEmails.push(email)
      expect(adminUser?.role).toBe('admin')
      expect(adminUser?.tenantId).toBe(body.tenantId)
      // El password va hasheado, no en claro. `$2` es el prefijo de bcrypt.
      expect(adminUser?.hashed).toBe(true)

      // Fila 3: la suscripcion pendiente de primer pago.
      const [subscription] = await ownerClient<{ status: string }[]>`
        SELECT "status" FROM "subscriptions" WHERE "tenantId" = ${body.tenantId}::uuid
      `
      expect(subscription?.status).toBe('pending_first_payment')
    })

    it('el password se hashea antes del INSERT: la fila nunca guarda el texto plano', async () => {
      const slug = uniqueSlug()
      const email = uniqueEmail()
      const password = 'contrasena-larga-123'

      const res = await request({
        name: 'Tienda hash',
        email,
        password,
        slug,
        planId,
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { tenantId: string }
      createdTenantIds.push(body.tenantId)
      createdAdminEmails.push(email)

      const rows = await ownerClient<{ password: string }[]>`
        SELECT "password" FROM "admin_users" WHERE "email" = ${email}
      `
      expect(rows[0]?.password).not.toBe(password)
      expect(rows[0]?.password).not.toContain(password)
    })
  })

  describe('T7.2 slug reservado', () => {
    it('devuelve 409 con field slug y NO toca la base', async () => {
      const antes = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "tenants"
      `

      const res = await request({
        name: 'Reservado',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug: 'admin',
        planId,
      })

      expect(res.status).toBe(409)
      const body = (await res.json()) as { field: string; error: string }
      expect(body.field).toBe('slug')

      const despues = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "tenants"
      `
      expect(despues[0]?.n).toBe(antes[0]?.n)
    })

    it('un slug con formato invalido devuelve 400, no 409', async () => {
      const res = await request({
        name: 'Formato',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug: 'Mi Tienda',
        planId,
      })

      expect(res.status).toBe(400)
      const body = (await res.json()) as { field: string }
      expect(body.field).toBe('slug')
    })
  })

  describe('T7.3 slug duplicado', () => {
    it('devuelve 409 con field slug por la violacion de tenants_slug_unique', async () => {
      const slug = uniqueSlug()
      const first = await request({
        name: 'Primera',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug,
        planId,
      })
      expect(first.status).toBe(201)
      const firstBody = (await first.json()) as { tenantId: string }
      createdTenantIds.push(firstBody.tenantId)
      const firstEmail = (
        await ownerClient<{ email: string }[]>`
          SELECT "email" FROM "admin_users" WHERE "tenantId" = ${firstBody.tenantId}::uuid
        `
      )[0]
      if (firstEmail) createdAdminEmails.push(firstEmail.email)

      // Segundo alta con el mismo slug, email distinto.
      const res = await request({
        name: 'Segunda',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug,
        planId,
      })

      expect(res.status).toBe(409)
      const body = (await res.json()) as { field: string; error: string }
      expect(body.field).toBe('slug')
      expect(body.error).toBe('Slug ya existe')
    })
  })

  describe('T7.4 email duplicado (global)', () => {
    it('un email ya usado en el tenant A no puede registrar el tenant B', async () => {
      const email = uniqueEmail()

      const a = await request({
        name: 'Tenant A',
        email,
        password: 'contrasena123',
        slug: uniqueSlug('a'),
        planId,
      })
      expect(a.status).toBe(201)
      const aBody = (await a.json()) as { tenantId: string }
      createdTenantIds.push(aBody.tenantId)
      createdAdminEmails.push(email)

      // Mismo email, slug distinto y otro tenant: el UNIQUE de admin_users es
      // GLOBAL, no por tenant. Sin esto, un usuario tendria dos cuentas.
      const res = await request({
        name: 'Tenant B',
        email,
        password: 'contrasena123',
        slug: uniqueSlug('b'),
        planId,
      })

      expect(res.status).toBe(409)
      const body = (await res.json()) as { field: string; error: string }
      expect(body.field).toBe('email')
      expect(body.error).toBe('Email ya registrado')

      // Y la distincion de constraint importa: el mensaje es "email", no "slug".
      // Con el catch leyendo solo el codigo 23505, los dos casos darian el mismo
      // mensaje y el usuario veria "Slug ya existe" con un slug libre.
    })
  })

  describe('T7.5 plan inexistente', () => {
    it('devuelve 404 y no crea nada', async () => {
      const antes = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "tenants"
      `

      const res = await request({
        name: 'Sin plan',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug: uniqueSlug('np'),
        planId: randomUUID(),
      })

      expect(res.status).toBe(404)

      const despues = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "tenants"
      `
      expect(despues[0]?.n).toBe(antes[0]?.n)
    })
  })

  describe('T7.6 validacion de entrada', () => {
    it.each([
      ['email invalido', { email: 'no-es-email' }],
      ['password corto', { password: 'corto' }],
      ['slug corto', { slug: 'ab' }],
      ['planId no uuid', { planId: 'no-es-uuid' }],
    ])('%s devuelve 400', async (_caso, override) => {
      const res = await request({
        name: 'Validacion',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug: uniqueSlug('v'),
        planId,
        ...override,
      })

      expect(res.status).toBe(400)
    })

    it('no acepta status del cliente: se fuerza pending', async () => {
      // Mandar status desde el request no debe cambiar nada: el backend decide.
      const slug = uniqueSlug('st')
      const email = uniqueEmail()
      const res = await request({
        name: 'Status forzado',
        email,
        password: 'contrasena123',
        slug,
        planId,
        status: 'active',
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { tenantId: string }
      createdTenantIds.push(body.tenantId)
      createdAdminEmails.push(email)

      const [tenant] = await ownerClient<{ status: string }[]>`
        SELECT "status"::text FROM "tenants" WHERE "id" = ${body.tenantId}::uuid
      `
      expect(tenant?.status).toBe('pending')
    })
  })

  describe('T7.7 el slug nunca se reutiliza', () => {
    it('un slug de tenant cancelado sigue dando 409', async () => {
      const slug = uniqueSlug('nr')
      const emailA = uniqueEmail()

      const a = await request({
        name: 'Se cancela',
        email: emailA,
        password: 'contrasena123',
        slug,
        planId,
      })
      expect(a.status).toBe(201)
      const aBody = (await a.json()) as { tenantId: string }
      createdTenantIds.push(aBody.tenantId)
      createdAdminEmails.push(emailA)

      // El tenant se cancela. D8: el slug queda tomado para siempre, porque si
      // se liberara el proximo podria heredar contenido cacheado, enlaces viejos
      // y confianza de un tenant anterior.
      await ownerClient`
        UPDATE "tenants" SET "status" = 'cancelled'::tenants_status
        WHERE "id" = ${aBody.tenantId}::uuid
      `

      // Cancelado o no, el UNIQUE sigue: no hay logica de liberacion.
      const res = await request({
        name: 'Reutiliza',
        email: uniqueEmail(),
        password: 'contrasena123',
        slug,
        planId,
      })

      expect(res.status).toBe(409)
      const body = (await res.json()) as { field: string }
      expect(body.field).toBe('slug')
    })
  })

  describe('aislamiento entre tenants', () => {
    it('el alta de B no toca las filas de A', async () => {
      const slugA = uniqueSlug('ia')
      const emailA = uniqueEmail()
      const resA = await request({
        name: 'A',
        email: emailA,
        password: 'contrasena123',
        slug: slugA,
        planId,
      })
      expect(resA.status).toBe(201)
      const a = (await resA.json()) as { tenantId: string }
      createdTenantIds.push(a.tenantId)
      createdAdminEmails.push(emailA)

      const slugB = uniqueSlug('ib')
      const emailB = uniqueEmail()
      const resB = await request({
        name: 'B',
        email: emailB,
        password: 'contrasena123',
        slug: slugB,
        planId,
      })
      expect(resB.status).toBe(201)
      const b = (await resB.json()) as { tenantId: string }
      createdTenantIds.push(b.tenantId)
      createdAdminEmails.push(emailB)

      // Cada tenant tiene exactamente su suscripcion. Si el INSERT de B hubiera
      // colado en el contexto de A, B tendria dos y A ninguna.
      const [cuentaB] = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "subscriptions" WHERE "tenantId" = ${b.tenantId}::uuid
      `
      const [cuentaA] = await ownerClient<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "subscriptions" WHERE "tenantId" = ${a.tenantId}::uuid
      `
      expect(cuentaB?.n).toBe(1)
      expect(cuentaA?.n).toBe(1)
    })
  })

  describe('las tablas de auth se leen por las columnas reales', () => {
    it('los esquemas usados por el test coinciden con los del repositorio', () => {
      // Guarda contra una futura renombrada de columna: si `dbTenants.slug`
      // dejara de existir, este test lo dice con nombre, no con un error opaco
      // en el primer INSERT.
      expect(dbTenants.slug).toBeDefined()
      expect(dbAdminUsers.email).toBeDefined()
      expect(dbAdminUsers.tenantId).toBeDefined()
    })
  })
})
