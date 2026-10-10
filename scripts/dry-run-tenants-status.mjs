import 'dotenv/config'

/**
 * DRY-RUN del backfill de `tenants.status` (item T2 del plan de Fase 3, R1).
 *
 * SOLO LECTURAS. Este script no escribe nada, no aplica migraciones y no
 * modifica datos. Existe para responder una pregunta antes de migrar:
 * ¿que valores de `status` hay realmente en la tabla?
 *
 * La migracion va a hacer `ALTER TABLE tenants ALTER COLUMN status TYPE
 * tenants_status USING status::tenants_status`, y eso **falla** si hay un valor
 * que no esta en el enum. Este script es el paso previo que evita descubrirlo
 * a mitad de la migracion.
 *
 * Uso: node scripts/dry-run-tenants-status.mjs
 */

import { config } from 'dotenv'
import postgres from 'postgres'

// `dotenv/config` carga `.env`, que no existe: en este repo las credenciales
// viven en `.env.local` (gitignored). Es el mismo gotcha que con drizzle-kit,
// y la falla es silenciosa si no se lo dice: `DATABASE_URL` queda undefined y el
// script reporta "no esta definida" en vez de "no pude leer el archivo".
config({ path: '.env.local' })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL no esta definida en .env.local')
  process.exit(1)
}

const sql = postgres(url, { max: 1, ssl: 'require' })

async function main() {
  console.log('--- DRY-RUN tenants.status (solo lecturas) ---\n')

  const counts = await sql`
    SELECT status, count(*)::int AS total
    FROM tenants
    GROUP BY status
    ORDER BY status
  `

  console.log('GROUP BY status:')
  if (counts.length === 0) {
    console.log('  (la tabla tenants esta vacia)')
  } else {
    for (const row of counts) {
      const value = row.status === null ? '(null)' : String(row.status)
      console.log(`  ${JSON.stringify(value).padEnd(20)} ${row.total}`)
    }
  }

  const total = counts.reduce((acc, r) => acc + r.total, 0)
  console.log(`\n  total de tenants: ${total}`)

  const NOT_ACTIVE = counts.filter((r) => String(r.status) !== 'active')
  console.log('')
  if (NOT_ACTIVE.length === 0) {
    console.log('RESULTADO: todos los valores son "active".')
    console.log('  La migracion a enum seria segura para los datos.')
  } else {
    console.log(`RESULTADO: ${NOT_ACTIVE.length} valor(es) fuera de "active":`)
    for (const row of NOT_ACTIVE) {
      console.log(`  ${JSON.stringify(String(row.status))} -> ${row.total} tenant(s)`)
    }
    console.log('')
    console.log('  PARAR: investigar antes de migrar.')
  }

  const nulls = await sql`
    SELECT count(*)::int AS total FROM tenants WHERE status IS NULL
  `
  console.log(`\n  status IS NULL: ${nulls[0].total}`)
}

main()
  .then(async () => { await sql.end({ timeout: 5 }); process.exit(0) })
  .catch(async (e) => {
    console.error('ERROR:', e.message)
    await sql.end({ timeout: 5 }).catch(() => {})
    process.exit(1)
  })