import { describe, it, expect, vi } from 'vitest'

vi.mock('@repo/db', () => ({
  db: { select: vi.fn() },
  dbAdminUsers: {},
  withTenantContext: vi.fn(),
}))
vi.mock('bcryptjs', () => ({ compare: vi.fn() }))
vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: vi.fn(() => ({ id: 'credentials', name: 'Credentials' })),
}))
vi.mock('next-auth', () => {
  return {
    __esModule: true,
    default: vi.fn(() => ({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    })),
  }
})

import {
  createAdminAuth,
  createSuperadminAuth,
  adminAuth,
  auth,
  superadminAuth,
  superadminAuthFn,
} from '../index'

describe('@repo/auth', () => {
  it('should export createAdminAuth function', () => {
    expect(typeof createAdminAuth).toBe('function')
  })

  it('should export createSuperadminAuth function', () => {
    expect(typeof createSuperadminAuth).toBe('function')
  })

  it('should export adminAuth instance', () => {
    expect(adminAuth).toBeDefined()
  })

  it('should export auth function from adminAuth', () => {
    expect(typeof auth).toBe('function')
  })

  it('should export superadminAuth instance', () => {
    expect(superadminAuth).toBeDefined()
  })

  it('should export superadminAuthFn function', () => {
    expect(typeof superadminAuthFn).toBe('function')
  })

  it('should create two different auth instances', () => {
    expect(superadminAuth).not.toBe(adminAuth)
  })
})
