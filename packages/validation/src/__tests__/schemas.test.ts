import { describe, it, expect } from "vitest";
import {
  customDomainSchema,
  createProductSchema,
  updateProductSchema,
  variantSchema,
  variantsArraySchema,
  createCategorySchema,
  updateCategorySchema,
  updateOrderStatusSchema,
  addCartItemSchema,
  updateCartItemSchema,
  deleteCartItemSchema,
  checkoutPreferenceSchema,
  shippingDetailsSchema,
  dashboardQuerySchema,
  createTenantSchema,
  registerSchema,
  webhookSchema,
  productImageSchema,
  createShippingMethodSchema,
} from "../schemas";

describe("customDomainSchema", () => {
  it("should accept valid domains", () => {
    expect(customDomainSchema.parse("mitienda.com.uy")).toEqual("mitienda.com.uy");
    expect(customDomainSchema.parse("www.tienda.com")).toEqual("www.tienda.com");
    expect(customDomainSchema.parse("shop.example.org")).toEqual("shop.example.org");
  });

  it("should reject domains with protocol", () => {
    expect(() => customDomainSchema.parse("http://mitienda.com")).toThrow();
    expect(() => customDomainSchema.parse("https://mitienda.com")).toThrow();
  });

  it("should reject domains with path", () => {
    expect(() => customDomainSchema.parse("mitienda.com.uy/")).toThrow();
    expect(() => customDomainSchema.parse("mitienda.com/path")).toThrow();
  });

  it("should reject invalid domain formats", () => {
    expect(() => customDomainSchema.parse("mitienda")).toThrow();
    expect(() => customDomainSchema.parse("mitienda..com")).toThrow();
  });

  it("should accept empty string as undefined", () => {
    expect(customDomainSchema.parse("")).toBeUndefined();
    expect(customDomainSchema.parse("   ")).toBeUndefined();
  });

  it("should accept undefined", () => {
    expect(customDomainSchema.parse(undefined)).toBeUndefined();
  });

  it("should trim whitespace", () => {
    expect(customDomainSchema.parse("  mitienda.com  ")).toEqual("mitienda.com");
  });
});

describe("createProductSchema", () => {
  it("should accept valid product data", () => {
    const result = createProductSchema.parse({
      name: "Producto",
      slug: "producto",
      status: "active",
      price: 1000,
      stock: 5,
    });
    expect(result.name).toBe("Producto");
    expect(result.price).toBe(1000);
  });

  it("should reject price less than 1", () => {
    expect(() =>
      createProductSchema.parse({ name: "P", slug: "p", status: "active", price: 0, stock: 0 })
    ).toThrow();
  });

  it("should accept optional description and categoryId", () => {
    const result = createProductSchema.parse({
      name: "Producto",
      slug: "producto",
      status: "active",
      price: 2000,
      stock: 10,
      description: "Descripción",
      categoryId: "cat-1",
    });
    expect(result.description).toBe("Descripción");
    expect(result.categoryId).toBe("cat-1");
  });
});

describe("updateProductSchema", () => {
  it("should accept partial updates", () => {
    const result = updateProductSchema.parse({ name: "Nuevo nombre" });
    expect(result.name).toBe("Nuevo nombre");
  });

  it("should accept empty object", () => {
    const result = updateProductSchema.parse({});
    expect(result).toEqual({});
  });
});

describe("variantSchema", () => {
  it("should accept valid variant data", () => {
    const result = variantSchema.parse({ price: 1500, stock: 3 });
    expect(result.price).toBe(1500);
    expect(result.stock).toBe(3);
  });

  it("should default stock to 0", () => {
    const result = variantSchema.parse({ price: 1000 });
    expect(result.stock).toBe(0);
  });
});

describe("variantsArraySchema", () => {
  it("should accept array of variants", () => {
    const result = variantsArraySchema.parse({
      variants: [{ price: 1000 }, { price: 2000, stock: 5 }],
    });
    expect(result.variants).toHaveLength(2);
  });

  it("should reject empty variants array", () => {
    expect(() => variantsArraySchema.parse({ variants: [] })).toThrow();
  });
});

