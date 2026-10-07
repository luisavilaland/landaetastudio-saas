import { withSentryConfig } from '@sentry/nextjs/config'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const nextConfig = {
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
}

const sentryOptions = {
  org: process.env.SENTRY_ORG || '',
  project: process.env.SENTRY_PROJECT || 'saas-admin',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
}

const finalConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig

export default finalConfig
