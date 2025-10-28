import { describe, it, expect } from "vitest";
import { buildStockRecipeStats } from "../js/logic/stock-plan.js";

describe("stock-plan helpers", () => {
  it("returns stats per unique category using injected resolver", () => {
    const calls = [];
    const result = buildStockRecipeStats(["curry", "salad", "curry"], {
      getStats: (category) => {
        calls.push(category);
        return [`stats:${category}`];
      },
    });

    expect(calls).toEqual(["curry", "salad"]);
    expect(result.curry).toEqual(["stats:curry"]);
    expect(result.salad).toEqual(["stats:salad"]);
    expect(result).not.toHaveProperty("dessert");
  });

  it("returns empty object when resolver is missing", () => {
    const result = buildStockRecipeStats(["curry"]);
    expect(result).toEqual({});
  });
});
