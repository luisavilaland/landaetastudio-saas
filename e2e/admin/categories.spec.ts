import { test, expect } from "@playwright/test";

test.describe("Admin - Categories", () => {
  test("listar categorías", async ({ page }) => {
    await page.goto("/categorias");
    await expect(page.getByRole("heading", { name: /Categorías/ })).toBeVisible();
  });

  test("crear categoría", async ({ page }) => {
    await page.goto("/categorias");
    await page.click("text=Nueva Categoría");
    await page.waitForSelector("[data-testid=category-form-name]");
    const uniqueName = `Test Cat ${Date.now()}`;
    await page.fill("[data-testid=category-form-name]", uniqueName);
    await page.click("[data-testid=category-form-submit]");
  });
});
