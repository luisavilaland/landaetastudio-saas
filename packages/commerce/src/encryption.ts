import { withTenantContext } from '@repo/db'
import { sql, type SQL } from 'drizzle-orm'

/**
 * Cifra los tokens de MercadoPago del tenant y los guarda en tenant_mp_config.
 *
 * @param tenantId - ID del tenant (UUID string)
 * @param key - Clave de cifrado (MP_TOKEN_ENCRYPTION_KEY). El CALLER es responsable
 *   de leer process.env.MP_TOKEN_ENCRYPTION_KEY y fallar temprano si falta.
 *   El helper NO lee variables de entorno internamente.
 * @param values - Objeto con accessToken y/o webhookSecret a cifrar
 *
 * La clave viaja como bind param directo a pgp_sym_encrypt/pgp_sym_decrypt
 * (no SET LOCAL, no set_config). ADR-024 enmienda 2026-09-18.
 */
export async function encryptToken(
  tenantId: string,
  key: string,
  values: { accessToken?: string; webhookSecret?: string }
): Promise<void> {
  if (!key) {
    throw new Error('Clave de cifrado vacía: MP_TOKEN_ENCRYPTION_KEY es requerida')
  }

  if (!values.accessToken && !values.webhookSecret) {
    return
  }

await withTenantContext(tenantId, async (tx) => {
    const setClauses: SQL[] = []
    const params: unknown[] = []

    if (values.accessToken !== undefined) {
      params.push(values.accessToken, key)
      setClauses.push(sql`"accessTokenEnc" = pgp_sym_encrypt(${params[params.length - 2]}, ${params[params.length - 1]})`)
    }

    if (values.webhookSecret !== undefined) {
      params.push(values.webhookSecret, key)
      setClauses.push(sql`"webhookSecretEnc" = pgp_sym_encrypt(${params[params.length - 2]}, ${params[params.length - 1]})`)
    }

    if (setClauses.length > 0) {
      params.push(tenantId)
      const query = sql`UPDATE "tenant_mp_config" SET ${sql.join(setClauses, sql`, `)} WHERE "tenantId" = ${params[params.length - 1]}`
      await tx.execute(query)
    }
  })
}

/**
 * Descifra un token de MercadoPago del tenant desde tenant_mp_config.
 *
 * @param tenantId - ID del tenant (UUID string)
 * @param key - Clave de descifrado (MP_TOKEN_ENCRYPTION_KEY). El CALLER es responsable
 *   de leer process.env.MP_TOKEN_ENCRYPTION_KEY y fallar temprano si falta.
 *   El helper NO lee variables de entorno internamente.
 * @param column - Columna a descifrar: 'accessTokenEnc' o 'webhookSecretEnc'
 *
 * Retorna el valor descifrado o null si no existe.
 *
 * La clave viaja como bind param directo a pgp_sym_decrypt
 * (no SET LOCAL, no set_config). ADR-024 enmienda 2026-09-18.
 */
export async function decryptToken(
  tenantId: string,
  key: string,
  column: 'accessTokenEnc' | 'webhookSecretEnc'
): Promise<string | null> {
  if (!key) {
    throw new Error('Clave de descifrado vacía: MP_TOKEN_ENCRYPTION_KEY es requerida')
  }

  return await withTenantContext(tenantId, async (tx) => {
    let result: { value: string | null }[] = []
    try {
      result = await tx.execute(
        sql`SELECT pgp_sym_decrypt(${column}, ${key}) AS value FROM "tenant_mp_config" WHERE "tenantId" = ${tenantId}`
      )
    } catch (e: any) {
      throw new EncryptionError('DECRYPTION_FAILED', 'Error al descifrar token: clave inválida o datos corruptos', e)
    }

    if (result.length === 0 || result[0].value === null) {
      return null
    }

    return result[0].value as string
  })
}

export type EncryptionErrorCode =
  | 'EMPTY_KEY'
  | 'TENANT_NOT_FOUND'
  | 'DECRYPTION_FAILED'
  | 'ENCRYPTION_FAILED'

/**
 * Error tipado para operaciones de cifrado/descifrado.
 * Permite al caller manejar errores específicos sin parsear mensajes.
 */
export class EncryptionError extends Error {
  constructor(
    public readonly code: EncryptionErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'EncryptionError'
  }
}