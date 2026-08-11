import { vi } from 'vitest'
import { NextRequest } from 'next/server'

interface TxSelectEntry {
  data: any[]
  terminal?: 'where' | 'limit' | 'orderBy'
}

interface MakeTxMockConfig {
  select?: TxSelectEntry[]
  repeatLastSelect?: boolean
}

export function makeTxMock(config?: MakeTxMockConfig) {
  const tx: any = {}

  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'insert',
    'values',
    'update',
    'set',
    'delete',
    'returning',
    'execute',
    'groupBy',
  ]
  for (const m of methods) {
    tx[m] = vi.fn()
  }

  tx.select.mockReturnValue(tx)
  tx.from.mockReturnValue(tx)
  tx.where.mockReturnValue(tx)
  tx.orderBy.mockReturnValue(tx)
  tx.limit.mockReturnValue(tx)
  tx.groupBy?.mockReturnValue(tx)
  tx.update.mockReturnValue(tx)
  tx.set.mockReturnValue(tx)
  tx.delete.mockReturnValue(tx)
  tx.insert.mockReturnValue(tx)
  tx.values.mockReturnValue(tx)
  tx.returning.mockResolvedValue([{}])
  tx.execute.mockResolvedValue(undefined)

  if (config?.select && config.select.length > 0) {
    tx.select.mockReset()
    tx.from.mockReset()
    tx.where.mockReset()
    tx.limit.mockReset()
    tx.orderBy.mockReset()

    for (const entry of config.select) {
      const terminal = entry.terminal || 'where'
      tx.select.mockReturnValueOnce(tx)
      tx.from.mockReturnValueOnce(tx)

      if (terminal === 'where') {
        tx.where.mockResolvedValueOnce(entry.data)
      } else if (terminal === 'limit') {
        tx.where.mockReturnValueOnce(tx)
        tx.limit.mockResolvedValueOnce(entry.data)
      } else if (terminal === 'orderBy') {
        tx.where.mockReturnValueOnce(tx)
        tx.orderBy.mockResolvedValueOnce(entry.data)
      }
    }

    tx.where.mockReturnValue(tx)
    tx.limit.mockReturnValue(tx)
    tx.orderBy.mockReturnValue(tx)

    if (config.repeatLastSelect) {
      tx.select.mockReturnValue(tx)
      tx.from.mockReturnValue(tx)
      const lastEntry = config.select[config.select.length - 1]
      const lastTerminal = lastEntry.terminal || 'where'
      if (lastTerminal === 'limit') {
        tx.limit.mockResolvedValue(lastEntry.data)
      } else if (lastTerminal === 'orderBy') {
        tx.orderBy.mockResolvedValue(lastEntry.data)
      } else {
        tx.where.mockResolvedValue(lastEntry.data)
      }
    } else {
      const msg = (m: string) =>
        `queue exhausted for ${m}(): more select() calls than entries configured (use repeatLastSelect to repeat the last)`
      tx.select.mockImplementation(() => {
        throw new Error(msg('select'))
      })
      tx.from.mockImplementation(() => {
        throw new Error(msg('from'))
      })
    }
  }

  return tx
}

export function session(tenantId: string, email = 'admin@test.com') {
  return {
    user: { tenantId, email },
    expires: '2099-01-01',
  }
}

export function mockReq(
  method: string,
  body?: Record<string, unknown> | FormData,
  headerOverrides?: Record<string, string>,
): NextRequest {
  const isFormData = body instanceof FormData
  const headers = new Headers({
    'content-type': isFormData ? 'multipart/form-data' : 'application/json',
  })
  if (headerOverrides) {
    for (const [k, v] of Object.entries(headerOverrides)) {
      headers.set(k, v)
    }
  }
  return {
    json: async () => (isFormData ? {} : (body ?? {})),
    text: async () => (isFormData ? '' : JSON.stringify(body ?? {})),
    formData: async () => (isFormData ? body : new FormData()),
    headers,
    nextUrl: new URL('http://localhost'),
    cookies: { get: vi.fn() },
    method,
  } as unknown as NextRequest
}
