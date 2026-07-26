import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPutObject = vi.hoisted(() => vi.fn().mockResolvedValue("etag-123"));
const mockRemoveObject = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("minio", () => ({
  Client: vi.fn().mockImplementation(function () {
    return { putObject: mockPutObject, removeObject: mockRemoveObject };
  }),
}));

import { storageClient, getPublicUrl, uploadImage, deleteImage } from "../index";

describe("storage package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a storage client", () => {
    expect(storageClient).toBeDefined();
    expect(typeof storageClient.putObject).toBe("function");
    expect(typeof storageClient.removeObject).toBe("function");
  });

  describe("getPublicUrl", () => {
    it("should return a full URL for a given file name", () => {
      const url = getPublicUrl("test-image.jpg");
      expect(url).toContain("test-image.jpg");
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe("uploadImage", () => {
    it("should call putObject with buffer and return public URL", async () => {
      const buffer = Buffer.from("fake-image-data");
      const url = await uploadImage(buffer, "product-1.jpg", "image/jpeg");

      expect(mockPutObject).toHaveBeenCalledOnce();
      expect(mockPutObject).toHaveBeenCalledWith(
        expect.any(String),
        "product-1.jpg",
        buffer,
        buffer.length,
        expect.objectContaining({ "Content-Type": "image/jpeg" }),
      );
      expect(url).toContain("product-1.jpg");
    });
  });

  describe("deleteImage", () => {
    it("should call removeObject when fileName is provided", async () => {
      await deleteImage("old-image.jpg");

      expect(mockRemoveObject).toHaveBeenCalledOnce();
      expect(mockRemoveObject).toHaveBeenCalledWith(expect.any(String), "old-image.jpg");
    });

    it("should not call removeObject when fileName is empty", async () => {
      await deleteImage("");

      expect(mockRemoveObject).not.toHaveBeenCalled();
    });
  });
});
