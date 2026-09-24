SET TIME ZONE 'UTC';
--> statement-breakpoint
SET statement_timeout = '10s';
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shipping_methods" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shipping_methods" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone;
