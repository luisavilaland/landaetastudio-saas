import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTxExecute = vi.hoisted(() => vi.fn())
const mockWithTenantContext = vi.hoisted(() => vi.fn())

vi.mock('@repo/db', () => ({
  withTenantContext: mockWithTenantContext,
}))

vi.mock('drizzle-orm', () => {
  const sqlTag = (strings: TemplateStringsArray, ...values: any[]) => {
    const flattenedStrings: string[] = ['']
    const flattenedValues: any[] = []
    strings.forEach((str, i) => {
      if (i > 0) {
        const val = values[i - 1]
        if (val && typeof val === 'object' && val.strings && val.values) {
          // It's a SQL object, flatten it
          flattenedStrings.push(...val.strings.slice(1))
          flattenedValues.push(...val.values)
        } else {
          flattenedStrings.push(str)
          flattenedValues.push(val)
        }
      } else {
        flattenedStrings.push(str)
      }
    })
    return { strings: flattenedStrings, values: flattenedValues }
  }
  sqlTag.raw = (sqlString: string) => sqlString
  sqlTag.join = (chunks: any[], separator?: any) => {
    const combinedStrings: string[] = ['']
    const combinedValues: any[] = []
    chunks.forEach((chunk: any, i: number) => {
      if (chunk && chunk.strings && chunk.values) {
        const stringsToAdd = i === 0 ? chunk.strings : chunk.strings.slice(1)
        combinedStrings.push(...stringsToAdd)
        combinedValues.push(...chunk.values)
      }
      if (
        separator &&
        separator.strings &&
        separator.values &&
        i < chunks.length - 1
      ) {
        combinedStrings.push(...separator.strings.slice(1))
        combinedValues.push(...separator.values)
      }
    })
    return { strings: combinedStrings, values: combinedValues }
  }
  return { sql: sqlTag }
})

import { encryptToken, decryptToken, EncryptionError } from '../encryption'

