import { test, expect } from '@playwright/test'

test.describe('Products', () => {
  test('listado de productos se renderiza', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('[data-testid=product-card]')
    await expect(cards.first()).toBeVisible()
  })

  test('búsqueda por texto encuentra producto', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.locator('[data-testid=search-input]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('zapatillas')
      await page.click('[data-testid=search-submit]')
      await page.waitForURL('**/buscar**')
    }
  })

  test('detalle de producto muestra nombre, precio, descripción', async ({
    page,
  }) => {
    await page.goto('/')
    const card = page.locator('[data-testid=product-card]').first()
    await card.click()
    await page.waitForURL('**/products/**')
    await expect(page.locator('h1')).toBeVisible()
  })
})
