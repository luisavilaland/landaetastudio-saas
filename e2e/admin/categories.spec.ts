import { test, expect } from "@playwright/test";

test.describe("Admin - Categories", () => {
  test("listar categorías", async ({ page }) => {
    await page.goto("/categorias");
    await expect(page.getByRole("heading", { name: /Categorías/ })).toBeVisible();
    // La tabla no debe mostrar el estado vacío (detecta regresiones tipo RLS con 0 filas)
    await expect(page.getByText("No hay categorías. Crea la primera.")).not.toBeVisible();
  });

  test("crear categoría", async ({ page }) => {
    await page.goto("/categorias");
    await page.click("text=Nueva Categoría");
    await page.waitForSelector("[data-testid=category-form-name]");
    const uniqueName = `Test Cat ${Date.now()}`;
    await page.fill("[data-testid=category-form-name]", uniqueName);
    await page.click("[data-testid=category-form-submit]");
    // La categoría recién creada debe aparecer como fila en la tabla
    await expect(page.getByRole("cell", { name: uniqueName })).toBeVisible();
  });
});
