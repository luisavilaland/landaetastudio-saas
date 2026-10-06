import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbSubscriptions } from '../schema'

/**
 * H1 (auditoria mid-phase #197): `resolve_tenant_by_preapproval` es la unica
 * forma de resolver el tenant de un `mpPreapprovalId` sin contexto de tenant.
 *
 * Estos casos van contra Neon real a proposito. Mockeando `db.execute` se
 * probaria que el handler llamo a un doble, no que la funcion bypasea RLS. El
 * mecanismo vive en PostgreSQL, asi que el test tiene que hablar con
 * PostgreSQL.
 *
 * Chicken-and-egg: `subscriptions` tiene FORCE ROW LEVEL SECURITY y su policy
 * compara contra `current_setting('app.tenant_id', true)::UUID`, asi que el
 * tenant no se puede buscar con el contexto que todavia no se tiene.
 */
interface TenantRow {
  id: string
}

interface ResolveRow {
  tenantId: string | null
}

interface FunctionRow {
  owner: string
  securityDefiner: boolean
  returnType: string
  argCount: number
  config: string[] | null
}

function isUsableUrl(url: string | undefined): url is string {
  if (!url) return false
  if (/localhost|127\.0\.0\.1|dummy/i.test(url)) return false
  return true
}

const appUrl = process.env.DATABASE_APP_URL
const hasAppUrl = isUsableUrl(appUrl)

/**
 * `describe.skipIf` no le da a TypeScript el narrowing de `appUrl`, asi que el
 * narrowing se hace aca. Con `skipIf` los tests se saltean cuando la URL no es
 * usable: nunca se conectan a una base dummy.
 */
function dbUrl(): string {
  if (!appUrl) throw new Error('DATABASE_APP_URL no configurada')
  return appUrl
}

// PREAPPROVAL_ID es unico por corrida: `subscriptions_mp_preapproval_idx` es unico.
const PREAPPROVAL_ID = `h1-test-${randomUUID()}`

let client: ReturnType<typeof postgres> | undefined
let withTenantContext: typeof import('../index')['withTenantContext']
let tenantA: TenantRow
let tenantB: TenantRow
let planId: string

/**
 * Narrowing explicito del cliente. Un non-null assertion inline seguido del
 * parametro de tipo no compila: TypeScript lo parsea como comparacion, no como
 * llamada generica.
 */
function conn(): NonNullable<typeof client> {
  if (!client) throw new Error('El cliente de test no fue inicializado')
  return client
}

async function createTenant(slug: string, name: string): Promise<TenantRow> {
  const rows = await conn()<TenantRow[]>`
    INSERT INTO "tenants" ("slug", "name")
    VALUES (${slug}, ${name})
    RETURNING "id"
  `
  const tenant = rows[0]
  if (!tenant) throw new Error(`No se pudo crear el tenant temporal ${slug}`)
  return tenant
}

async function deleteTenant(tenantId: string): Promise<void> {
  try {
    await withTenantContext(tenantId, async (tx) =>
      tx
        .delete(dbSubscriptions)
        .where(eq(dbSubscriptions.tenantId, tenantId))
        .returning({ id: dbSubscriptions.id }),
    )
    await conn()`DELETE FROM "tenants" WHERE "id" = ${tenantId}::uuid`
  } catch {
    // best effort: el suite no debe fallar en cleanup
  }
}