describe("createCategorySchema", () => {
  it("should accept valid category", () => {
    const result = createCategorySchema.parse({ name: "Electrónicos", slug: "electronicos" });
    expect(result.slug).toBe("electronicos");
  });
});

describe("updateCategorySchema", () => {
  it("should accept partial update", () => {
    const result = updateCategorySchema.parse({ name: "Nuevo nombre" });
    expect(result.name).toBe("Nuevo nombre");
  });
});

describe("updateOrderStatusSchema", () => {
  it("should accept valid status", () => {
    const result = updateOrderStatusSchema.parse({ status: "completed" });
    expect(result.status).toBe("completed");
  });
});

describe("addCartItemSchema", () => {
  it("should accept valid cart item", () => {
    const result = addCartItemSchema.parse({ variantId: "v1", quantity: 2 });
    expect(result.quantity).toBe(2);
  });

  it("should reject quantity less than 1", () => {
    expect(() => addCartItemSchema.parse({ variantId: "v1", quantity: 0 })).toThrow();
  });
});

describe("updateCartItemSchema", () => {
  it("should accept zero quantity", () => {
    const result = updateCartItemSchema.parse({ variantId: "v1", quantity: 0 });
    expect(result.quantity).toBe(0);
  });
});

describe("deleteCartItemSchema", () => {
  it("should reject without variantId or clearAll", () => {
    expect(() => deleteCartItemSchema.parse({})).toThrow();
  });

  it("should accept clearAll true without variantId", () => {
    const result = deleteCartItemSchema.parse({ clearAll: true });
    expect(result.clearAll).toBe(true);
  });

  it("should accept variantId without clearAll", () => {
    const result = deleteCartItemSchema.parse({ variantId: "v1" });
    expect(result.variantId).toBe("v1");
  });
});

describe("checkoutPreferenceSchema", () => {
  it("should accept valid data", () => {
    const result = checkoutPreferenceSchema.parse({
      orderId: "order-1",
      customerEmail: "test@example.com",
    });
    expect(result.customerEmail).toBe("test@example.com");
  });

  it("should reject invalid email", () => {
    expect(() =>
      checkoutPreferenceSchema.parse({ orderId: "o1", customerEmail: "invalido" })
    ).toThrow();
  });
});

describe("shippingDetailsSchema", () => {
  it("should accept valid shipping details", () => {
    const result = shippingDetailsSchema.parse({
      name: "Juan",
      email: "juan@test.com",
      phone: "099123456",
      address: "Calle 123",
    });
    expect(result.name).toBe("Juan");
  });
});

describe("dashboardQuerySchema", () => {
  it("should accept empty filters", () => {
    const result = dashboardQuerySchema.parse({});
    expect(result.startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });
});

describe("createTenantSchema", () => {
  it("should accept valid tenant", () => {
    const result = createTenantSchema.parse({
      slug: "mi-tienda",
      name: "Mi Tienda",
      plan: "pro",
      status: "active",
    });
    expect(result.slug).toBe("mi-tienda");
  });
});

describe("registerSchema", () => {
  it("should accept valid registration", () => {
    const result = registerSchema.parse({
      name: "Juan",
      email: "juan@test.com",
      password: "123456",
    });
    expect(result.email).toBe("juan@test.com");
  });

  it("should reject short password", () => {
    expect(() =>
      registerSchema.parse({ name: "J", email: "j@t.com", password: "12345" })
    ).toThrow();
  });
});

describe("webhookSchema", () => {
  it("should accept valid webhook payload", () => {
    const result = webhookSchema.parse({ type: "payment", data: { id: "pay-123" } });
    expect(result.data.id).toBe("pay-123");
  });
});

describe("productImageSchema", () => {
  it("should default position to 0", () => {
    const result = productImageSchema.parse({});
    expect(result.position).toBe(0);
  });
});

describe("createShippingMethodSchema", () => {
  it("should accept valid shipping method", () => {
    const result = createShippingMethodSchema.parse({
      name: "Envío estándar",
      price: 5000,
    });
    expect(result.isActive).toBe(true);
    expect(result.sortOrder).toBe(0);
  });
});
