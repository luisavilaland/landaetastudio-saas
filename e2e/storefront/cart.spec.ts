import { test, expect } from '@playwright/test'

test.describe('Cart', () => {
  test('carrito vacío muestra mensaje', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.locator('[data-testid=cart-empty]')).toBeVisible()
  })

  test('agregar producto al carrito', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-testid=product-card]').first()
    await card.click()
    await page.waitForURL('**/products/**')
    const addBtn = page.locator('[data-testid=add-to-cart]')
    await expect(addBtn).toBeEnabled({ timeout: 10_000 })
    await addBtn.click()
    await expect(page.locator('text=Agregado al carrito')).toBeVisible()
  })

  test('ver carrito con ítem', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-testid=product-card]').first()
    await card.click()
    await page.waitForURL('**/products/**')
    const addBtn = page.locator('[data-testid=add-to-cart]')
    await expect(addBtn).toBeEnabled({ timeout: 10_000 })
    await addBtn.click()
    await expect(page.locator('text=Agregado al carrito')).toBeVisible()
    await page.goto('/cart')
    // Timeout explícito: el primer hit a /cart (Server Component + GET /api/cart)
    // sufre cold-start de Vercel y el default (10s) queda corto -> flaky.
    await expect(page.locator('[data-testid=cart-item]')).toBeVisible({
      timeout: 30_000,
    })
  })
})
