import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Test de integracion REAL de `activateTenant` (T5, SDD Fase 3).
 *
 * ## Por que UNA sola capa, a diferencia del de `transitionSubscription`
 *
 * Este es el hallazgo de D5 del design, y conviene que quede escrito aca porque
 * es contraintuitivo:
 *
 * - El test de `transitionSubscription` (`subscriptions`) necesita **DOS
 *   capas**. Con RLS activo, quitar `eq(dbSubscriptions.tenantId, ...)` del
 *   `WHERE` no rompe nada: `withTenantContext(A)` mas la policy bloquean la
 *   escritura de la fila de B. La policy **enmascaraba** el defecto. La segunda
 *   capa (owner con BYPASSRLS) existe para **quitar la mascara** y poder observar
 *   el `WHERE`.
 * - El test de `activateTenant` (`tenants`) necesita **UNA sola capa**. `tenants`
 *   es tabla raiz y **no tiene RLS**: el checklist de RLS del repo lo prohibe sin
 *   `tenantId` + policy. **No hay nada que enmascare nada**, asi que un filtro mal
 *   escrito cambia la fila del otro tenant y el test lo ve en una sola pasada.
 *
 * O sea: **la ausencia de una capa de proteccion hace el test MAS simple, no mas
 * dificil.** El enmascaramiento venia de *haber* una capa de proteccion.
 *
 * Por eso este test pasa el cliente owner directo como `tx`, sin
 * `withTenantContext`: no habria nada que ganar con el contexto de tenant, y
 * `activateTenant` recibe el `tx` del caller justamente para que el ambito lo
 * decida quien llama.
 *
 * El costo de que `tenants` no tenga RLS es el reciproco y tambien queda dicho en
 * el codigo: un `UPDATE` a esa tabla desde cualquier endpoint admin es
 * cross-tenant por definicion si no filtra. Esta funcion es la frontera.
 *
 * NOTA sobre imports: `@repo/db` y `../tenant-lifecycle` lanzan al cargar si
 * falta `DATABASE_URL`, asi que se importan dentro de `beforeAll`. Arriba solo hay
 * imports que no ejecutan codigo de la base.
 */

type DbModule = typeof import('@repo/db')
type ActivateFn = (typeof import('../tenant-lifecycle'))['activateTenant']

interface TenantRow {
  id: string
  slug: string
  status: string
}

function isUsableUrl(url: string | undefined): url is string {
  if (!url) return false
  if (/localhost|127\.0\.0\.1|dummy/i.test(url)) return false
  return true
}

const ownerUrl = process.env.DATABASE_URL
const canRun = isUsableUrl(ownerUrl)

let ownerClient: ReturnType<typeof postgres>
let schema: DbModule['schema']
/** Drizzle sobre el owner. `tenants` no tiene RLS, asi que aca no hay nada que enmascare el WHERE. */
let ownerDb: ReturnType<typeof drizzle<typeof schema>>
let activateTenant: ActivateFn

let tenantPending: TenantRow
let tenantActive: TenantRow
let tenantAlsoPending: TenantRow
const createdTenantIds: string[] = []

async function createTenant(status: 'pending' | 'active'): Promise<TenantRow> {
  const slug = `t5-${randomUUID().slice(0, 12)}`
  const rows = await ownerClient<TenantRow[]>`
    INSERT INTO "tenants" ("slug", "name", "status")
    VALUES (${slug}, ${slug}, ${status}::tenants_status)
    RETURNING "id", "slug", "status"
  `
  const tenant = rows[0]
  if (!tenant) throw new Error(`No se pudo crear el tenant temporal ${slug}`)
  createdTenantIds.push(tenant.id)
  return tenant
}

async function statusOf(tenantId: string): Promise<string | null> {
  const rows = await ownerClient<{ status: string }[]>`
    SELECT "status" FROM "tenants" WHERE "id" = ${tenantId}::uuid
  `
  return rows[0]?.status ?? null
}

describe.skipIf(!canRun)('activateTenant - integracion Neon', () => {
  beforeAll(async () => {
    // `skipIf` no estrecha el tipo: TypeScript sigue viendo `string | undefined`
    // adentro del callback. El guard explicito es lo que lo resuelve, y ademas
    // evita un error confuso si el skip llegara a no aplicarse.
    if (!isUsableUrl(ownerUrl)) {
      throw new Error('DATABASE_URL no utilizable para el test de integracion')
    }
    const db: DbModule = await import('@repo/db')
    schema = db.schema
    ownerClient = postgres(ownerUrl, { max: 1, ssl: 'require' })
    ownerDb = drizzle(ownerClient, { schema })
    const mod = await import('../tenant-lifecycle')
    activateTenant = mod.activateTenant

    tenantPending = await createTenant('pending')
    tenantActive = await createTenant('active')
    tenantAlsoPending = await createTenant('pending')
  })

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await ownerClient`DELETE FROM "tenants" WHERE "id" = ANY(${createdTenantIds}::uuid[])`
    }
    await ownerClient.end({ timeout: 5 })
  })

  it('un tenant pending se activa', async () => {
    const result = await activateTenant(ownerDb, tenantPending.id, {
      updatedAt: new Date(),
    })

    expect(result.applied).toBe(true)
    if (!result.applied) throw new Error('se esperaba applied')
    expect(result.id).toBe(tenantPending.id)
    expect(await statusOf(tenantPending.id)).toBe('active')
  })

  it('un tenant que ya esta active no se toca (compare-and-set)', async () => {
    const result = await activateTenant(ownerDb, tenantActive.id, {
      updatedAt: new Date(),
    })

    expect(result).toEqual({ applied: false, reason: 'not_pending' })
    expect(await statusOf(tenantActive.id)).toBe('active')
  })

  it('activar dos veces no es un error: la segunda no hace nada', async () => {
    // El tenant ya quedo active en el primer test. Reintentarlo tiene que ser
    // un no-op silencioso, no un error: el webhook de plataforma reintenta.
    const result = await activateTenant(ownerDb, tenantPending.id, {
      updatedAt: new Date(),
    })

    expect(result).toEqual({ applied: false, reason: 'not_pending' })
  })

  it('activar un tenant no toca el otro (aislamiento)', async () => {
    const before = await statusOf(tenantAlsoPending.id)

    await activateTenant(ownerDb, tenantPending.id, { updatedAt: new Date() })

    // Si el `WHERE` no tuviera `eq(dbTenants.id, tenantId)`, el UPDATE
    // activaria TODOS los tenants pending, incluido este. Ahi esta la
    // verificacion: `tenants` no tiene RLS, asi que no hay una segunda capa
    // que pueda enmascarar este defecto.
    expect(await statusOf(tenantAlsoPending.id)).toBe(before)
    expect(before).toBe('pending')
  })

  it('un tenant inexistente devuelve not_pending y no lanza', async () => {
    const result = await activateTenant(ownerDb, randomUUID(), {
      updatedAt: new Date(),
    })

    expect(result).toEqual({ applied: false, reason: 'not_pending' })
  })
})
