import process from 'node:process'

// Backstop hardcodeado. El endpoint ya aparece en el comentario de la
// migración 0003 y el repo es público. No es la guarda principal —
// la guarda principal es SEED_ALLOWED_HOST con igualdad estricta.
// Ref: observación de Luis en #313 (2026-11-09).
export const PROD_HOST_MARKER = 'ep-dawn-hat-amtrizsw'

export function abort(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function parseUrl(name) {
  const raw = process.env[name]
  if (!raw) {
    throw new Error(
      `${name} no esta definida. Exportala o agregala a .env.local.`,
    )
  }
  try {
    return { raw, parsed: new URL(raw) }
  } catch {
    throw new Error(`${name} no es una URL valida.`)
  }
}

export function assertSafeEnv({ requireAllowSeed = false } = {}) {
  // 1. El seed es destructivo: requiere un opt-in explicito.
  if (requireAllowSeed && process.env.ALLOW_SEED !== 'true') {
    throw new Error('Falta ALLOW_SEED=true. Es obligatorio para correr este seed.')
  }

  // 2. Se exigen ambos roles.
  const owner = parseUrl('DATABASE_URL')
  const app = parseUrl('DATABASE_APP_URL')

  // 3. Allowlist de host: SEED_ALLOWED_HOST es la unica fuente de verdad.
  const allowedHost = process.env.SEED_ALLOWED_HOST
  if (!allowedHost) {
    throw new Error(
      'Falta SEED_ALLOWED_HOST. Copiá el hostname exacto de la rama de Neon (sin esquema ni puerto), ej: ep-xxx-pooler.us-east-2.aws.neon.tech.',
    )
  }

  const ownerHost = owner.parsed.hostname
  const appHost = app.parsed.hostname

  if (ownerHost !== allowedHost) {
    throw new Error(
      `DATABASE_URL apunta a ${ownerHost}, que no coincide con SEED_ALLOWED_HOST (${allowedHost}).`,
    )
  }
  if (appHost !== allowedHost) {
    throw new Error(
      `DATABASE_APP_URL apunta a ${appHost}, que no coincide con SEED_ALLOWED_HOST (${allowedHost}).`,
    )
  }

  // 4. Denylist de produccion. Es una red de seguridad aparte de la allowlist,
  // no la validacion principal: si el host es de prod, se aborta igual.
  for (const [name, host] of [
    ['DATABASE_URL', ownerHost],
    ['DATABASE_APP_URL', appHost],
  ]) {
    if (host.startsWith(PROD_HOST_MARKER)) {
      throw new Error(`${name} apunta al host de produccion (${host}).`)
    }
  }

  // 5. Nunca imprimir URLs completas: llevan password.
  console.log(`Host de Neon validado: ${allowedHost}`)

  return { ownerUrl: owner.raw, appUrl: app.raw, allowedHost }
}
