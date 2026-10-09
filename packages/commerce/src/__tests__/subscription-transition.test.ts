import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'

import type { SubscriptionStatus } from '../subscription-permissions'

/**
 * Test de integracion REAL de `transitionSubscription` (item 61, H-T6-1).
 *
 * Existe por una razon especifica: **es el primer test del repo que verifica el
 * `WHERE` de una query de suscripcion.** Los tests mock-based no pueden, porque
 * con `withTenantContext` mockeado el mock devuelve filas fijas sin importar que
 * filtro lleve la query.
 *
 * ## Las dos capas, y por que hacen falta las dos
 *
 * **Capa 1 — contexto de produccion** (`DATABASE_APP_URL`, rol sin BYPASSRLS,
 * RLS activo). Verifica el comportamiento real y que el compare-and-set del
 * item 70 sigue vivo.
 *
 * **Capa 2 — owner con BYPASSRLS** (`DATABASE_URL`). Aislado el RLS, **el unico
 * guard que queda es el `WHERE`**, y ahi el filtro por tenant es observable.
 *
 * La segunda capa no es un lujo: es la que hace que el test sirva. Con RLS
 * activo, quitar `eq(dbSubscriptions.tenantId, ...)` del `WHERE` **no rompe nada**,
 * porque la policy de Postgres detiene la escritura de la fila del otro tenant.
 * Se verifico empiricamente en este mismo trabajo: con la mutacion aplicada, los
 * tests en contexto de produccion pasaban 4/4. El defecto no era invisible por
 * falta de asercion, era invisible porque **otra capa lo tapaba** — exactamente
 * lo que la auditoria T6 senalo al llamar a RLS otra
 *
 * La mutacion si se detecta en la capa 2, y ahi no hay red debajo.
 *
 * Sigue el patron de `packages/db/src/__tests__/rls-cross-tenant.test.ts`:
 * cliente directo para crear tenants (`tenants` no tiene RLS), y verificacion del
 * rol antes de correr nada.
 *
 * NOTA sobre imports: `@repo/db` y `../subscription-transition` lanzan al cargar
 * el modulo si falta `DATABASE_APP_URL`, asi que se importan dentro de
 * `beforeAll`. Arriba solo hay imports de tipo, que no ejecutan codigo.
 */

type DbModule = typeof import('@repo/db')
type TransitionFn =
  typeof import('../subscription-transition')['transitionSubscription']

interface TenantRow {
  id: string
  slug: string
}

interface SubscriptionState {
  id: string
  tenantId: string
  status: string
  currentPeriodEnd: Date | null
  lastProcessedPaymentId: string | null
}

function isUsableUrl(url: string | undefined): url is string {
  if (!url) return false
  if (/localhost|127\.0\.0\.1|dummy/i.test(url)) return false
  return true
}

const appUrl = process.env.DATABASE_APP_URL
const ownerUrl = process.env.DATABASE_URL
const hasAppUrl = isUsableUrl(appUrl) && isUsableUrl(ownerUrl)

let directClient: ReturnType<typeof postgres>
/**
 * Cliente owner (BYPASSRLS).
 *
 * Es separado de `directClient` a proposito: las lecturas y los resets que
 * necesitan **ver filas de cualquier tenant** tienen que salir por aca. Con el
 * cliente de `app_user`, RLS devuelve 0 filas para un tenant distinto al del
 * contexto, y el test no podria observar justamente la fila ajena que necesita
 * verificar.
 */
let ownerClient: ReturnType<typeof postgres>
let withTenantContext: DbModule['withTenantContext']
let dbSubscriptions: DbModule['dbSubscriptions']
let schema: DbModule['schema']
let transitionSubscription: TransitionFn
/** Drizzle sobre el owner: RLS no aplica, asi que el WHERE queda solo. */
let ownerDb: ReturnType<typeof drizzle<typeof schema>>

let tenantA: TenantRow
let tenantB: TenantRow
let tenantSinSuscripcion: TenantRow
let planId: string
let createdTenantIds: string[] = []
let createdSubscriptionTenantIds: string[] = []

async function createTenant(slug: string, name: string): Promise<TenantRow> {
  const rows = await directClient<TenantRow[]>`
    INSERT INTO "tenants" ("slug", "name")
    VALUES (${slug}, ${name})
    RETURNING "id", "slug"
  `
  const tenant = rows[0]
  if (!tenant) throw new Error(`No se pudo crear el tenant temporal ${slug}`)
  createdTenantIds.push(tenant.id)
  return tenant
}

