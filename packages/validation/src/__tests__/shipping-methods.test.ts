import { describe, it, expect } from "vitest";
import {
  createShippingMethodSchema,
  updateShippingMethodSchema,
} from "../schemas";

describe("createShippingMethodSchema", () => {
  it("should pass with valid required fields", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío estándar",
      price: 150,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Envío estándar");
      expect(result.data.price).toBe(150);
    }
  });

  it("should pass with all optional fields", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío express",
      description: "Entrega en 24 horas",
      price: 300,
      freeShippingThreshold: 2000,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
      isActive: true,
      sortOrder: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Envío express");
      expect(result.data.description).toBe("Entrega en 24 horas");
      expect(result.data.price).toBe(300);
      expect(result.data.freeShippingThreshold).toBe(2000);
      expect(result.data.estimatedDaysMin).toBe(1);
      expect(result.data.estimatedDaysMax).toBe(2);
      expect(result.data.isActive).toBe(true);
      expect(result.data.sortOrder).toBe(1);
    }
  });

  it("should fail when name is missing", () => {
    const result = createShippingMethodSchema.safeParse({
      price: 150,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("name");
    }
  });

  it("should fail when name is empty", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "",
      price: 150,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when price is negative", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: -10,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when price is not an integer", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150.5,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when freeShippingThreshold is negative", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
      freeShippingThreshold: -100,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when freeShippingThreshold is not an integer", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
      freeShippingThreshold: 100.5,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when estimatedDaysMin is negative", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
      estimatedDaysMin: -1,
    });

    expect(result.success).toBe(false);
  });

  it("should fail when estimatedDaysMax is negative", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
      estimatedDaysMax: -1,
    });

    expect(result.success).toBe(false);
  });

  it("should default isActive to true when not provided", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("should default sortOrder to 0 when not provided", () => {
    const result = createShippingMethodSchema.safeParse({
      name: "Envío",
      price: 150,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(0);
    }
  });
});

describe("updateShippingMethodSchema", () => {
  it("should pass with empty object (all fields optional)", () => {
    const result = updateShippingMethodSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("should pass with just name", () => {
    const result = updateShippingMethodSchema.safeParse({
      name: "Nuevo nombre",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Nuevo nombre");
    }
  });

  it("should pass with just price", () => {
    const result = updateShippingMethodSchema.safeParse({
      price: 500,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(500);
    }
  });

  it("should fail with invalid price", () => {
    const result = updateShippingMethodSchema.safeParse({
      price: -50,
    });

    expect(result.success).toBe(false);
  });
});