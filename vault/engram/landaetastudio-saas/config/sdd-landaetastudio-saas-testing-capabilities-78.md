---
id: 78
type: config
project: landaetastudio-saas
scope: project
topic_key: sdd/landaetastudio-saas/testing-capabilities
session_id: ses_f087e3bfcffew6S7dZjBCkv3lW
created_at: "2026-10-01 12:59:49"
updated_at: "2026-10-01 12:59:49"
revision_count: 1
tags:
  - landaetastudio-saas
  - config
aliases:
  - "sdd/landaetastudio-saas/testing-capabilities"
---

# sdd/landaetastudio-saas/testing-capabilities

**What**: Testing capabilities for landaetastudio-saas workspace
**Why**: Required by SDD init for hybrid persistence mode
**Where**: openspec/config.yaml testing section
**Learned**: 
- Strict TDD: enabled (workspace-level vitest covers all 10 projects)
- Workspace test command: `pnpm test` (vitest run)
- Coverage command: `pnpm test --coverage` (v8 provider)
- E2E command: `pnpm test:e2e` (Playwright)
- All 10 projects use vitest with same root config
- Test layers vary: apps have unit+integration, packages mostly unit only
- Quality tools: ESLint, tsc --noEmit, Prettier (markdown only)

### Testing Capabilities

**Strict TDD Mode**: enabled
**Detected**: 2026-10-01

### Projects

| Relative path | Stack | Test command | Framework |
| ------------- | ----- | ------------ | --------- |
| `apps/storefront` | Next.js 16 (App Router, React 19, TypeScript) | `pnpm test` | vitest |
| `apps/admin` | Next.js 16 (App Router, React 19, TypeScript) | `pnpm test` | vitest |
| `apps/superadmin` | Next.js 16 (App Router, React 19, TypeScript) | `pnpm test` | vitest |
| `packages/auth` | TypeScript (ESM, NextAuth v5) | `pnpm test` | vitest |
| `packages/commerce` | TypeScript (ESM, Drizzle, Redis) | `pnpm test` | vitest |
| `packages/db` | TypeScript (Drizzle ORM, PostgreSQL) | `pnpm test` | vitest |
| `packages/logger` | TypeScript (ESM, pino) | `pnpm test` | vitest |
| `packages/storage` | TypeScript (MinIO/R2 client) | `pnpm test` | vitest |
| `packages/test-utils` | TypeScript (ESM, vitest utilities) | `pnpm test` | vitest |
| `packages/validation` | TypeScript (ESM, Zod v4) | `pnpm test` | vitest |

### Test Layers

| Relative path | Layer | Available | Tool |
| ------------- | ----------- | --------- | ----------- |
| `apps/storefront` | Unit | ✅ | vitest |
| `apps/storefront` | Integration | ✅ | vitest |
| `apps/storefront` | E2E | ❌ | — |
| `apps/admin` | Unit | ✅ | vitest |
| `apps/admin` | Integration | ✅ | vitest |
| `apps/admin` | E2E | ❌ | — |
| `apps/superadmin` | Unit | ✅ | vitest |
| `apps/superadmin` | Integration | ✅ | vitest |
| `apps/superadmin` | E2E | ❌ | — |
| `packages/auth` | Unit | ✅ | vitest |
| `packages/auth` | Integration | ❌ | — |
| `packages/auth` | E2E | ❌ | — |
| `packages/commerce` | Unit | ✅ | vitest |
| `packages/commerce` | Integration | ✅ | vitest |
| `packages/commerce` | E2E | ❌ | — |
| `packages/db` | Unit | ✅ | vitest |
| `packages/db` | Integration | ✅ | vitest |
| `packages/db` | E2E | ❌ | — |
| `packages/logger` | Unit | ✅ | vitest |
| `packages/logger` | Integration | ❌ | — |
| `packages/logger` | E2E | ❌ | — |
| `packages/storage` | Unit | ✅ | vitest |
| `packages/storage` | Integration | ❌ | — |
| `packages/storage` | E2E | ❌ | — |
| `packages/test-utils` | Unit | ✅ | vitest |
| `packages/test-utils` | Integration | ❌ | — |
| `packages/test-utils` | E2E | ❌ | — |
| `packages/validation` | Unit | ✅ | vitest |
| `packages/validation` | Integration | ❌ | — |
| `packages/validation` | E2E | ❌ | — |

### Coverage

| Relative path | Available | Command |
| ------------- | --------- | ------- |
| `apps/storefront` | ✅ | `pnpm test --coverage` |
| `apps/admin` | ✅ | `pnpm test --coverage` |
| `apps/superadmin` | ✅ | `pnpm test --coverage` |
| `packages/auth` | ✅ | `pnpm test --coverage` |
| `packages/commerce` | ✅ | `pnpm test --coverage` |
| `packages/db` | ✅ | `pnpm test --coverage` |
| `packages/logger` | ✅ | `pnpm test --coverage` |
| `packages/storage` | ✅ | `pnpm test --coverage` |
| `packages/test-utils` | ✅ | `pnpm test --coverage` |
| `packages/validation` | ✅ | `pnpm test --coverage` |

### Quality Tools

| Relative path | Tool | Available | Command |
| ------------- | ------------ | --------- | -------------- |
| `apps/storefront` | Linter | ✅ | `pnpm lint` |
| `apps/storefront` | Type checker | ✅ | `pnpm typecheck` |
| `apps/storefront` | Formatter | ✅ | `pnpm format:check` |
| `apps/admin` | Linter | ✅ | `pnpm lint` |
| `apps/admin` | Type checker | ✅ | `pnpm typecheck` |
| `apps/admin` | Formatter | ✅ | `pnpm format:check` |
| `apps/superadmin` | Linter | ✅ | `pnpm lint` |
| `apps/superadmin` | Type checker | ✅ | `pnpm typecheck` |
| `apps/superadmin` | Formatter | ✅ | `pnpm format:check` |
| `packages/auth` | Linter | ✅ | `pnpm lint` |
| `packages/auth` | Type checker | ✅ | `pnpm typecheck` |
| `packages/auth` | Formatter | ✅ | `pnpm format:check` |
| `packages/commerce` | Linter | ✅ | `pnpm lint` |
| `packages/commerce` | Type checker | ✅ | `pnpm typecheck` |
| `packages/commerce` | Formatter | ✅ | `pnpm format:check` |
| `packages/db` | Linter | ✅ | `pnpm lint` |
| `packages/db` | Type checker | ✅ | `pnpm typecheck` |
| `packages/db` | Formatter | ✅ | `pnpm format:check` |
| `packages/logger` | Linter | ✅ | `pnpm lint` |
| `packages/logger` | Type checker | ✅ | `pnpm typecheck` |
| `packages/logger` | Formatter | ✅ | `pnpm format:check` |
| `packages/storage` | Linter | ✅ | `pnpm lint` |
| `packages/storage` | Type checker | ✅ | `pnpm typecheck` |
| `packages/storage` | Formatter | ✅ | `pnpm format:check` |
| `packages/test-utils` | Linter | ✅ | `pnpm lint` |
| `packages/test-utils` | Type checker | ✅ | `pnpm typecheck` |
| `packages/test-utils` | Formatter | ✅ | `pnpm format:check` |
| `packages/validation` | Linter | ✅ | `pnpm lint` |
| `packages/validation` | Type checker | ✅ | `pnpm typecheck` |
| `packages/validation` | Formatter | ✅ | `pnpm format:check` |

---
*Session*: [[session-ses_f087e3bfcffew6S7dZjBCkv3lW]]
*Topic*: [[topic-sdd--landaetastudio-saas]]
