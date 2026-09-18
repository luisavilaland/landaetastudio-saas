import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local')
  process.exit(1)
}

const client = postgres(DATABASE_URL)

async function main() {
  console.log('=== T1 pgcrypto verification ===\n')
  console.log('Using DATABASE_URL (owner role)')

  // a. Check current extension
  console.log('\n(a) Checking pg_extension...')
  const checkResult = await client`SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`
  console.log('Result:', checkResult)

  let created = false
  if (checkResult.length === 0) {
    console.log('\n(b) pgcrypto NOT enabled. Creating extension...')
    await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`
    console.log('CREATE EXTENSION executed')
    created = true
  } else {
    console.log('\n(b) pgcrypto already enabled. Skipping CREATE EXTENSION.')
  }

  // c. Sanity check roundtrip
  console.log('\n(c) Sanity check: pgp_sym_encrypt roundtrip...')
  const roundtrip = await client`SELECT pgp_sym_encrypt('test', 'clave') IS NOT NULL AS roundtrip_ok`
  console.log('Result:', roundtrip)

  // d. Final re-verification
  console.log('\n(d) Final re-verification...')
  const finalCheck = await client`SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'`
  console.log('Result:', finalCheck)

  console.log('\n=== SUMMARY ===')
  console.log(`pgcrypto was ${created ? 'CREATED' : 'ALREADY ENABLED'}`)
  console.log(`Final count: ${finalCheck.length} row(s)`)

  await client.end()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})