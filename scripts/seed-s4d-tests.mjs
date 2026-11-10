/**
 * Seed de tenants de prueba para S4D.
 *
 * Crea tres tenants con estados distintos para ejercitar las reglas de acceso
 * del panel:
 *   - s4d-test-active     -> tenant `active`    + suscripcion `active`
 *   - s4d-test-susp-sub   -> tenant `suspended` + suscripcion `active`
 *   - s4d-test-susp-nosub -> tenant `suspended` sin fila en `subscriptions`
 *
 * Cada tenant tiene un admin `<slug>@test.invalid`. Ese namespace es el que
 * usan los filtros de conteo y limpieza (`tenants.slug LIKE 's4d-test-%'` +
 * `admin_users.email LIKE '%@test.invalid'`).
 *
 * Es idempotente: primero borra esos tres slugs y despues inserta.
 *
 * Requiere SEED_ALLOWED_HOST: el hostname exacto de la rama de Neon contra la
 * que se corre (sin esquema ni puerto), ej:
 *   ep-xxx-pooler.us-east-2.aws.neon.tech
 * Se obtiene del dashboard de Neon (rama -> Connection string). NO se derive
 * del `.env.local` local: puede apuntar a otra rama.
 *
 * Uso:
 *   ALLOW_SEED=true SEED_ALLOWED_HOST=<host> node scripts/seed-s4d-tests.mjs
 *   ALLOW_SEED=true SEED_ALLOWED_HOST=<host> node scripts/seed-s4d-tests.mjs --cleanup
 */

import crypto from 'node:crypto'
import { config } from 'dotenv'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

import { abort, assertSafeEnv } from './lib/env-guards.mjs'

// En este repo las credenciales viven en `.env.local`, no en `.env`.
config({ path: '.env.local' })

const TEST_TENANTS = [
  {
    slug: 's4d-test-active',
    name: 'Test Active',
    status: 'active',
    withSub: true,
  },
  {
    slug: 's4d-test-susp-sub',
    name: 'Test Suspended (con suscripcion)',
    status: 'suspended',
    withSub: true,
  },
  {
    slug: 's4d-test-susp-nosub',
    name: 'Test Suspended (sin suscripcion)',
    status: 'suspended',
    withSub: false,
  },
]

const TEST_SLUG_PATTERN = 's4d-test-%'
const TEST_EMAIL_PATTERN = '%@test.invalid'

function generatePassword() {
  // base64url de 12 bytes ronda los 16 caracteres utiles.
  return crypto.randomBytes(12).toString('base64url')
}

async function resolvePlanId(tx) {
  const [starter] = await tx`SELECT id FROM plans WHERE slug = 'starter' LIMIT 1`
  if (starter) return starter.id

  const [fallback] = await tx`SELECT id FROM plans ORDER BY "priceUyu" ASC LIMIT 1`
  if (fallback) return fallback.id

  throw new Error(
    'No hay planes en la base. Corré `pnpm db:seed` antes de este script.',
  )
}

/**
 * Cuenta filas del namespace de prueba cruzando tenant y admin.
 *
 * El JOIN es explicito a proposito: un tenant con dos admins cuenta dos filas,
 * porque el conteo mide filas de `admin_users` que matchean, no solo tenants.
 * Esa es la senal de "estado inesperado" que queremos detectar.
 */
async function countTestRows(tx) {
  const [row] = await tx`
    SELECT COUNT(*)::int AS n
    FROM tenants
    JOIN admin_users ON admin_users."tenantId" = tenants.id
    WHERE tenants.slug LIKE ${TEST_SLUG_PATTERN}
      AND admin_users.email LIKE ${TEST_EMAIL_PATTERN}
  `
  return row.n
}

async function listTestRows(tx) {
  return await tx`
    SELECT tenants.slug, admin_users.email
    FROM tenants
    JOIN admin_users ON admin_users."tenantId" = tenants.id
    WHERE tenants.slug LIKE ${TEST_SLUG_PATTERN}
      AND admin_users.email LIKE ${TEST_EMAIL_PATTERN}
    ORDER BY tenants.slug, admin_users.email
  `
}

async function unexpectedCountError(tx, phase, count, expected) {
  const rows = await listTestRows(tx)
  const detail =
    rows.length > 0
      ? rows.map((r) => `  - ${r.slug} / ${r.email}`).join('\n')
      : '  (sin filas)'
  return new Error(
    `${phase}: se esperaban ${expected}, pero hay ${count} fila(s) de prueba.\nFilas que matchean:\n${detail}`,
  )
}

