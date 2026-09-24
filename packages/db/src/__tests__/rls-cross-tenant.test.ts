import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dbSubscriptions, dbTenantMpConfig } from '../schema'

interface TenantRow {
  id: string
  slug: string
}

interface RoleRow {
  role: string
  bypass: boolean
}

interface SubscriptionFixture {
  id: string
  tenantId: string
}

type DbModule = typeof import('../index')

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      'cause' in error && error.cause instanceof Error ? error.cause : error
    return `${error.message} ${cause.message}`
  }
  return String(error)
}

const appUrl = process.env.DATABASE_APP_URL
const hasAppUrl = Boolean(appUrl)
let directClient: ReturnType<typeof postgres>
let withTenantContext: DbModule['withTenantContext']
let readTenantA: TenantRow
let readTenantB: TenantRow
let writeTenantA: TenantRow
let writeTenantB: TenantRow
let readSubscriptionCreated = false
let readSubscriptionBCreated = false
let readConfigCreated = false
let readConfigBCreated = false
let writeSubscriptionCreated = false
let writeConfigCreated = false
let writeTenantACreated = false
let writeTenantBCreated = false

async function createTenant(slug: string, name: string): Promise<TenantRow> {
  const rows = await directClient<TenantRow[]>`
    INSERT INTO "tenants" ("slug", "name")
    VALUES (${slug}, ${name})
    RETURNING "id", "slug"
  `
  const tenant = rows[0]
  if (!tenant) {
    throw new Error(`No se pudo crear el tenant temporal ${slug}`)
  }
  return tenant
}

async function getTenantBySlug(slug: string): Promise<TenantRow> {
  const rows = await directClient<TenantRow[]>`
    SELECT "id", "slug"
    FROM "tenants"
    WHERE "slug" = ${slug}
  `
  const tenant = rows[0]
  if (!tenant) {
    throw new Error(`Falta el tenant de prueba ${slug}; ejecutá el seed primero`)
  }
  return tenant
}

async function getPlanId(slug: string): Promise<string> {
  const rows = await directClient<{ id: string }[]>`
    SELECT "id"
    FROM "plans"
    WHERE "slug" = ${slug}
  `
  const plan = rows[0]
  if (!plan) {
    throw new Error(`Falta el plan de prueba ${slug}; ejecutá el seed primero`)
  }
  return plan.id
}

async function ensureSubscription(
  tenantId: string,
  planId: string,
): Promise<{ fixture: SubscriptionFixture; created: boolean }> {
  const existing = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({ id: dbSubscriptions.id, tenantId: dbSubscriptions.tenantId })
      .from(dbSubscriptions)
      .where(eq(dbSubscriptions.tenantId, tenantId)),
  )
  const fixture = existing[0]
  if (fixture) {
    return { fixture, created: false }
  }

  const inserted = await withTenantContext(tenantId, async (tx) =>
    tx
      .insert(dbSubscriptions)
      .values({ tenantId, planId, status: 'active' })
      .returning({ id: dbSubscriptions.id, tenantId: dbSubscriptions.tenantId }),
  )
  const createdFixture = inserted[0]
  if (!createdFixture) {
    throw new Error(`No se pudo crear la suscripción de prueba ${tenantId}`)
  }
  return { fixture: createdFixture, created: true }
}

async function ensureConfig(tenantId: string): Promise<boolean> {
  const existing = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({ id: dbTenantMpConfig.id })
      .from(dbTenantMpConfig)
      .where(eq(dbTenantMpConfig.tenantId, tenantId)),
  )
  if (existing.length > 0) {
    return false
  }

  await withTenantContext(tenantId, async (tx) => {
    await tx.insert(dbTenantMpConfig).values({
      tenantId,
      accessTokenEnc: Buffer.from('rls-test-access-token'),
      webhookSecretEnc: Buffer.from('rls-test-webhook-secret'),
    })
  })
  return true
}

async function deleteConfig(tenantId: string): Promise<void> {
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .delete(dbTenantMpConfig)
      .where(eq(dbTenantMpConfig.tenantId, tenantId))
  })
}

async function deleteSubscription(tenantId: string): Promise<void> {
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .delete(dbSubscriptions)
      .where(eq(dbSubscriptions.tenantId, tenantId))
  })
}

