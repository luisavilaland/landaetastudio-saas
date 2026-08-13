import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTransaction = vi.hoisted(() => vi.fn())

vi.mock('postgres', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({
    transaction: mockTransaction,
  })),
}))

import { withTenantContext } from '../index'

describe('withTenantContext', () => {
  beforeEach(() => {
    mockTransaction.mockReset()
  })

  it('should call db.transaction once', async () => {
    const tx = { execute: vi.fn() }
    mockTransaction.mockImplementation(async (cb) => {
      await cb(tx)
      return 'ok'
    })

    await withTenantContext('tenant-id', async () => {})

    expect(mockTransaction).toHaveBeenCalledOnce()
  })

  it('should call tx.execute with set_tenant_id inside transaction', async () => {
    const tx = { execute: vi.fn() }
    mockTransaction.mockImplementation(async (cb) => {
      await cb(tx)
    })

    await withTenantContext('test-tenant-id', async () => {})

    expect(tx.execute).toHaveBeenCalledOnce()
  })

  it('should pass tx to the user callback', async () => {
    const tx = { execute: vi.fn() }
    mockTransaction.mockImplementation(async (cb) => {
      await cb(tx)
    })

    let receivedTx: unknown
    await withTenantContext('tenant-id', async (tx) => {
      receivedTx = tx
    })

    expect(receivedTx).toBe(tx)
  })

  it('should return the callback result', async () => {
    const tx = { execute: vi.fn() }
    mockTransaction.mockImplementation(async (cb) => {
      return await cb(tx)
    })

    const result = await withTenantContext('tenant-id', async () => 'done')

    expect(result).toBe('done')
  })

  it('should return the transaction result when callback returns undefined', async () => {
    const tx = { execute: vi.fn() }
    mockTransaction.mockImplementation(async (cb) => {
      await cb(tx)
      return 'tx-result'
    })

    const result = await withTenantContext('tenant-id', async () => {})

    expect(result).toBe('tx-result')
  })

  it('should re-throw when db.transaction rejects', async () => {
    mockTransaction.mockRejectedValue(new Error('db error'))

    await expect(
      withTenantContext('tenant-id', async () => {}),
    ).rejects.toThrow('db error')
  })
})
