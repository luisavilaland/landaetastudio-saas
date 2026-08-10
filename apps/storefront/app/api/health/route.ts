import { createHealthCheckHandler } from "@repo/commerce/health";

export const dynamic = "force-dynamic";

export const GET = createHealthCheckHandler({ appName: "storefront", hasRedis: true });