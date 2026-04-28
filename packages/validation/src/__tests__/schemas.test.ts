import { describe, it, expect } from "vitest";
import { customDomainSchema } from "../schemas";

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