describe.skipIf(!hasAppUrl)('RLS cross-tenant real', () => {
  beforeAll(async () => {
    directClient = postgres(appUrl!)
    const roleRows = await directClient<RoleRow[]>`
      SELECT current_user AS "role", rol.rolbypassrls AS "bypass"
      FROM pg_roles AS rol
      WHERE rol.rolname = current_user
    `
    const role = roleRows[0]
    if (!role || role.bypass) {
      throw new Error(
        'DATABASE_APP_URL debe usar un rol sin BYPASSRLS; T11 no puede pasar con owner',
      )
    }

    const dbModule = await import('../index')
    withTenantContext = dbModule.withTenantContext

    readTenantA = await getTenantBySlug('tienda1')
    readTenantB = await getTenantBySlug('tienda2')
    const starterPlanId = await getPlanId('starter')

    const readSubscriptionA = await ensureSubscription(
      readTenantA.id,
      starterPlanId,
    )
    const readSubscriptionB = await ensureSubscription(
      readTenantB.id,
      starterPlanId,
    )
    readSubscriptionCreated = readSubscriptionA.created
    readSubscriptionBCreated = readSubscriptionB.created
    readConfigCreated = await ensureConfig(readTenantA.id)
    readConfigBCreated = await ensureConfig(readTenantB.id)

    const suffix = randomUUID().slice(0, 8)
    writeTenantA = await createTenant(`rls-test-a-${suffix}`, 'RLS test A')
    writeTenantACreated = true
    writeTenantB = await createTenant(`rls-test-b-${suffix}`, 'RLS test B')
    writeTenantBCreated = true
    const writeSubscriptionB = await ensureSubscription(
      writeTenantB.id,
      starterPlanId,
    )
    writeSubscriptionCreated = writeSubscriptionB.created
  }, 30_000)

  afterAll(async () => {
    if (!withTenantContext || !directClient) {
      return
    }

    if (writeConfigCreated) {
      await deleteConfig(writeTenantB.id)
    }
    if (writeSubscriptionCreated) {
      await deleteSubscription(writeTenantB.id)
    }
    if (writeTenantBCreated) {
      await directClient`DELETE FROM "tenants" WHERE "id" = ${writeTenantB.id}`
    }
    if (writeTenantACreated) {
      await directClient`DELETE FROM "tenants" WHERE "id" = ${writeTenantA.id}`
    }
    if (readConfigCreated) {
      await deleteConfig(readTenantA.id)
    }
    if (readConfigBCreated) {
      await deleteConfig(readTenantB.id)
    }
    if (readSubscriptionCreated) {
      await deleteSubscription(readTenantA.id)
    }
    if (readSubscriptionBCreated) {
      await deleteSubscription(readTenantB.id)
    }
    await directClient.end()
  }, 30_000)

  it('contexto A no lee suscripciones de B', async () => {
    const rows = await withTenantContext(readTenantA.id, async (tx) =>
      tx
        .select({ tenantId: dbSubscriptions.tenantId })
        .from(dbSubscriptions),
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenantId === readTenantA.id)).toBe(true)
  })

  it('contexto B no lee suscripciones de A', async () => {
    const rows = await withTenantContext(readTenantB.id, async (tx) =>
      tx
        .select({ tenantId: dbSubscriptions.tenantId })
        .from(dbSubscriptions),
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenantId === readTenantB.id)).toBe(true)
  })

  it('contexto A no lee tenant_mp_config de B', async () => {
    const rows = await withTenantContext(readTenantA.id, async (tx) =>
      tx
        .select({ tenantId: dbTenantMpConfig.tenantId })
        .from(dbTenantMpConfig),
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenantId === readTenantA.id)).toBe(true)
  })

  it('contexto B no lee tenant_mp_config de A', async () => {
    const rows = await withTenantContext(readTenantB.id, async (tx) =>
      tx
        .select({ tenantId: dbTenantMpConfig.tenantId })
        .from(dbTenantMpConfig),
    )

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenantId === readTenantB.id)).toBe(true)
  })

  it('rechaza INSERT de B bajo contexto A', async () => {
    let rejected = false
    try {
      await withTenantContext(writeTenantA.id, async (tx) => {
        await tx.insert(dbTenantMpConfig).values({
          tenantId: writeTenantB.id,
          accessTokenEnc: Buffer.from('rls-test-access-token'),
          webhookSecretEnc: Buffer.from('rls-test-webhook-secret'),
        })
      })
    } catch (error) {
      rejected = true
      expect(getErrorMessage(error)).toMatch(/row-level|policy|permission/i)
    }

    if (!rejected) {
      writeConfigCreated = true
      throw new Error(
        'CRÍTICO: INSERT de B bajo contexto A pasó; la policy 0014 no bloquea WITH CHECK implícito',
      )
    }
  })

  it('UPDATE de B bajo contexto A no afecta filas', async () => {
    const rows = await withTenantContext(writeTenantA.id, async (tx) =>
      tx
        .update(dbSubscriptions)
        .set({ mpPreapprovalId: 'rls-test-preapproval' })
        .where(eq(dbSubscriptions.tenantId, writeTenantB.id))
        .returning({ id: dbSubscriptions.id }),
    )

    expect(rows).toEqual([])
  })

  it('DELETE de B bajo contexto A no afecta filas', async () => {
    const rows = await withTenantContext(writeTenantA.id, async (tx) =>
      tx
        .delete(dbSubscriptions)
        .where(eq(dbSubscriptions.tenantId, writeTenantB.id))
        .returning({ id: dbSubscriptions.id }),
    )

    expect(rows).toEqual([])
  })

  it('sin set_tenant_id una conexión nueva devuelve cero filas RLS', async () => {
    if (!appUrl) {
      throw new Error('DATABASE_APP_URL no configurada para el caso sin contexto')
    }

    const cleanClient = postgres(appUrl)
    try {
      const rows = await cleanClient<{ table: string; count: number }[]>`
        SELECT 'subscriptions' AS "table", COUNT(*)::int AS "count"
        FROM "subscriptions"
        UNION ALL
        SELECT 'tenant_mp_config' AS "table", COUNT(*)::int AS "count"
        FROM "tenant_mp_config"
      `

      expect(rows).toEqual([
        { table: 'subscriptions', count: 0 },
        { table: 'tenant_mp_config', count: 0 },
      ])
    } finally {
      await cleanClient.end()
    }
  })
})
