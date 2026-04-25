import { pgTable, uuid, text, integer, jsonb, timestamp, uniqueIndex, index, foreignKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const dbTenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  customDomain: text("customDomain").unique(),
  name: text("name").notNull(),
  plan: text("plan").default("starter"),
  status: text("status").default("active"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const dbProducts = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  status: text("status").default("draft"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantSlugUnique: uniqueIndex("products_tenant_slug_idx").on(table.tenantId, table.slug),
    tenantIdIdx: index("products_tenant_id_idx").on(table.tenantId),
  };
});

export const dbProductVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull(),
  productId: uuid("productId").notNull(),
  sku: text("sku").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").default(0),
  options: jsonb("options").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantSkuUnique: uniqueIndex("product_variants_tenant_sku_idx").on(table.tenantId, table.sku),
    tenantIdIdx: index("product_variants_tenant_id_idx").on(table.tenantId),
  };
});

export const dbCustomers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  name: text("name"),
  phone: text("phone"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantEmailUnique: uniqueIndex("customers_tenant_email_idx").on(table.tenantId, table.email),
    tenantIdIdx: index("customers_tenant_id_idx").on(table.tenantId),
  };
});

export const dbAdminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  tenantId: uuid("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdIdx: index("admin_users_tenant_id_idx").on(table.tenantId),
  };
});

export const dbOrders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull(),
  customerId: uuid("customerId"),
  customerEmail: text("customeremail"),
  status: text("status").default("pending"),
  total: integer("total").notNull(),
  currency: text("currency").default("UYU"),
  shippingDetails: jsonb("shippingdetails").default({}),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdIdx: index("orders_tenant_id_idx").on(table.tenantId),
    customerEmailIdx: index("orders_customer_email_idx").on(table.customerEmail),
  };
});

export const dbOrderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("orderId").notNull(),
  productVariantId: uuid("productVariantId").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unitPrice").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    productVariantIdIdx: index("order_items_product_variant_id_idx").on(table.productVariantId),
  };
});

export type Tenant = typeof dbTenants.$inferSelect;
export type NewTenant = typeof dbTenants.$inferInsert;
export type Product = typeof dbProducts.$inferSelect;
export type NewProduct = typeof dbProducts.$inferInsert;
export type ProductVariant = typeof dbProductVariants.$inferSelect;
export type NewProductVariant = typeof dbProductVariants.$inferInsert;
export type Customer = typeof dbCustomers.$inferSelect;
export type NewCustomer = typeof dbCustomers.$inferInsert;
export type Order = typeof dbOrders.$inferSelect;
export type NewOrder = typeof dbOrders.$inferInsert;
export type OrderItem = typeof dbOrderItems.$inferSelect;
export type NewOrderItem = typeof dbOrderItems.$inferInsert;
export type AdminUser = typeof dbAdminUsers.$inferSelect;
export type NewAdminUser = typeof dbAdminUsers.$inferInsert;