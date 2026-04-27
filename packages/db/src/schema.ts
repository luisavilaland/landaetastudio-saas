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
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "restrict" }),
  categoryId: uuid("categoryId").references(() => dbCategories.id, { onDelete: "set null" }),
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

export const dbProductImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("productId").notNull().references(() => dbProducts.id, { onDelete: "cascade" }),
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  alt: text("alt"),
  position: integer("position").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdIdx: index("product_images_tenant_id_idx").on(table.tenantId),
    productIdIdx: index("product_images_product_id_idx").on(table.productId),
  };
});

export const dbProductVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "restrict" }),
  productId: uuid("productId").notNull().references(() => dbProducts.id, { onDelete: "cascade" }),
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
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "restrict" }),
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
  tenantId: uuid("tenantId").references(() => dbTenants.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdIdx: index("admin_users_tenant_id_idx").on(table.tenantId),
  };
});

export const dbOrders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "restrict" }),
  customerId: uuid("customerId").references(() => dbCustomers.id, { onDelete: "set null" }),
  customerEmail: text("customerEmail"),
  status: text("status").default("pending"),
  total: integer("total").notNull(),
  currency: text("currency").default("UYU"),
  shippingDetails: jsonb("shippingDetails").default({}),
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
  orderId: uuid("orderId").notNull().references(() => dbOrders.id, { onDelete: "cascade" }),
  productVariantId: uuid("productVariantId").notNull().references(() => dbProductVariants.id, { onDelete: "restrict" }),
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
export const dbCategories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenantId").notNull().references(() => dbTenants.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => {
  return {
    tenantSlugUnique: uniqueIndex("categories_tenant_slug_idx").on(table.tenantId, table.slug),
    tenantIdIdx: index("categories_tenant_id_idx").on(table.tenantId),
  };
});

export const categoriesRelations = relations(dbCategories, ({ one, many }) => ({
  tenant: one(dbTenants, {
    fields: [dbCategories.tenantId],
    references: [dbTenants.id],
  }),
  products: many(dbProducts),
}));

export const productsCategoriesRelations = relations(dbProducts, ({ one, many }) => ({
  category: one(dbCategories, {
    fields: [dbProducts.categoryId],
    references: [dbCategories.id],
  }),
  images: many(dbProductImages),
}));

export const productImagesRelations = relations(dbProductImages, ({ one }) => ({
  product: one(dbProducts, {
    fields: [dbProductImages.productId],
    references: [dbProducts.id],
  }),
  tenant: one(dbTenants, {
    fields: [dbProductImages.tenantId],
    references: [dbTenants.id],
  }),
}));

export type Category = typeof dbCategories.$inferSelect;
export type NewCategory = typeof dbCategories.$inferInsert;
export type AdminUser = typeof dbAdminUsers.$inferSelect;
export type NewAdminUser = typeof dbAdminUsers.$inferInsert;
export type ProductImage = typeof dbProductImages.$inferSelect;
export type NewProductImage = typeof dbProductImages.$inferInsert;