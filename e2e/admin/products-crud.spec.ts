import { test, expect } from "@playwright/test";

test.describe("Admin - Products CRUD", () => {
  test("listar productos", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("h1")).toContainText("Productos");
  });

  test("crear producto nuevo", async ({ page }) => {
    await page.goto("/products/new");
    await page.fill("[data-testid=product-form-name]", "Test E2E Product");
    await page.fill("[data-testid=product-form-price]", "99.99");
    await page.click("[data-testid=product-form-submit]");
    await page.waitForURL("**/products");
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
