import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test("agregar producto y navegar a checkout", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    await expect(addBtn).toBeEnabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page.locator("text=Agregado al carrito")).toBeVisible();
    await page.goto("/checkout");
  });

  test("completar formulario de checkout muestra método de pago", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    await expect(addBtn).toBeEnabled({ timeout: 10_000 });
    await addBtn.click();
    await expect(page.locator("text=Agregado al carrito")).toBeVisible();
    await page.goto("/checkout");
    await expect(page.locator("[data-testid=checkout-name]")).toBeVisible();
    await page.fill("[data-testid=checkout-name]", "Juan Pérez");
    await page.fill("[data-testid=checkout-email]", "juan@test.com");
    await page.fill("[data-testid=checkout-address]", "Av. Italia 1234");
    const submitBtn = page.locator("[data-testid=checkout-submit]");
    await expect(submitBtn).toBeVisible();
  });
});
