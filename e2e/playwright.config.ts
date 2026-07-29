import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
    },
    {
      name: "storefront",
      use: {
        baseURL: "http://tienda1.lvh.me:3000",
      },
      testMatch: "e2e/storefront/*.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "checkout",
      use: {
        baseURL: "http://tienda1.lvh.me:3000",
      },
      testMatch: "e2e/checkout/*.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "admin",
      use: {
        baseURL: "http://localhost:3001",
        storageState: "e2e/.auth/admin.json",
      },
      testMatch: "e2e/admin/*.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "superadmin",
      use: {
        baseURL: "http://localhost:3002",
        storageState: "e2e/.auth/superadmin.json",
      },
      testMatch: "e2e/superadmin/*.spec.ts",
      dependencies: ["setup"],
    },
    {
      name: "security",
      use: {
        baseURL: "http://localhost:3001",
        storageState: "e2e/.auth/admin.json",
      },
      testMatch: "e2e/security/*.spec.ts",
      dependencies: ["setup"],
    },
  ],
});