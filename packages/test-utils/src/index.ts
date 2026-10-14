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

/**
 * Mock de transaccion para tests. **La cola de `select` es POR INDICE.**
 *
 * Cada `makeTxMock({ select: [...] })` resuelve el N-esimo `select()` con la
 * N-esima entrada. Si el codigo de produccion agrega una query ANTES de las
 * que el test encola, las entradas quedan desalineadas y el test pasa (o
 * falla) por una razon que no es la que parece.
 *
 * **Caso vivo (S4c, 2026-10-14).** Los guards de permisos agregan dos selects
 * al principio - `tenants` y `subscriptions` - y los 13 tests de endpoint
 tuvieron que prefijar esas dos entradas a mano.
 *
 * Resolver por tabla en vez de por indice exigiria un objeto DISTINTO por
 * `select()` (hoy todas las cadenas son el mismo `tx`), o sea una
 * reescritura del nucleo de este helper, que usan 27 archivos. Se evaluo y se
 * descarto: el costo no se justifica por dos entradas al principio.
 *
 * Si agregas una query nueva que corra antes que las del test, actualiza la
 * cola.
 */
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
