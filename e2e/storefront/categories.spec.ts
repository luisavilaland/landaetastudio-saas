import { test, expect } from '@playwright/test'

test.describe('Categories', () => {
  test('navegación por categoría desde home', async ({ page }) => {
    await page.goto('/')
    const navBtn = page.locator('[data-testid=nav-categories]')
    if (await navBtn.isVisible()) {
      await navBtn.click()
      const catLink = page.locator("a[href*='category=']").first()
      if (await catLink.isVisible()) {
        const href = await catLink.getAttribute('href')
        await catLink.click()
        await page.waitForURL(`**${href}`)
      }
    }
  })
})
