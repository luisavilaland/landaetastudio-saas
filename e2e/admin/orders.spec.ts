import { test, expect } from '@playwright/test'

test.describe('Admin - Orders', () => {
  test('listar órdenes', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')
    // Debe existir al menos una fila de orden (detecta regresiones tipo RLS con 0 filas)
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
  })

  test('ver detalle de orden', async ({ page }) => {
    await page.goto('/orders')
    const orderLink = page.locator("a[href*='/orders/']").first()
    if (await orderLink.isVisible()) {
      await orderLink.click()
      await page.waitForURL('**/orders/**')
    }
  })
})
