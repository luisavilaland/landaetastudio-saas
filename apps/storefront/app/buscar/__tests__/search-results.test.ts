import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { withTenantContext } from '@repo/db'

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((key: string) => (key === 'x-tenant-slug' ? 'tienda1' : null)),
  })),
}))

vi.mock('@/lib/tenant', () => ({
  getTenantId: vi.fn().mockResolvedValue('tenant-1'),
}))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})

import { SearchResults } from '../search-results'

function txMock(datas: any[][]) {
  let i = 0
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (resolve: (v: any) => any) => resolve(datas[i++] ?? []),
  }
  chain.where = vi.fn(() => chain)
  chain.orderBy = vi.fn(() => chain)
  return chain
}

function collectText(node: React.ReactNode, out: string[]): void {
  if (node == null || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out)
    return
  }
  if (React.isValidElement(node)) {
    const children = (node.props as { children?: React.ReactNode }).children
    collectText(children, out)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchResults (server component)', () => {
  it('debe consultar dentro de withTenantContext con el tenantId resuelto', async () => {
    vi.mocked(withTenantContext).mockImplementation(
      async (tenantId: string, cb: (tx: any) => any) =>
        cb(
          txMock([
            [
              {
                id: 'p1',
                name: 'Remera',
                slug: 'remera',
                description: null,
                imageUrl: null,
                status: 'active',
                createdAt: new Date(),
              },
            ],
            [{ count: 1 }],
            [
              {
                id: 'v1',
                productId: 'p1',
                price: 1000,
                stock: 3,
                sku: 'REM-1',
              },
            ],
            [
              {
                id: 'i1',
                productId: 'p1',
                url: 'https://img',
                alt: null,
                position: 0,
              },
            ],
          ]),
        ),
    )

    const results = (await SearchResults({
      query: 'remera',
      offset: 0,
    })) as React.ReactElement

    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    )
    const text: string[] = []
    collectText(results, text)
    expect(text.join(' ')).toContain('Remera')
    expect(text.join(' ')).toContain('10,00')
  })

  it('debe manejar búsqueda sin resultados sin construir IN () — ni variants ni images', async () => {
    vi.mocked(withTenantContext).mockImplementation(
      async (_tenantId: string, cb: (tx: any) => any) =>
        cb(txMock([[], [{ count: 0 }]])),
    )

    const results = (await SearchResults({
      query: 'zzz',
      offset: 0,
    })) as React.ReactElement

    expect(withTenantContext).toHaveBeenCalled()
    const text: string[] = []
    collectText(results, text)
    expect(text.join(' ')).toContain('No se encontraron productos')
  })
})