async function getPlanId(): Promise<string> {
  const rows = await directClient<{ id: string }[]>`
    SELECT "id" FROM "plans" WHERE "slug" = 'starter'
  `
  const plan = rows[0]
  if (!plan) throw new Error('Falta el plan starter; ejecutá el seed primero')
  return plan.id
}

async function ensureSubscription(tenantId: string): Promise<string> {
  const existing = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({ id: dbSubscriptions.id })
      .from(dbSubscriptions)
      .where(eq(dbSubscriptions.tenantId, tenantId)),
  )
  if (existing[0]) return existing[0].id

  const inserted = await withTenantContext(tenantId, async (tx) =>
    tx
      .insert(dbSubscriptions)
      .values({ tenantId, planId, status: 'active' })
      .returning({ id: dbSubscriptions.id }),
  )
  const created = inserted[0]
  if (!created) {
    throw new Error(`No se pudo crear la suscripcion de ${tenantId}`)
  }
  createdSubscriptionTenantIds.push(tenantId)
  return created.id
}

/**
 * Lee el estado de una suscripcion SIN proteccion de tenant.
 *
 * Usa el owner a proposito: si usara `withTenantContext`, RLS devolveria 0 filas
 * para un tenant distinto al de contexto y el test no podria observar la fila
 * ajena — que es justamente lo que hay que observar.
 */
async function readStateUnprotected(
  tenantId: string,
): Promise<SubscriptionState | null> {
  const rows = await ownerClient<SubscriptionState[]>`
    SELECT "id", "tenantId", "status", "currentPeriodEnd", "lastProcessedPaymentId"
    FROM "subscriptions"
    WHERE "tenantId" = ${tenantId}::uuid
    LIMIT 1
  `
  return rows[0] ?? null
}

async function resetStatus(tenantId: string, status: string): Promise<void> {
  await ownerClient`
    UPDATE "subscriptions"
    SET "status" = ${status}, "currentPeriodEnd" = NULL,
        "lastProcessedPaymentId" = NULL
    WHERE "tenantId" = ${tenantId}::uuid
  `
}

