import { test, expect } from "@playwright/test";

test.describe("Auth - Storefront", () => {
  test("login con credenciales válidas redirige a home", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[data-testid=login-email]", "cliente@ejemplo.com");
    await page.fill("[data-testid=login-password]", "123456");
    await page.click("[data-testid=login-submit]");
    await page.waitForURL("/");
    expect(page.url()).not.toContain("/login");
  });

  test("login con email inválido muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[data-testid=login-email]", "noexiste@test.com");
    await page.fill("[data-testid=login-password]", "123456");
    await page.click("[data-testid=login-submit]");
    await expect(page.locator("[data-testid=login-error]")).toBeVisible();
  });

  test("login con contraseña incorrecta muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("[data-testid=login-email]", "admin@tienda1.com");
    await page.fill("[data-testid=login-password]", "incorrecta");
    await page.click("[data-testid=login-submit]");
    await expect(page.locator("[data-testid=login-error]")).toBeVisible();
  });

  test("el perfil de tienda es público y muestra el nombre", async ({ page }) => {
    await page.goto("/perfil");
    await expect(
      page.getByRole("heading", { name: "Tienda Demo" })
    ).toBeVisible();
  });
});