describe.skipIf(!hasAppUrl)('H1 - resolve_tenant_by_preapproval (SECURITY DEFINER)', () => {
  beforeAll(async () => {

    client = postgres(dbUrl())

    // El mecanismo depende de que la app NO pueda bypasear RLS por su cuenta.
    const roleRows = await conn()<{ bypass: boolean }[]>`
      SELECT rol.rolbypassrls AS "bypass"
      FROM pg_roles AS rol
      WHERE rol.rolname = current_user
    `
    const role = roleRows[0]
    if (!role || role.bypass) {
      throw new Error(
        'DATABASE_APP_URL debe usar un rol sin BYPASSRLS; el caso no seria representativo',
      )
    }

    const dbModule = await import('../index')
    withTenantContext = dbModule.withTenantContext

    const planRows = await conn()<{ id: string }[]>`
      SELECT "id" FROM "plans" WHERE "slug" = 'starter'
    `
    const plan = planRows[0]
    if (!plan) throw new Error("Falta el plan 'starter'; ejecutá el seed primero")
    planId = plan.id

    const suffix = randomUUID().slice(0, 8)
    tenantA = await createTenant(`h1-test-a-${suffix}`, 'H1 test A')
    tenantB = await createTenant(`h1-test-b-${suffix}`, 'H1 test B')

    // La fila que se va a resolver. `subscriptions_tenant_idx` es UNIQUE(tenantId).
    await withTenantContext(tenantA.id, async (tx) =>
      tx.insert(dbSubscriptions).values({
        tenantId: tenantA.id,
        planId,
        status: 'active',
        mpPreapprovalId: PREAPPROVAL_ID,
      }),
    )
  }, 60_000)

  afterAll(async () => {
    await deleteTenant(tenantA?.id ?? '')
    await deleteTenant(tenantB?.id ?? '')
    await client?.end()
  })

  it('1. resuelve el tenantId de un preapprovalId sin contexto de tenant', async () => {

    const rows = await conn()<ResolveRow[]>`
      SELECT resolve_tenant_by_preapproval(${PREAPPROVAL_ID}) AS "tenantId"
    `

    expect(rows[0]?.tenantId).toBe(tenantA.id)
  })

  it('2. devuelve NULL si el preapprovalId no existe', async () => {

    const rows = await conn()<ResolveRow[]>`
      SELECT resolve_tenant_by_preapproval('no-existe-este-preapproval') AS "tenantId"
    `

    expect(rows[0]?.tenantId).toBeNull()
  })

  it('3. desde el contexto de otro tenant devuelve el tenant correcto, y RLS sigue intacto', async () => {

    // La funcion devuelve el tenant Dueño del preapproval, no el del contexto:
    // es lo que el webhook necesita para enrutar el evento.
    const fromB = await withTenantContext(tenantB.id, async () => {
      const rows = await conn()<ResolveRow[]>`
        SELECT resolve_tenant_by_preapproval(${PREAPPROVAL_ID}) AS "tenantId"
      `
      return rows[0]?.tenantId
    })
    expect(fromB).toBe(tenantA.id)

    // Y el bypass es de la FUNCION, no de la tabla: una query directa desde el
    // contexto de B sigue sin ver la fila de A.
    const directRows = await withTenantContext(tenantB.id, async (tx) =>
      tx
        .select({ tenantId: dbSubscriptions.tenantId })
        .from(dbSubscriptions)
        .where(eq(dbSubscriptions.mpPreapprovalId, PREAPPROVAL_ID)),
    )
    expect(directRows).toEqual([])
  })

  it('4. expone solo el tenantId: retorna un escalar uuid, no un record', async () => {

    const fnRows = await conn()<FunctionRow[]>`
      SELECT pg_get_userbyid(p.proowner)        AS "owner",
             p.prosecdef                        AS "securityDefiner",
             p.prorettype::regtype::text        AS "returnType",
             p.pronargs                         AS "argCount",
             p.proconfig                        AS "config"
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'resolve_tenant_by_preapproval'
    `
    const fn = fnRows[0]
    expect(fn).toBeDefined()
    expect(fn?.securityDefiner).toBe(true)
    expect(fn?.returnType).toBe('uuid')
    expect(fn?.argCount).toBe(1)
    expect(fn?.config).toEqual(['search_path=public, pg_temp'])

    // `SELECT *` expone una sola columna (no un record con filas ajenas).
    const starRows = await conn()<Record<string, unknown>[]>`
      SELECT * FROM resolve_tenant_by_preapproval(${PREAPPROVAL_ID})
    `
    expect(Object.keys(starRows[0] ?? {})).toEqual(['resolve_tenant_by_preapproval'])
  })

  it('5. PUBLIC no puede ejecutarla: el escape hatch es solo para app_user', async () => {

    const privRows = await conn()<{ grantee: string }[]>`
      SELECT grantee
      FROM information_schema.routine_privileges
      WHERE routine_name = 'resolve_tenant_by_preapproval'
    `
    const grantees = privRows.map((r) => r.grantee)

    expect(grantees).toContain('app_user')
    expect(grantees).not.toContain('PUBLIC')
  })

  it('6. aguanta una sesion tibia: la query directa falla, la funcion no', async () => {

    // `max: 1` fuerza una sola conexion fisica, para que el calentamiento y las
    // consultas posteriores Happens en la MISMA sesion. Sin esto, `withTenantContext`
    // calienta su propio pool y el estado `''` no se reproduce aqui.
    const warm = postgres(dbUrl(), { max: 1 })

    try {
      // Sesion virgen: `app.tenant_id` no existe todavia.
      const virgin = await warm<{ v: string | null }[]>`
        SELECT current_setting('app.tenant_id', true) AS "v"
      `
      expect(virgin[0]?.v).toBeNull()

      // Tras un SET LOCAL revertido, el GUC vuelve a '' en vez de desaparecer.
      await warm.begin(async (tx) => {
        await tx`SELECT set_tenant_id(${tenantA.id}::uuid)`
      })

      // La query original, sin la funcion, revienta con 22P02 en esa sesion.
      let directError: string | null = null
      try {
        await warm`SELECT "tenantId" FROM "subscriptions" LIMIT 1`
      } catch (error) {
        directError = (error as { code?: string }).code ?? 'unknown'
      }
      expect(directError).toBe('22P02')

      // La funcion no depende del contexto en absoluto.
      const rows = await warm<ResolveRow[]>`
        SELECT resolve_tenant_by_preapproval(${PREAPPROVAL_ID}) AS "tenantId"
      `
      expect(rows[0]?.tenantId).toBe(tenantA.id)
    } finally {
      await warm.end()
    }
  }, 20_000)
})