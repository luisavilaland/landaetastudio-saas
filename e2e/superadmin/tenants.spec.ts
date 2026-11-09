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
 *
 * Las aserciones usan `expect.soft` a proposito: esto se ejecuta en el `finally`
 * del test, y un `expect` duro lanzaria desde ahi tapando el error original.
 * Una limpieza que falla tiene que quedar reportada, no reemplazar el rojo.
 */
async function deleteTenantBySlug(page: Page, slug: string): Promise<void> {
  const list = await page.request.get('/api/tenants')
  expect.soft(list.ok(), 'GET /api/tenants should succeed').toBeTruthy()

  // Sin una lista valida no se puede buscar el id; seguir solo agregaria ruido.
  if (!list.ok()) return

  const { tenants } = (await list.json()) as {
    tenants: Array<{ id: string; slug: string }>
  }
  const created = tenants.find((tenant) => tenant.slug === slug)

  // La limpieza no puede ser la causa de un fallo: si el alta nunca llego a
  // crear el tenant, no hay nada que borrar.
  if (!created) return

  const deleted = await page.request.delete(`/api/tenants/${created.id}`)
  expect.soft(deleted.status(), `DELETE /api/tenants/${created.id}`).toBe(204)
}

test.describe('Superadmin - Tenants', () => {
  test('listar tenants', async ({ page }) => {
    await page.goto('/tenants')
    await expect(page.locator('[data-testid=tenant-table]')).toBeVisible()
  })

  test('crear tenant nuevo', async ({ page }) => {
    const uniqueSlug = `test-${Date.now()}`

    try {
      await page.goto('/tenants/new')
      await page.fill(
        '[data-testid=tenant-form-name]',
        `Test Tenant ${Date.now()}`,
      )
      await page.fill('#slug', uniqueSlug)
      await page.click('[data-testid=tenant-form-submit]')
      await page.waitForURL('**/tenants')
    } finally {
      // Siempre: si el alta fallo a mitad de camino, el tenant puede existir
      // igual y nadie mas lo va a borrar.
      await deleteTenantBySlug(page, uniqueSlug)
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
