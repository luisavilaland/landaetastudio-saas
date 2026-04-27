# @repo/auth

Shared NextAuth configuration for admin and superadmin apps.

## Usage

```ts
import { handlers, auth } from "@repo/auth";

// For admin app
import { handlers, auth } from "@repo/auth";

// For superadmin app
import { superadminHandlers, superadminAuthFn } from "@repo/auth";
```

## Roles

- `admin` - Panel del comercio
- `superadmin` - Panel SaaS interno