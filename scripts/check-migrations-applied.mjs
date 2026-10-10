#!/usr/bin/env node
// Verificacion post-migracion: comprueba que la migracion REALMENTE aplico.
//
// Item 94. `drizzle-kit migrate` imprime "migrations applied successfully"
// aunque no haya aplicado nada. El caso concreto que lozenso: el registro
// `id=3` de `drizzle.__drizzle_migrations` tenia `created_at` en 2027-01-05
// (tres meses en el futuro), asi que drizzle concluyo que toda migracion nueva
// ya estaba aplicada y la salto **sin avisar**. La migracion no corria y el
// comando reportaba exito.
//
// Eso convierte un paso obligatorio del DoD ("si hubo migracion, corré
// db:migrate") en un paso que no prueba nada: el checklist queda verde y el
// schema no cambio.
//
// Que verifica: para cada entrada del journal, que el estado que la migracion
// deberia haber creado exista de verdad en la base. Un tipo, una columna, una
// tabla. No mira el tracking de drizzle - que es justamente lo que puede estar
// mintiendo - sino el **efecto observable**.
//
// Uso: node scripts/check-migrations-applied.mjs
// Exit 0 si todas las señales estan. Exit 1 con el detalle de la que falta.

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: '.env.local' })

/**
 * Señales minimas por migracion.
 *
 * Escribi una a mano por migracion y **no** la generes del diff: el punto es
 * que cada señal declare que se espera ver en la base, y que esa declaracion
 * quede en el repo para ser revisada.
 *
 * Cuando agregues una migracion, agregala aca. Si no, el script va a seguir
 * dando verde sobre migraciones que no aplicaron, que es exactamente el bug.
 */
const EXPECTED = {
  '0000_baseline': {
    tables: [
      'tenants',
      'plans',
      'subscriptions',
      'tenant_mp_config',
      'products',
      'product_variants',
      'product_images',
      'customers',
      'orders',
      'order_items',
      'categories',
      'shipping_methods',
      'admin_users',
    ],
  },
  '0001_dapper_revanche': {
    // Indice unico PARCIAL sobre subscriptions.mpPreapprovalId (#184).
    indexes: ['subscriptions_mp_preapproval_idx'],
  },
  '0002_resolve_tenant_by_preapproval': {
    // La funcion SECURITY DEFINER que resuelve tenant por preapprovalId (H1).
    functions: ['resolve_tenant_by_preapproval'],
  },
  // La 0003 crea un tipo enum. Sin esta senal, el wrapper falla con "sin senal
  // declarada" - que es el comportamiento correcto, pero por una limitacion del
  // check y no porque el enum falte. Ese falso positivo entrena a ignorar el
  // wrapper, que es peor que no tenerlo.
  //
  // Se verifica contra `pg_type`, no contra la tabla de control: el efecto
  // observable de la migracion es que el tipo existe.
  '0003_tenants_status_enum': {
    types: ['tenants_status'],
    // Y ademas la columna tiene que **usar** ese tipo. El enum por si solo
    // no dice nada: una migracion puede crear el tipo y fallar en el `ALTER
    // COLUMN`, y con el error tragado por drizzle (item 43) eso pasaria
    //_reportando exito_.
    columns: { 'tenants.status': 'tenants_status' },
  },
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL no esta definida en .env.local')
    process.exit(1)
  }

  const journal = JSON.parse(
    readFileSync('packages/db/migrations/meta/_journal.json', 'utf8'),
  )

  const sql = postgres(url, { max: 1, ssl: 'require' })

  const tables = new Set(
    (
      await sql.unsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      )
    ).map((r) => r.tablename),
  )

  const indexes = new Set(
    (
      await sql.unsafe(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
      )
    ).map((r) => r.indexname),
  )

  const functions = new Set(
    (
      await sql.unsafe(
        "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'",
      )
    ).map((r) => r.proname),
  )

  // `typtype = 'e'` filtra a enums. Sin ese filtro, `tenants_status` tambien
  // apareceria como el tipo compuesto que crea una tabla o una vista con el
  // mismo nombre.
  const types = new Set(
    (
      await sql.unsafe(
        "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'",
      )
    ).map((r) => r.typname),
  )

  // Columnas que deben haber cambiado de tipo. Se guarda como
  // `tabla.columna -> udt_name` porque **la existencia del tipo no alcanza**:
  // una migracion con varios pasos puede crear el enum y fallar en el `ALTER
  // COLUMN`, y como el item 43 documenta que drizzle se traga los errores, el
  // comando reportaria exito con el enum a medio aplicar.
  const columns = new Map(
    (
      await sql.unsafe(
        "SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public'",
      )
    ).map((r) => [`${r.table_name}.${r.column_name}`, r.udt_name]),
  )

  const missing = []
  const undeclared = []

  for (const entry of journal.entries) {
    const expected = EXPECTED[entry.tag]
    if (!expected) {
      console.log(`  FALTA ${entry.tag}: sin senal declarada en EXPECTED`)
      undeclared.push(entry.tag)
      continue
    }

    const absent = []
    for (const t of expected.tables ?? [])
      if (!tables.has(t)) absent.push(`tabla ${t}`)
    for (const i of expected.indexes ?? [])
      if (!indexes.has(i)) absent.push(`indice ${i}`)
    for (const f of expected.functions ?? [])
      if (!functions.has(f)) absent.push(`funcion ${f}`)
    for (const t of expected.types ?? [])
      if (!types.has(t)) absent.push(`tipo enum ${t}`)
    for (const [col, wantType] of Object.entries(expected.columns ?? {})) {
      const got = columns.get(col)
      if (got === undefined) absent.push(`columna ${col}`)
      else if (got !== wantType)
        absent.push(`columna ${col} es ${got}, se esperaba ${wantType}`)
    }

    if (absent.length === 0) {
      console.log(`  ok ${entry.tag}`)
    } else {
      console.log(`  FALTA ${entry.tag}: ${absent.join(', ')}`)
      missing.push({ tag: entry.tag, absent })
    }
  }

  await sql.end({ timeout: 5 })

  if (missing.length > 0) {
    console.error(
      '\nMigraciones declaradas en el journal sin efecto observable:',
    )
    for (const m of missing) {
      console.error(`  ${m.tag}: falta ${m.absent.join(', ')}`)
    }
    console.error(
      '\nSi drizzle-kit dijo exito, el tracking en drizzle.__drizzle_migrations no\n' +
        'describe el estado real. Ver item 94.',
    )
    process.exit(1)
  }

  if (undeclared.length > 0) {
    // Una migracion sin senal declarada es una migracion **no verificada**, y
    // eso es el mismo bug que este script existe para tapar: el comando dice
    // exito sin comprobar nada. Falla a proposito, para obligar a declarar el
    // efecto esperado cuando se agrega la migracion.
    console.error('\nMigraciones sin senal declarada en EXPECTED:')
    for (const tag of undeclared) console.error(`  ${tag}`)
    console.error(
      '\nAgrega en EXPECTED que se espera ver en la base (tipo, columna, indice\n' +
        'o funcion). Una migracion sin senal es una migracion sin verificar.',
    )
    process.exit(1)
  }

  console.log(
    '\nTodas las migraciones del journal tienen su efecto observable.',
  )
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
