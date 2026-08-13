import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('homepage carga sin errores', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
  })

  test('navegación a categorías desde navbar', async ({ page }) => {
    await page.goto('/')
    const navBtn = page.locator('[data-testid=nav-categories]')
    if (await navBtn.isVisible()) {
      await navBtn.click()
      await expect(page.locator("a[href*='category=']").first()).toBeVisible()
    }
  })

  test('navegación a carrito desde header', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid=nav-cart]')
    await page.waitForURL('**/cart**')
    expect(page.url()).toContain('/cart')
  })
})
