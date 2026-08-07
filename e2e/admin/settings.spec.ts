import { test, expect } from "@playwright/test";

test.describe("Admin - Settings", () => {
  test("ver configuración de tienda", async ({ page }) => {
    await page.goto("/store/settings");
    await expect(
      page.getByRole("heading", { name: /Configuración/ })
    ).toBeVisible();
  });
});