async function deleteTestData(tx, slugs) {
  const deleted = {
    orderItems: 0,
    orders: 0,
    productVariants: 0,
    productImages: 0,
    products: 0,
    categories: 0,
    customers: 0,
    shippingMethods: 0,
    adminUsers: 0,
    subscriptions: 0,
    tenants: 0,
  }

  for (const slug of slugs) {
    const [tenant] = await tx`SELECT id FROM tenants WHERE slug = ${slug}`
    if (!tenant) continue

    // Orden seguro de FKs: los hijos con RESTRICT se borran antes del padre.
    const orderItemRows = await tx`
      DELETE FROM order_items WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.orderItems += orderItemRows.length

    const orderRows = await tx`
      DELETE FROM orders WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.orders += orderRows.length

    const variantRows = await tx`
      DELETE FROM product_variants WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.productVariants += variantRows.length

    const imageRows = await tx`
      DELETE FROM product_images WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.productImages += imageRows.length

    const productRows = await tx`
      DELETE FROM products WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.products += productRows.length

    const categoryRows = await tx`
      DELETE FROM categories WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.categories += categoryRows.length

    const customerRows = await tx`
      DELETE FROM customers WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.customers += customerRows.length

    const shippingRows = await tx`
      DELETE FROM shipping_methods WHERE "tenantId" = ${tenant.id} RETURNING id
    `
    deleted.shippingMethods += shippingRows.length

    // Solo huerfanos propios: un admin con el mismo email en otro tenant no se toca.
    const adminRows = await tx`
      DELETE FROM admin_users
      WHERE "tenantId" = ${tenant.id}
         OR (email = ${`${slug}@test.invalid`} AND "tenantId" IS NULL)
      RETURNING id
    `
    deleted.adminUsers += adminRows.length

    const subRows = await tx`
      DELETE FROM subscriptions
      WHERE "tenantId" = ${tenant.id}
      RETURNING id
    `
    deleted.subscriptions += subRows.length

    const tenantRows = await tx`
      DELETE FROM tenants WHERE id = ${tenant.id} RETURNING id
    `
    deleted.tenants += tenantRows.length
  }

  return deleted
}

function formatDeleted(deleted) {
  const labels = {
    orderItems: 'order_item(s)',
    orders: 'order(s)',
    productVariants: 'variante(s)',
    productImages: 'imagen(es)',
    products: 'producto(s)',
    categories: 'categoria(s)',
    customers: 'cliente(s)',
    shippingMethods: 'metodo(s) de envio',
    adminUsers: 'admin(s)',
    subscriptions: 'suscripcion(es)',
    tenants: 'tenant(s)',
  }

  const parts = Object.entries(deleted)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${labels[key]}`)

  return parts.length > 0 ? parts.join(', ') : 'nada que borrar'
}

async function deleteAndVerify(tx, phase) {
  const slugs = TEST_TENANTS.map((t) => t.slug)
  const deleted = await deleteTestData(tx, slugs)
  const remaining = await countTestRows(tx)
  if (remaining !== 0) {
    throw new Error(
      `${phase}: quedaron ${remaining} fila(s) de prueba tras el borrado. Abortando para no dejar residuos.`,
    )
  }
  return deleted
}

async function cleanup(tx) {
  const count = await countTestRows(tx)
  if (count === 0) {
    throw new Error(
      'Cleanup: no hay datos de S4D para limpiar. Probablemente el seed nunca corrió; corré el seed primero si querés crear los 3 tenants.',
    )
  }
  if (count !== 3) {
    throw await unexpectedCountError(tx, 'Cleanup', count, 'exactamente 3')
  }

  const deleted = await deleteAndVerify(tx, 'Cleanup')
  console.log(`Cleanup: ${formatDeleted(deleted)}.`)
  console.log('Conteo final de filas de prueba: 0.')
}

async function seed(tx) {
  const count = await countTestRows(tx)
  if (count === 3) {
    const deleted = await deleteAndVerify(tx, 'Prelimpiar')
    console.log(`Prelimpiar: ${formatDeleted(deleted)}.`)
  } else if (count === 0) {
    console.log('Prelimpiar: no hay filas de prueba previas.')
  } else {
    throw await unexpectedCountError(tx, 'Prelimpiar', count, '0 o 3')
  }

  const planId = await resolvePlanId(tx)

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const credentials = []

  for (const spec of TEST_TENANTS) {
    const [tenant] = await tx`
      INSERT INTO tenants (slug, name, status, plan)
      VALUES (${spec.slug}, ${spec.name}, ${spec.status}::tenants_status, 'starter')
      RETURNING id
    `

    if (spec.withSub) {
      await tx`
        INSERT INTO subscriptions ("tenantId", "planId", status, "currentPeriodEnd")
        VALUES (${tenant.id}, ${planId}, 'active', ${periodEnd})
      `
    }

    const email = `${spec.slug}@test.invalid`
    const password = generatePassword()
    const hashed = await bcrypt.hash(password, 10)

    await tx`
      INSERT INTO admin_users (email, password, role, "tenantId")
      VALUES (${email}, ${hashed}, 'admin', ${tenant.id})
    `

    credentials.push({ email, password })
  }

  console.log('\nCredenciales (se muestran una sola vez):\n')
  const emailWidth = Math.max(...credentials.map((c) => c.email.length))
  console.log(`  ${'EMAIL'.padEnd(emailWidth)}  PASSWORD`)
  console.log(`  ${'-'.repeat(emailWidth)}  ${'-'.repeat(16)}`)
  for (const c of credentials) {
    console.log(`  ${c.email.padEnd(emailWidth)}  ${c.password}`)
  }
  console.log('')
}

const isCleanup = process.argv.includes('--cleanup')

let env
try {
  env = assertSafeEnv({ requireAllowSeed: true })
} catch (error) {
  abort(error instanceof Error ? error.message : String(error))
}

const sql = postgres(env.ownerUrl, { max: 1, ssl: 'require' })

async function main() {
  await sql.begin(async (tx) => {
    if (isCleanup) {
      await cleanup(tx)
    } else {
      await seed(tx)
    }
  })

  if (!isCleanup) {
    console.log('Para borrar estos datos:')
    console.log(
      '  bash:       ALLOW_SEED=true SEED_ALLOWED_HOST=<host> node scripts/seed-s4d-tests.mjs --cleanup',
    )
    console.log(
      '  PowerShell: $env:ALLOW_SEED="true"; $env:SEED_ALLOWED_HOST="<host>"; node scripts/seed-s4d-tests.mjs --cleanup',
    )
  }
}

main()
  .then(async () => {
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('ERROR:', e.message)
    await sql.end({ timeout: 5 }).catch(() => {})
    process.exit(1)
  })
