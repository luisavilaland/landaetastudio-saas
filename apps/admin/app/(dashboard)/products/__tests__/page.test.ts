import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { withTenantContext } from '@repo/db'
import { session } from '@repo/test-utils'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

vi.mock('@repo/db', async () => {
  const actual = await vi.importActual<typeof import('@repo/db')>('@repo/db')
  return { ...actual, withTenantContext: vi.fn(), db: undefined }
})

import { auth } from '@/lib/auth'
import ProductsPage from '../page'
import { ProductsTable } from '../products-table'

function txMock(datas: any[][]) {
  let i = 0
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: (resolve: (v: any) => any) => resolve(datas[i++] ?? []),
  }
  return chain
}

const productRow = {
  id: 'prod-1',
  name: 'Remera Test',
  slug: 'remera-test',
  description: null,
  imageUrl: null,
  status: 'active',
  createdAt: new Date('2026-01-15'),
  categoryId: 'cat-1',
  variantId: 'var-1',
  variantSku: 'REM-001',
  variantPrice: 1000,
  variantStock: 5,
}

function findNode(
  node: React.ReactNode,
  predicate: (el: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  const children = (node.props as { children?: React.ReactNode }).children
  return React.Children.toArray(children).reduce<React.ReactElement | null>(
    (found, child) => found ?? findNode(child, predicate),
    null,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(withTenantContext).mockImplementation(
    async (_tenantId: string, cb: (tx: any) => any) =>
      cb(
        txMock([
          [productRow],
          [{ id: 'cat-1', name: 'Remeras' }],
          [
            {
              id: 'img-1',
              productId: 'prod-1',
              url: 'https://img',
              alt: null,
              position: 0,
            },
          ],
        ]),
      ),
  )
})

describe('ProductsPage (server component)', () => {
  it('debe consultar productos dentro de withTenantContext con el tenantId de la sesión', async () => {
    vi.mocked(auth).mockResolvedValue(session('tenant-1'))

    const element = (await ProductsPage()) as React.ReactElement

    expect(withTenantContext).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    )
    const table = findNode(element, (el) => el.type === ProductsTable)
    expect(table).not.toBeNull()
    const initialProducts = (table!.props as any).initialProducts as unknown[]
    expect(initialProducts).toHaveLength(1)
    expect((initialProducts[0] as any).name).toBe('Remera Test')
    expect((initialProducts[0] as any).categoryName).toBe('Remeras')
  })
})
