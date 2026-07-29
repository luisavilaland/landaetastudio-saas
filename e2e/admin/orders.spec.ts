import { test, expect } from "@playwright/test";

test.describe("Admin - Orders", () => {
  test("listar órdenes", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForLoadState("networkidle");
  });

  test("ver detalle de orden", async ({ page }) => {
    await page.goto("/orders");
    const orderLink = page.locator("a[href*='/orders/']").first();
    if (await orderLink.isVisible()) {
      await orderLink.click();
      await page.waitForURL("**/orders/**");
    }
  });
});
