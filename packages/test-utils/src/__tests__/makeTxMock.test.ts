import { describe, it, expect } from "vitest";
import { makeTxMock } from "../..";

describe("makeTxMock", () => {
  describe("sin config", () => {
    it("auto-encadena select().from().where().limit()", async () => {
      const tx = makeTxMock();
      tx.where.mockResolvedValue([{ id: 1 }]);
      const result = await tx.select().from("t").where("x = 1");
      expect(result).toEqual([{ id: 1 }]);
    });

    it("insert retorna tx y returning default [{}]", async () => {
      const tx = makeTxMock();
      const result = await tx.insert().values({ name: "x" }).returning();
      expect(result).toEqual([{}]);
    });
  });

  describe("config.select con cola agotada", () => {
    it("lanza error descriptivo cuando se exceden los selects configurados sin repeatLastSelect", async () => {
      const tx = makeTxMock({ select: [{ data: [{ id: 1 }], terminal: "limit" }] });

      await tx.select().from("a").where("x = 1").limit(1);

      expect(() => tx.select()).toThrow(/queue exhausted for select\(\)/);
      expect(() => tx.select()).toThrow(/repeatLastSelect/);
    });

    it("lanza error para select y from cuando se excede la cola", async () => {
      const tx = makeTxMock({ select: [{ data: [] }] });

      await tx.select().from("a").where("x = 1");

      expect(() => tx.select()).toThrow("select");
      expect(() => tx.from()).toThrow("from");
    });

    it("where/limit/orderBy no lanzan (compartidos con delete/update)", async () => {
      const tx = makeTxMock({ select: [{ data: [{ id: 1 }], terminal: "limit" }] });

      await tx.select().from("a").where("x = 1").limit(1);

      expect(() => tx.select()).toThrow();
      expect(() => tx.delete().where("y = 2")).not.toThrow();
    });
  });

  describe("config.select con repeatLastSelect", () => {
    it("repite la última entrada cuando se excede la cola", async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const tx = makeTxMock({
        select: [{ data, terminal: "limit" }],
        repeatLastSelect: true,
      });

      await tx.select().from("a").where("x = 1").limit(1);

      const result2 = await tx.select().from("b").where("x = 2").limit(1);
      expect(result2).toEqual(data);
    });

    it("repeatLastSelect con terminal where", async () => {
      const data = [{ name: "test" }];
      const tx = makeTxMock({
        select: [{ data }],
        repeatLastSelect: true,
      });

      await tx.select().from("a").where("x = 1");
      const result2 = await tx.select().from("b").where("x = 2");
      expect(result2).toEqual(data);
    });

    it("repeatLastSelect con terminal orderBy", async () => {
      const data = [{ id: 3 }];
      const tx = makeTxMock({
        select: [{ data, terminal: "orderBy" }],
        repeatLastSelect: true,
      });

      await tx.select().from("a").where("x = 1").orderBy("id");
      const result2 = await tx.select().from("b").where("x = 2").orderBy("id");
      expect(result2).toEqual(data);
    });
  });

  describe("config.select con múltiples entradas", () => {
    it("sirve cada entrada secuencialmente", async () => {
      const tx = makeTxMock({
        select: [
          { data: [{ type: "product" }], terminal: "limit" },
          { data: [{ type: "variant" }] },
        ],
      });

      const r1 = await tx.select().from("p").where("id = 1").limit(1);
      expect(r1).toEqual([{ type: "product" }]);

      const r2 = await tx.select().from("v").where("pid = 1");
      expect(r2).toEqual([{ type: "variant" }]);
    });
  });
});