describe('encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('encryptToken', () => {
    it('debe cifrar accessToken y webhookSecret correctamente', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({ execute: mockTxExecute })
        },
      )
      mockTxExecute.mockResolvedValue([])

      await encryptToken('tenant-1', 'clave-secreta', {
        accessToken: 'access-token-123',
        webhookSecret: 'webhook-secret-456',
      })

      expect(mockTxExecute).toHaveBeenCalledTimes(1)
      const call = mockTxExecute.mock.calls[0]
      const sqlObj = call[0]
      const fullSql = sqlObj.strings.join('')
      expect(fullSql).toContain('UPDATE "tenant_mp_config" SET')
      expect(fullSql).toContain('pgp_sym_encrypt')
    })

    it('debe lanzar error si key está vacía', async () => {
      await expect(
        encryptToken('tenant-1', '', { accessToken: 'token' }),
      ).rejects.toMatchObject({
        name: 'EncryptionError',
        code: 'EMPTY_KEY',
        message: expect.stringContaining('Clave de cifrado vacía'),
      })
    })

    it('no hace nada si no hay tokens para cifrar', async () => {
      await encryptToken('tenant-1', 'clave', {})
    })
  })

  describe('decryptToken', () => {
    it('debe descifrar accessTokenEnc correctamente', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockResolvedValue([{ value: 'access-token-123' }]),
          })
        },
      )

      const result = await decryptToken(
        'tenant-1',
        'clave-secreta',
        'accessTokenEnc',
      )
      expect(result).toBe('access-token-123')
    })

    it('debe descifrar webhookSecretEnc correctamente', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi
              .fn()
              .mockResolvedValue([{ value: 'webhook-secret-456' }]),
          })
        },
      )

      const result = await decryptToken(
        'tenant-1',
        'clave-secreta',
        'webhookSecretEnc',
      )
      expect(result).toBe('webhook-secret-456')
    })

    it('retorna null si el tenant no existe', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockResolvedValue([]),
          })
        },
      )

      const result = await decryptToken(
        'tenant-inexistente',
        'clave',
        'accessTokenEnc',
      )
      expect(result).toBeNull()
    })

    it('retorna null si el valor en BD es null', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockResolvedValue([{ value: null }]),
          })
        },
      )

      const result = await decryptToken('tenant-1', 'clave', 'accessTokenEnc')
      expect(result).toBeNull()
    })

    it('debe lanzar error si key está vacía', async () => {
      await expect(
        decryptToken('tenant-1', '', 'accessTokenEnc'),
      ).rejects.toMatchObject({
        name: 'EncryptionError',
        code: 'EMPTY_KEY',
        message: expect.stringContaining('Clave de descifrado vacía'),
      })
    })
  })

  describe('Aislamiento cross-tenant', () => {
    it('no permite leer tokens de otro tenant', async () => {
      mockWithTenantContext.mockImplementation(
        async (tenantId: string, callback: (tx: any) => Promise<any>) => {
          const value =
            tenantId === 'tenant-1' ? 'token-tenant-1' : 'token-tenant-2'
          return await callback({
            execute: vi.fn().mockResolvedValue([{ value }]),
          })
        },
      )

      const result1 = await decryptToken('tenant-1', 'key', 'accessTokenEnc')
      const result2 = await decryptToken('tenant-2', 'key', 'accessTokenEnc')

      expect(result1).toBe('token-tenant-1')
      expect(result2).toBe('token-tenant-2')
      expect(result1).not.toBe(result2)
    })
  })

  describe('Roundtrip encrypt/decrypt', () => {
    it('encrypt + decrypt = valor original (accessToken)', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({ execute: mockTxExecute })
        },
      )
      mockTxExecute.mockResolvedValue([])

      await encryptToken('tenant-1', 'key', { accessToken: 'original-token' })

      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockResolvedValue([{ value: 'original-token' }]),
          })
        },
      )

      const decrypted = await decryptToken('tenant-1', 'key', 'accessTokenEnc')
      expect(decrypted).toBe('original-token')
    })

    it('encrypt + decrypt = valor original (webhookSecret)', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({ execute: mockTxExecute })
        },
      )
      mockTxExecute.mockResolvedValue([])

      await encryptToken('tenant-1', 'key', {
        webhookSecret: 'original-secret',
      })

      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockResolvedValue([{ value: 'original-secret' }]),
          })
        },
      )

      const decrypted = await decryptToken(
        'tenant-1',
        'key',
        'webhookSecretEnc',
      )
      expect(decrypted).toBe('original-secret')
    })
  })

  describe('SQL bind params', () => {
    it('la clave NO aparece en el string SQL, solo en params', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({ execute: mockTxExecute })
        },
      )
      mockTxExecute.mockResolvedValue([])

      await encryptToken('tenant-1', 'clave-secreta-123', {
        accessToken: 'token-123',
      })

      const call = mockTxExecute.mock.calls[0]
      const sqlObj = call[0]
      const params = sqlObj.values

      expect(sqlObj.strings.join('')).not.toContain('clave-secreta-123')
      expect(params).toContain('clave-secreta-123')
    })
  })

  describe('ENCRYPTION_FAILED (pgcrypto error)', () => {
    it('encryptToken lanza EncryptionError cuando pgp_sym_encrypt falla', async () => {
      mockWithTenantContext.mockImplementation(
        async (_tenantId: string, callback: (tx: any) => Promise<any>) => {
          return await callback({
            execute: vi.fn().mockRejectedValue(new Error('Wrong key or corrupt data')),
          })
        },
      )

      await expect(
        encryptToken('tenant-1', 'clave-secreta', { accessToken: 'token' }),
      ).rejects.toMatchObject({
        name: 'EncryptionError',
        code: 'ENCRYPTION_FAILED',
        message: expect.stringContaining('Error al cifrar token'),
      })
    })
  })

  describe('Fail-closed en key vacía', () => {
    it('encryptToken lanza EncryptionError con key vacía', async () => {
      await expect(
        encryptToken('t1', '', { accessToken: 'x' }),
      ).rejects.toMatchObject({
        name: 'EncryptionError',
        code: 'EMPTY_KEY',
        message: expect.stringContaining('Clave de cifrado vacía'),
      })
    })

    it('decryptToken lanza EncryptionError con key vacía', async () => {
      await expect(decryptToken('t1', '', 'accessTokenEnc')).rejects.toMatchObject({
        name: 'EncryptionError',
        code: 'EMPTY_KEY',
        message: expect.stringContaining('Clave de descifrado vacía'),
      })
    })

    it('error es en español', async () => {
      try {
        await encryptToken('t1', '', { accessToken: 'x' })
      } catch (e: any) {
        expect(e.message).toContain('Clave de cifrado vacía')
      }
    })
  })
})
