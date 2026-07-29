import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@repo/db";
import { mockReq, session } from "@repo/test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("@repo/db", { db: undefined });

import { auth } from "@/lib/auth";
import { GET, PUT } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

function setupDb(data: any[]) {
  (db as any).select = vi.fn().mockReturnThis();
  (db as any).from = vi.fn().mockReturnThis();
  (db as any).where = vi.fn().mockReturnThis();
  (db as any).limit = vi.fn().mockResolvedValue(data);
}

describe("GET /api/config/settings", () => {
  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autorizado");
  });

  it("should return 404 when tenant not found", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Tenant no encontrado");
  });

  it("should return settings", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([{ settings: { primaryColor: "#ff0000" } }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings.primaryColor).toBe("#ff0000");
  });

  it("should return empty settings object when tenant has no settings", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([{ settings: null }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({});
  });
});

describe("PUT /api/config/settings", () => {
  it("should return 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await PUT(mockReq("PUT", { primaryColor: "#ff0000" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autorizado");
  });

  it("should return 404 when tenant not found", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([]);

    const response = await PUT(mockReq("PUT", { primaryColor: "#ff0000" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Tenant no encontrado");
  });

  it("should return 400 when validation fails", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([{ id: "tenant-1", settings: {} }]);

    const response = await PUT(mockReq("PUT", { primaryColor: "not-a-color" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validación fallida");
  });

  it("should update settings successfully", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    setupDb([{ id: "tenant-1", settings: {} }]);
    (db as any).update = vi.fn().mockReturnThis();
    (db as any).set = vi.fn().mockReturnThis();
    (db as any).where = vi.fn().mockReturnThis();
    (db as any).returning = vi.fn().mockResolvedValue([{ settings: { primaryColor: "#ff0000" } }]);

    const response = await PUT(mockReq("PUT", { primaryColor: "#ff0000" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings.primaryColor).toBe("#ff0000");
  });
});
