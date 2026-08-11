import { test, expect } from '@playwright/test'

test.describe('Superadmin - Tenants', () => {
  test('listar tenants', async ({ page }) => {
    await page.goto('/tenants')
    await expect(page.locator('[data-testid=tenant-table]')).toBeVisible()
  })

  test('crear tenant nuevo', async ({ page }) => {
    await page.goto('/tenants/new')
    const uniqueSlug = `test-${Date.now()}`
    await page.fill(
      '[data-testid=tenant-form-name]',
      `Test Tenant ${Date.now()}`,
    )
    await page.fill('#slug', uniqueSlug)
    await page.click('[data-testid=tenant-form-submit]')
    await page.waitForURL('**/tenants')
  })

  test('ver detalle de tenant', async ({ page }) => {
    await page.goto('/tenants')
    const editBtn = page.locator('text=Editar').first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForURL('**/tenants/**/edit')
    }
  })
})
