import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  process.env.RESEND_API_KEY = "test-key-for-ci";
  process.env.RESEND_FROM_EMAIL = "test@example.com";
});

const mockResendSend = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockResendSend } };
  }),
}));

vi.mock("@repo/logger", () => ({
createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

import { sendOrderConfirmationEmail, sendWelcomeEmail } from "../email";

describe("sendOrderConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send confirmation email with order details", async () => {
    await sendOrderConfirmationEmail("test@example.com", "order-123", 15000, "Juan");

    expect(mockResendSend).toHaveBeenCalledOnce();
    const callArg = mockResendSend.mock.calls[0][0];
    expect(callArg.to).toBe("test@example.com");
    expect(callArg.from).toBe("test@example.com");
    expect(callArg.subject).toContain("order-123");
    expect(callArg.html).toContain("$150.00");
  });

  it("should not throw when email sending fails", async () => {
    mockResendSend.mockRejectedValueOnce(new Error("send failed"));

    await expect(
      sendOrderConfirmationEmail("test@example.com", "order-123", 1000, "Maria"),
    ).resolves.toBeUndefined();
  });
});

describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send welcome email with store name", async () => {
    await sendWelcomeEmail("user@example.com", "Pedro", "Mi Tienda", "https://mitienda.com");

    expect(mockResendSend).toHaveBeenCalledOnce();
    const callArg = mockResendSend.mock.calls[0][0];
    expect(callArg.to).toBe("user@example.com");
    expect(callArg.from).toBe("test@example.com");
    expect(callArg.subject).toBe("¡Bienvenido a Mi Tienda!");
    expect(callArg.html).toContain("https://mitienda.com");
  });

  it("should send welcome email without storefront URL", async () => {
    await sendWelcomeEmail("user@example.com", "Ana", "Tienda X");

    expect(mockResendSend).toHaveBeenCalledOnce();
    const callArg = mockResendSend.mock.calls[0][0];
    expect(callArg.subject).toBe("¡Bienvenido a Tienda X!");
    expect(callArg.html).not.toContain("href=");
  });

  it("should not throw when sending fails", async () => {
    mockResendSend.mockRejectedValueOnce(new Error("network error"));

    await expect(
      sendWelcomeEmail("user@example.com", "Luis", "Tienda"),
    ).resolves.toBeUndefined();
  });
});

describe("sendOrderConfirmationEmail without RESEND_API_KEY", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalApiKey) {
      process.env.RESEND_API_KEY = originalApiKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  it("should not send nor throw when no Resend key is configured", async () => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    vi.resetModules();

    const { sendOrderConfirmationEmail: sendWithoutKey } = await import("../email");

    await expect(
      sendWithoutKey("test@example.com", "order-123", 1000, "Maria"),
    ).resolves.toBeUndefined();
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});