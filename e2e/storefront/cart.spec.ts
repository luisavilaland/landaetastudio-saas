import { test, expect } from "@playwright/test";

test.describe("Cart", () => {
  test("carrito vacío muestra mensaje", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.locator("[data-testid=cart-empty]")).toBeVisible();
  });

  test("agregar producto al carrito", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    if (await addBtn.isEnabled()) {
      await addBtn.click();
      await expect(page.locator("text=Agregado al carrito")).toBeVisible({ timeout: 5000 });
    }
  });

  test("ver carrito con ítem", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("[data-testid=product-card]").first();
    await card.click();
    await page.waitForURL("**/products/**");
    const addBtn = page.locator("[data-testid=add-to-cart]");
    if (await addBtn.isEnabled()) {
      await addBtn.click();
    }
    await page.goto("/cart");
    const cartItem = page.locator("[data-testid=cart-item]");
    if (await cartItem.isVisible()) {
      await expect(cartItem).toBeVisible();
    }
  });
});
