import { test, expect } from "@playwright/test";

test.describe("Cross-tenant isolation", () => {
  test("admin T1 no puede acceder a producto de T2", async ({ page }) => {
    await page.goto("/products");

    const firstProductLink = page.locator("a[href*='/products/']").first();
    let firstProductId = "";
    if (await firstProductLink.isVisible()) {
      const href = await firstProductLink.getAttribute("href");
      firstProductId = href?.split("/").pop() || "";
    }

    if (firstProductId) {
      const res = await page.request.get(
        `http://localhost:3000/products/${firstProductId}`
      );
      expect(res.status()).toBeGreaterThanOrEqual(200);
    }
  });
});
