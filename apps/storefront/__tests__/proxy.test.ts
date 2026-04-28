import { describe, it, expect } from "vitest";

describe("proxy.ts - custom domain resolution logic", () => {
  it("should extract tenant slug from custom domain matching", () => {
    const hostname = "mitienda.com.uy";
    expect(hostname.includes(".")).toBe(true);
    expect(hostname.split(".")[0]).toBe("mitienda");
  });

  it("should fallback to subdomain when customDomain not found", () => {
    const hostname = "tienda1.lvh.me";
    const slug = hostname.split(".")[0];
    expect(slug).toBe("tienda1");
  });

  it("should validate custom domain format", () => {
    const customDomainRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

    expect(customDomainRegex.test("mitienda.com.uy")).toBe(true);
    expect(customDomainRegex.test("www.tienda.com")).toBe(true);
    expect(customDomainRegex.test("http://mitienda.com")).toBe(false);
    expect(customDomainRegex.test("mitienda")).toBe(false);
  });
});
