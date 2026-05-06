import { config } from 'dotenv';
config({ path: '../../.env.local' });

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
};

const sentryOptions = {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "saas-admin",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

const finalConfig: NextConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;

export default finalConfig;
