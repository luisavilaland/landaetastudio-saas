import { describe, it, expect, vi } from "vitest";

vi.mock("minio", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      putObject: vi.fn().mockResolvedValue("etag-123"),
      removeObject: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("storage package", () => {
  it("should have minio module mocked", async () => {
    const minio = await import("minio");
    expect(minio.Client).toBeDefined();
  });
});