import { describe, it, expect } from "vitest";
import { z } from "zod";

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const storeSettingsSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(hexColorRegex).optional(),
  secondaryColor: z.string().regex(hexColorRegex).optional(),
  accentColor: z.string().regex(hexColorRegex).optional(),
  fontFamily: z.string().optional(),
  storeDescription: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  socialLinks: z
    .object({
      instagram: z.string().url().optional(),
      facebook: z.string().url().optional(),
    })
    .optional(),
});

describe("storeSettingsSchema", () => {
  it("should pass with empty object", () => {
    const result = storeSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should pass with all valid fields", () => {
    const result = storeSettingsSchema.safeParse({
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      accentColor: "#ec4899",
      fontFamily: "Inter",
      storeDescription: "Mi tienda online",
      contactEmail: "contacto@mitienda.com",
      contactPhone: "+59899123456",
      socialLinks: {
        instagram: "https://instagram.com/mitienda",
        facebook: "https://facebook.com/mitienda",
      },
    });

    expect(result.success).toBe(true);
  });

  it("should fail with invalid hex color (not a hex)", () => {
    const result = storeSettingsSchema.safeParse({
      primaryColor: "red",
    });

    expect(result.success).toBe(false);
  });

  it("should fail with invalid hex color (wrong format)", () => {
    const result = storeSettingsSchema.safeParse({
      primaryColor: "#GGGGGG",
    });

    expect(result.success).toBe(false);
  });

  it("should pass with 3-character hex color", () => {
    const result = storeSettingsSchema.safeParse({
      primaryColor: "#f00",
    });

    expect(result.success).toBe(true);
  });

  it("should fail with invalid logoUrl", () => {
    const result = storeSettingsSchema.safeParse({
      logoUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("should fail with invalid email", () => {
    const result = storeSettingsSchema.safeParse({
      contactEmail: "invalid-email",
    });

    expect(result.success).toBe(false);
  });

  it("should pass with partial data", () => {
    const result = storeSettingsSchema.safeParse({
      primaryColor: "#ff0000",
    });

    expect(result.success).toBe(true);
  });

  it("should pass with partial socialLinks", () => {
    const result = storeSettingsSchema.safeParse({
      socialLinks: {
        instagram: "https://instagram.com/test",
      },
    });

    expect(result.success).toBe(true);
  });
});