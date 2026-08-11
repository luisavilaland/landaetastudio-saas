import { defineConfig } from '@playwright/test'

const STOREFRONT_URL =
  process.env.E2E_STOREFRONT_URL ??
  (process.env.CI
    ? 'https://tienda1.landaetastudio.com'
    : 'http://tienda1.lvh.me:3000')
const ADMIN_URL =
  process.env.E2E_ADMIN_URL ??
  (process.env.CI
    ? 'https://admin.landaetastudio.com'
    : 'http://localhost:3001')
const SUPERADMIN_URL =
  process.env.E2E_SUPERADMIN_URL ??
  (process.env.CI
    ? 'https://superadmin.landaetastudio.com'
    : 'http://localhost:3002')

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: 'e2e/global-setup.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: STOREFRONT_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'storefront',
      use: {
        baseURL: STOREFRONT_URL,
      },
      testMatch: 'storefront/*.spec.ts',
    },
    {
      name: 'checkout',
      use: {
        baseURL: STOREFRONT_URL,
      },
      testMatch: 'checkout/*.spec.ts',
    },
    {
      name: 'webhook',
      use: {
        baseURL: STOREFRONT_URL,
      },
      testMatch: 'webhook/*.spec.ts',
    },
    {
      name: 'admin',
      use: {
        baseURL: ADMIN_URL,
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: 'admin/*.spec.ts',
    },
    {
      name: 'superadmin',
      use: {
        baseURL: SUPERADMIN_URL,
        storageState: 'e2e/.auth/superadmin.json',
      },
      testMatch: 'superadmin/*.spec.ts',
    },
    {
      name: 'superadmin-login',
      use: {
        baseURL: SUPERADMIN_URL,
      },
      testMatch: 'superadmin-login/*.spec.ts',
    },
    {
      name: 'security',
      use: {
        baseURL: ADMIN_URL,
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: 'security/*.spec.ts',
    },
  ],
})
