import { chromium, type FullConfig } from "@playwright/test";

const ADMIN_URL =
  process.env.E2E_ADMIN_URL ??
  (process.env.CI ? "https://admin.landaetastudio.com" : "http://localhost:3001");
const SUPERADMIN_URL =
  process.env.E2E_SUPERADMIN_URL ??
  (process.env.CI
    ? "https://superadmin.landaetastudio.com"
    : "http://localhost:3002");

export default async function globalSetup(config: FullConfig) {
  const adminBrowser = await chromium.launch();
  const adminPage = await adminBrowser.newPage();
  await adminPage.goto(`${ADMIN_URL}/login`);
  await adminPage.fill("[name=email]", process.env.E2E_ADMIN_EMAIL!);
  await adminPage.fill("[name=password]", process.env.E2E_ADMIN_PASSWORD!);
  await adminPage.click("button[type=submit]");
  await adminPage.waitForURL("**/dashboard");
  await adminPage.context().storageState({ path: "e2e/.auth/admin.json" });
  await adminBrowser.close();

  const saBrowser = await chromium.launch();
  const saPage = await saBrowser.newPage();
  await saPage.goto(`${SUPERADMIN_URL}/login`);
  await saPage.fill("[name=email]", process.env.E2E_SUPERADMIN_EMAIL!);
  await saPage.fill("[name=password]", process.env.E2E_SUPERADMIN_PASSWORD!);
  await saPage.click("button[type=submit]");
  await saPage.waitForURL("**/tenants");
  await saPage.context().storageState({ path: "e2e/.auth/superadmin.json" });
  await saBrowser.close();
}