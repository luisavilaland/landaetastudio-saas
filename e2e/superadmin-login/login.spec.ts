import { test, expect } from "@playwright/test";

test.describe("Superadmin - Login", () => {
  test("login superadmin redirige a tenants", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[data-testid=superadmin-email]", "super@admin.com");
    await page.fill("[data-testid=superadmin-password]", "123456");
    await page.click("[data-testid=superadmin-submit]");
    await page.waitForURL("**/tenants");
    expect(page.url()).toContain("/tenants");
  });
});
