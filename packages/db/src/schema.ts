import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  status: text("status").default("draft"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
});

export const dbOrders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull(),
  customerId: uuid("customerId"),
  status: text("status").default("pending"),
  total: integer("total").notNull(),
  currency: text("currency").default("UYU"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const dbOrderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("orderId").notNull(),
  productVariantId: uuid("productVariantId").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unitPrice").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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