import { describe, it, expect } from "vitest";
import {
  dbTenants,
  dbProducts,
  dbProductImages,
  dbProductVariants,
  dbCustomers,
  dbAdminUsers,
  dbOrders,
  dbOrderItems,
  dbCategories,
  dbShippingMethods,
} from "../schema";

describe("DB Schema", () => {
  it("should export dbTenants table with expected columns", () => {
    expect(dbTenants).toBeDefined();
    expect(dbTenants.id).toBeDefined();
    expect(dbTenants.slug).toBeDefined();
    expect(dbTenants.customDomain).toBeDefined();
    expect(dbTenants.name).toBeDefined();
    expect(dbTenants.plan).toBeDefined();
    expect(dbTenants.status).toBeDefined();
    expect(dbTenants.settings).toBeDefined();
    expect(dbTenants.createdAt).toBeDefined();
    expect(dbTenants.updatedAt).toBeDefined();
  });

  it("should export dbProducts table with expected columns", () => {
    expect(dbProducts).toBeDefined();
    expect(dbProducts.id).toBeDefined();
    expect(dbProducts.tenantId).toBeDefined();
    expect(dbProducts.categoryId).toBeDefined();
    expect(dbProducts.name).toBeDefined();
    expect(dbProducts.slug).toBeDefined();
    expect(dbProducts.description).toBeDefined();
    expect(dbProducts.imageUrl).toBeDefined();
    expect(dbProducts.status).toBeDefined();
    expect(dbProducts.metadata).toBeDefined();
    expect(dbProducts.createdAt).toBeDefined();
    expect(dbProducts.updatedAt).toBeDefined();
  });

  it("should export dbProductImages table with expected columns", () => {
    expect(dbProductImages).toBeDefined();
    expect(dbProductImages.id).toBeDefined();
    expect(dbProductImages.productId).toBeDefined();
    expect(dbProductImages.tenantId).toBeDefined();
    expect(dbProductImages.url).toBeDefined();
    expect(dbProductImages.alt).toBeDefined();
    expect(dbProductImages.position).toBeDefined();
    expect(dbProductImages.createdAt).toBeDefined();
  });

  it("should export dbProductVariants table with expected columns", () => {
    expect(dbProductVariants).toBeDefined();
    expect(dbProductVariants.id).toBeDefined();
    expect(dbProductVariants.tenantId).toBeDefined();
    expect(dbProductVariants.productId).toBeDefined();
    expect(dbProductVariants.sku).toBeDefined();
    expect(dbProductVariants.price).toBeDefined();
    expect(dbProductVariants.stock).toBeDefined();
    expect(dbProductVariants.options).toBeDefined();
    expect(dbProductVariants.createdAt).toBeDefined();
    expect(dbProductVariants.updatedAt).toBeDefined();
  });

  it("should export dbCustomers table with expected columns", () => {
    expect(dbCustomers).toBeDefined();
    expect(dbCustomers.id).toBeDefined();
    expect(dbCustomers.tenantId).toBeDefined();
    expect(dbCustomers.email).toBeDefined();
    expect(dbCustomers.password).toBeDefined();
    expect(dbCustomers.name).toBeDefined();
    expect(dbCustomers.phone).toBeDefined();
    expect(dbCustomers.createdAt).toBeDefined();
    expect(dbCustomers.updatedAt).toBeDefined();
  });

  it("should export dbAdminUsers table with expected columns", () => {
    expect(dbAdminUsers).toBeDefined();
    expect(dbAdminUsers.id).toBeDefined();
    expect(dbAdminUsers.email).toBeDefined();
    expect(dbAdminUsers.password).toBeDefined();
    expect(dbAdminUsers.role).toBeDefined();
    expect(dbAdminUsers.tenantId).toBeDefined();
    expect(dbAdminUsers.createdAt).toBeDefined();
    expect(dbAdminUsers.updatedAt).toBeDefined();
  });

  it("should export dbOrders table with expected columns", () => {
    expect(dbOrders).toBeDefined();
    expect(dbOrders.id).toBeDefined();
    expect(dbOrders.tenantId).toBeDefined();
    expect(dbOrders.customerId).toBeDefined();
    expect(dbOrders.customerEmail).toBeDefined();
    expect(dbOrders.status).toBeDefined();
    expect(dbOrders.total).toBeDefined();
    expect(dbOrders.currency).toBeDefined();
    expect(dbOrders.shippingDetails).toBeDefined();
    expect(dbOrders.metadata).toBeDefined();
    expect(dbOrders.createdAt).toBeDefined();
    expect(dbOrders.updatedAt).toBeDefined();
  });

  it("should export dbOrderItems table with expected columns", () => {
    expect(dbOrderItems).toBeDefined();
    expect(dbOrderItems.id).toBeDefined();
    expect(dbOrderItems.tenantId).toBeDefined();
    expect(dbOrderItems.orderId).toBeDefined();
    expect(dbOrderItems.productVariantId).toBeDefined();
    expect(dbOrderItems.quantity).toBeDefined();
    expect(dbOrderItems.unitPrice).toBeDefined();
    expect(dbOrderItems.createdAt).toBeDefined();
  });

  it("should export dbCategories table with expected columns", () => {
    expect(dbCategories).toBeDefined();
    expect(dbCategories.id).toBeDefined();
    expect(dbCategories.tenantId).toBeDefined();
    expect(dbCategories.name).toBeDefined();
    expect(dbCategories.slug).toBeDefined();
    expect(dbCategories.createdAt).toBeDefined();
    expect(dbCategories.updatedAt).toBeDefined();
  });

  it("should export dbShippingMethods table with expected columns", () => {
    expect(dbShippingMethods).toBeDefined();
    expect(dbShippingMethods.id).toBeDefined();
    expect(dbShippingMethods.tenantId).toBeDefined();
    expect(dbShippingMethods.name).toBeDefined();
    expect(dbShippingMethods.description).toBeDefined();
    expect(dbShippingMethods.price).toBeDefined();
    expect(dbShippingMethods.freeShippingThreshold).toBeDefined();
    expect(dbShippingMethods.estimatedDaysMin).toBeDefined();
    expect(dbShippingMethods.estimatedDaysMax).toBeDefined();
    expect(dbShippingMethods.isActive).toBeDefined();
    expect(dbShippingMethods.sortOrder).toBeDefined();
    expect(dbShippingMethods.createdAt).toBeDefined();
    expect(dbShippingMethods.updatedAt).toBeDefined();
  });
});
