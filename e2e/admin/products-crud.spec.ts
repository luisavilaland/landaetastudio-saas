import { test, expect } from "@playwright/test";

test.describe("Admin - Products CRUD", () => {
  test("listar productos", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /Productos/ })).toBeVisible();
    // La tabla no debe mostrar el estado vacío (detecta regresiones tipo RLS con 0 filas)
    await expect(page.getByText("No hay productos. Crea el primero.")).not.toBeVisible();
  });

  test("crear producto nuevo", async ({ page }) => {
    await page.goto("/products/new");
    const productName = `Test E2E Product ${Date.now()}`;
    await page.fill("[data-testid=product-form-name]", productName);
    await page.fill("[data-testid=product-form-price]", "99.99");
    await page.fill("#stock", "10");
    await page.click("[data-testid=product-form-submit]");
    await page.waitForURL("**/products");
    // El producto recién creado debe aparecer como fila en la tabla
    await expect(page.getByRole("cell", { name: new RegExp(productName) })).toBeVisible();
  });

  test("eliminar producto", async ({ page }) => {
    await page.goto("/products");
    const deleteBtn = page.locator("[data-testid=delete-product]").first();
    if (await deleteBtn.isVisible()) {
      page.on("dialog", (dialog) => dialog.accept());
      await deleteBtn.click();
    }
  });
});
