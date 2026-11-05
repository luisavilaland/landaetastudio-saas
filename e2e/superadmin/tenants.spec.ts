import { test, expect, type Page } from '@playwright/test'

/**
 * El alta de tenant escribe contra la base **real** de la que corre el E2E
 * (preview sobre Neon), no contra una copia. Sin limpieza, cada corrida deja un
 * tenant `test-<timestamp>` que nadie borra: el 2026-11-05 habia al menos uno
 * (`test-1793899083356`) sin fila de suscripcion, y el gate de S4d lo reportaba
 * como caso raro cuando en realidad era basura de este spec.
 *
 * La limpieza va por la API (`DELETE /api/tenants/:id`, que borra en cascada lo
 * del tenant) y en `finally`, para que tambien corra si una asercion falla
 * despues del alta.
 */
async function deleteTenantBySlug(page: Page, slug: string): Promise<void> {
  const list = await page.request.get('/api/tenants')
  expect(list.ok(), 'GET /api/tenants should succeed').toBeTruthy()

  const { tenants } = (await list.json()) as {
    tenants: Array<{ id: string; slug: string }>
  }
  const created = tenants.find((tenant) => tenant.slug === slug)

  if (!created) {
    throw new Error(`tenant ${slug} was not created; nothing to clean up`)
  }

  const deleted = await page.request.delete(`/api/tenants/${created.id}`)
  expect(deleted.status(), `DELETE /api/tenants/${created.id}`).toBe(204)
}

test.describe('Superadmin - Tenants', () => {
  test('listar tenants', async ({ page }) => {
    await page.goto('/tenants')
    await expect(page.locator('[data-testid=tenant-table]')).toBeVisible()
  })

  test('crear tenant nuevo', async ({ page }) => {
    const uniqueSlug = `test-${Date.now()}`
    let created = false

    try {
      await page.goto('/tenants/new')
      await page.fill(
        '[data-testid=tenant-form-name]',
        `Test Tenant ${Date.now()}`,
      )
      await page.fill('#slug', uniqueSlug)
      await page.click('[data-testid=tenant-form-submit]')
      await page.waitForURL('**/tenants')
      created = true
    } finally {
      if (created) await deleteTenantBySlug(page, uniqueSlug)
    }
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
