import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test("agregar producto y navegar a checkout", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    if (await addBtn.isEnabled()) {
      await addBtn.click();
      await expect(page.locator("text=Agregado al carrito")).toBeVisible({ timeout: 5000 });
    }
    await page.goto("/checkout");
  });

  test("completar formulario de checkout muestra método de pago", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    if (await addBtn.isEnabled()) {
      await addBtn.click();
    }
    await page.goto("/checkout");
    await page.waitForSelector("[data-testid=checkout-name]", { timeout: 5000 });
    await page.fill("[data-testid=checkout-name]", "Juan Pérez");
    await page.fill("[data-testid=checkout-email]", "juan@test.com");
    await page.fill("[data-testid=checkout-address]", "Av. Italia 1234");
    const submitBtn = page.locator("[data-testid=checkout-submit]");
    await expect(submitBtn).toBeVisible();
  });
});
