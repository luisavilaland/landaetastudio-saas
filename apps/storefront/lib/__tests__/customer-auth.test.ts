import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

vi.mock('bcryptjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('bcryptjs')>()
  return {
    ...actual,
    default: { ...(actual.default as object), compare: vi.fn() },
    compare: vi.fn(),
  }
})

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return {
    ...actual,
    db: {},
    withTenantContext: vi.fn(),
  }
})

vi.mock('@repo/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { withTenantContext } from '@repo/db'
import { makeTxMock } from '@repo/test-utils'
import { authorizeCustomer } from '../customer-auth'

const TENANT_ID = 'tenant-123'
const EMAIL = 'cliente@test.com'
const PASSWORD = 'secreto123'

const CUSTOMER_ROW = {
  id: 'customer-1',
  tenantId: TENANT_ID,
  email: EMAIL,
  password: 'hash-criptado',
  name: 'Cliente Uno',
}

function setupTxMock(row: unknown[] | []) {
  vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
    cb(makeTxMock({ select: [{ data: row, terminal: 'limit' }] })),
  )
}

describe('authorizeCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
  })

  it('retorna el usuario del tenant si las credenciales son válidas', async () => {
    setupTxMock([CUSTOMER_ROW])

    const user = await authorizeCustomer(EMAIL, PASSWORD, TENANT_ID)

    expect(user).not.toBeNull()
    expect(user).toMatchObject({
      id: 'customer-1',
      email: EMAIL,
      tenantId: TENANT_ID,
      name: 'Cliente Uno',
    })
    expect(withTenantContext).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(Function),
    )
  })

  it('retorna null con contraseña incorrecta', async () => {
    setupTxMock([CUSTOMER_ROW])
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const user = await authorizeCustomer(EMAIL, 'incorrecta', TENANT_ID)
    expect(user).toBeNull()
  })

  it('retorna null si no se encuentra el cliente en ese tenant', async () => {
    setupTxMock([])
    const user = await authorizeCustomer(EMAIL, PASSWORD, TENANT_ID)
    expect(user).toBeNull()
  })

  it('retorna null si faltan credenciales', async () => {
    const user = await authorizeCustomer('', PASSWORD, TENANT_ID)
    expect(user).toBeNull()
    expect(withTenantContext).not.toHaveBeenCalled()
  })
})
