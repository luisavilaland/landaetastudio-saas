import { test, expect } from "@playwright/test";

test.describe("Register", () => {
  test("registro con datos válidos redirige a login", async ({ page }) => {
    await page.goto("/register");
    const uniqueEmail = `test-${Date.now()}@test.com`;
    await page.fill("[data-testid=register-name]", "Test User");
    await page.fill("[data-testid=register-email]", uniqueEmail);
    await page.fill("[data-testid=register-password]", "123456");
    await page.click("[data-testid=register-submit]");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("registro con email existente muestra error", async ({ page }) => {
    await page.goto("/register");
    await page.fill("[data-testid=register-name]", "Test User");
    await page.fill("[data-testid=register-email]", "admin@tienda1.com");
    await page.fill("[data-testid=register-password]", "123456");
    await page.click("[data-testid=register-submit]");
    await expect(page.locator("[data-testid=register-error]")).toBeVisible();
  });
});