/** Transiciona desde un owner BYPASSRLS: el WHERE es el unico guard. */
async function transitionUnprotected(
  tenantId: string,
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): Promise<{ applied: boolean }> {
  return ownerDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_tenant_id(${tenantId}::uuid)`)
    return transitionSubscription(
      tx,
      tenantId,
      from,
      to,
      { updatedAt: new Date() },
    )
  })
}

function patch() {
  return { updatedAt: new Date() }
}

describe.skipIf(!hasAppUrl)('transitionSubscription — aislamiento real', () => {
  beforeAll(async () => {
    directClient = postgres(appUrl!)

    const roleRows = await directClient<
      { role: string; bypass: boolean }[]
    >`
      SELECT current_user AS "role", rol.rolbypassrls AS "bypass"
      FROM pg_roles AS rol
      WHERE rol.rolname = current_user
    `
    const role = roleRows[0]
    if (!role || role.bypass) {
      throw new Error(
        'DATABASE_APP_URL debe usar un rol sin BYPASSRLS; este test no puede pasar con owner',
      )
    }

    const dbModule = await import('@repo/db')
    withTenantContext = dbModule.withTenantContext
    dbSubscriptions = dbModule.dbSubscriptions
    schema = dbModule.schema
    transitionSubscription = (await import('../subscription-transition'))
      .transitionSubscription

    ownerDb = drizzle(postgres(ownerUrl!, { max: 1 }), { schema })
    ownerClient = postgres(ownerUrl!, { max: 1 })

    planId = await getPlanId()

    const suffix = randomUUID().slice(0, 8)
    tenantA = await createTenant(`item61-a-${suffix}`, 'Item 61 A')
    tenantB = await createTenant(`item61-b-${suffix}`, 'Item 61 B')
    tenantSinSuscripcion = await createTenant(
      `item61-sin-${suffix}`,
      'Item 61 sin suscripcion',
    )

    await ensureSubscription(tenantA.id)
    await ensureSubscription(tenantB.id)
  }, 30_000)

  afterAll(async () => {
    if (!withTenantContext || !directClient) return
    for (const id of createdSubscriptionTenantIds) {
      await directClient`
        DELETE FROM "subscriptions" WHERE "tenantId" = ${id}::uuid
      `
    }
    for (const id of createdTenantIds) {
      await directClient`
        DELETE FROM "tenants" WHERE "id" = ${id}::uuid
      `
    }
    await ownerClient.end()
    await directClient.end()
  })

  describe('capa 2 — owner BYPASSRLS, el WHERE es el unico guard', () => {
    // Reset de AMBOS tenants entre tests. Sin esto, una mutacion que escriba de
    // mas deja a B pausado y los tests de la capa 1 fallan por cascada: el
    // diagnostico se vuelve mas ruidoso justo cuando mas falta clarity.
    afterEach(async () => {
      await resetStatus(tenantA.id, 'active')
      await resetStatus(tenantB.id, 'active')
    })

    it('transiciona el tenant indicado y NO toca el otro', async () => {
      const before = await readStateUnprotected(tenantB.id)
      expect(before?.status).toBe('active')

      const result = await transitionUnprotected(
        tenantA.id,
        'active' as SubscriptionStatus,
        'paused' as SubscriptionStatus,
      )
      expect(result.applied).toBe(true)

      const afterA = await readStateUnprotected(tenantA.id)
      const afterB = await readStateUnprotected(tenantB.id)

      expect(afterA?.status).toBe('paused')
      // ESTA asercion es la que detecta la mutacion de la auditoria: sin el
      // filtro por tenantId, `WHERE status = 'active'` matchea las filas de A y
      // de B, y las pausa a las dos. Con el filtro, solo A.
      expect(afterB?.status).toBe('active')
    })

    it('un tenant sin suscripcion NO alcanza la fila de otro tenant', async () => {
      const result = await transitionUnprotected(
        tenantSinSuscripcion.id,
        'active' as SubscriptionStatus,
        'paused' as SubscriptionStatus,
      )

      // Sin el filtro, `WHERE status = 'active'` alcanzaria las filas de A y de B
      // y las pausaria. Con el filtro, no hay nada que alcanzar.
      expect(result.applied).toBe(false)

      const a = await readStateUnprotected(tenantA.id)
      const b = await readStateUnprotected(tenantB.id)
      expect(a?.status).toBe('active')
      expect(b?.status).toBe('active')
    })
  })

  describe('capa 1 — contexto de produccion, RLS activo', () => {
    it('respeta el compare-and-set: transicionar desde un status distinto no escribe', async () => {
      // Item 70 (H-F2-8). El `from` es la condicion de concurrencia: si otra
      // transicion movio la fila, el WHERE no matchea y se descarta.
      const result = await withTenantContext(tenantA.id, async (tx) =>
        transitionSubscription(
          tx,
          tenantA.id,
          'past_due' as SubscriptionStatus,
          'cancelled' as SubscriptionStatus,
          patch(),
        ),
      )

      expect(result.applied).toBe(false)
      expect(result).toEqual({
        applied: false,
        reason: 'concurrent_update',
      })
      expect((await readStateUnprotected(tenantA.id))?.status).toBe('active')
    })

    it('transiciona el tenant indicado en el contexto correcto', async () => {
      const result = await withTenantContext(tenantA.id, async (tx) =>
        transitionSubscription(
          tx,
          tenantA.id,
          'active' as SubscriptionStatus,
          'paused' as SubscriptionStatus,
          patch(),
        ),
      )

      expect(result.applied).toBe(true)
      expect((await readStateUnprotected(tenantA.id))?.status).toBe('paused')
      expect((await readStateUnprotected(tenantB.id))?.status).toBe('active')

      await resetStatus(tenantA.id, 'active')
    })

    it('escribe los campos del patch sin alcanzar al otro tenant', async () => {
      const periodEnd = new Date('2030-01-15T00:00:00.000Z')

      const result = await withTenantContext(tenantA.id, async (tx) =>
        transitionSubscription(
          tx,
          tenantA.id,
          'active' as SubscriptionStatus,
          'active' as SubscriptionStatus,
          {
            currentPeriodEnd: periodEnd,
            lastProcessedPaymentId: 'pay-61',
            updatedAt: new Date(),
          },
        ),
      )

      expect(result.applied).toBe(true)

      const afterA = await readStateUnprotected(tenantA.id)
      expect(afterA?.currentPeriodEnd?.toISOString()).toBe(
        periodEnd.toISOString(),
      )
      expect(afterA?.lastProcessedPaymentId).toBe('pay-61')

      const afterB = await readStateUnprotected(tenantB.id)
      expect(afterB?.lastProcessedPaymentId).toBeNull()

      await resetStatus(tenantA.id, 'active')
    })
  })
})