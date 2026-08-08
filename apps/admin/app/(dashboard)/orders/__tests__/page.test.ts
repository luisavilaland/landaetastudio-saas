import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { withTenantContext } from "@repo/db";
import { session } from "@repo/test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, withTenantContext: vi.fn(), db: undefined };
});

import { auth } from "@/lib/auth";
import OrdersPage from "../page";
import { OrdersTable } from "../orders-table";

function findNode(node: React.ReactNode, predicate: (el: React.ReactElement) => boolean): React.ReactElement | null {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  const children = (node.props as { children?: React.ReactNode }).children;
  return React.Children.toArray(children).reduce<React.ReactElement | null>(
    (found, child) => found ?? findNode(child, predicate),
    null
  );
}

const orderRow = {
  id: "order-1",
  customerEmail: "cliente@test.com",
  total: 50000,
  status: "confirmed",
  createdAt: new Date("2026-01-15"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(withTenantContext).mockImplementation(async (_tenantId, cb) =>
    cb({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([orderRow]),
    } as any)
  );
});

describe("OrdersPage (server component)", () => {
  it("debe consultar órdenes dentro de withTenantContext con el tenantId de la sesión", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));

    const element = (await OrdersPage({ searchParams: Promise.resolve({}) })) as React.ReactElement;

    expect(withTenantContext).toHaveBeenCalledWith("tenant-1", expect.any(Function));
    const table = findNode(element, (el) => el.type === OrdersTable);
    expect(table).not.toBeNull();
    expect((table!.props as any).initialOrders).toHaveLength(1);
    expect((table!.props as any).initialOrders[0].customerEmail).toBe("cliente@test.com");
  });

  it("debe listar empty cuando no hay órdenes", async () => {
    vi.mocked(auth).mockResolvedValue(session("tenant-1"));
    vi.mocked(withTenantContext).mockImplementation(async (_tenantId: string, cb: (tx: any) => any) =>
      cb({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      } as any)
    );

    const el = (await OrdersPage({ searchParams: Promise.resolve({}) })) as React.ReactElement;

    expect(withTenantContext).toHaveBeenCalled();
    const table = findNode(el, (node) => node.type === OrdersTable);
    expect((table!.props as any).initialOrders).toHaveLength(0);
  });
});