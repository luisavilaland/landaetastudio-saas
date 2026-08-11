// Skip condicional: este spec necesita que el tenant T2 (tienda2) tenga al menos un
// producto seed para extraer un ID real y probar el aislamiento cross-tenant. Mientras el
// entorno de pruebas no cuente con un segundo tenant con productos (se requiere un tenant T2
// con datos seed accesible vía E2E_STOREFRONT_T2_URL o el dominio de preview), el test se salta
// en runtime con "No hay productos seed para tienda2". Se habilitará por completo cuando exista
// un fixture/seed multi-tenant que garantice productos para tienda2.
import { test, expect } from '@playwright/test'

const STOREFRONT_T2_URL =
  process.env.E2E_STOREFRONT_T2_URL ??
  (process.env.CI
    ? 'https://tienda2.landaetastudio.com'
    : 'http://tienda2.lvh.me:3000')

test.describe('Cross-tenant isolation', () => {
  test('admin T1 no puede acceder a producto de T2', async ({
    page,
    request,
  }) => {
    const t2Page = await page.context().newPage()
    await t2Page.goto(`${STOREFRONT_T2_URL}/products`)

    const firstProductLink = t2Page.locator("a[href*='/products/']").first()
    let firstProductId = ''
    if (await firstProductLink.isVisible()) {
      const href = await firstProductLink.getAttribute('href')
      firstProductId = href?.split('/').pop() || ''
    }
    await t2Page.close()

    if (!firstProductId) {
      test.skip(true, 'No hay productos seed para tienda2')
    }

    const getRes = await request.get(`/api/products/${firstProductId}`)
    expect([403, 404]).toContain(getRes.status())

    const putRes = await request.put(`/api/products/${firstProductId}`, {
      data: { name: 'Intento cross-tenant' },
    })
    expect([403, 404]).toContain(putRes.status())

    const deleteRes = await request.delete(`/api/products/${firstProductId}`)
    expect([403, 404]).toContain(deleteRes.status())
  })
})
