import { chromium, type FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const adminBrowser = await chromium.launch();
  const adminPage = await adminBrowser.newPage();
  await adminPage.goto("http://localhost:3001/login");
  await adminPage.fill("[name=email]", process.env.E2E_ADMIN_EMAIL!);
  await adminPage.fill("[name=password]", process.env.E2E_ADMIN_PASSWORD!);
  await adminPage.click("button[type=submit]");
  await adminPage.waitForURL("http://localhost:3001/");
  await adminPage.context().storageState({ path: "e2e/.auth/admin.json" });
  await adminBrowser.close();

  const saBrowser = await chromium.launch();
  const saPage = await saBrowser.newPage();
  await saPage.goto("http://localhost:3002/login");
  await saPage.fill("[name=email]", process.env.E2E_SUPERADMIN_EMAIL!);
  await saPage.fill("[name=password]", process.env.E2E_SUPERADMIN_PASSWORD!);
  await saPage.click("button[type=submit]");
  await saPage.waitForURL("http://localhost:3002/");
  await saPage.context().storageState({ path: "e2e/.auth/superadmin.json" });
  await saBrowser.close();
}