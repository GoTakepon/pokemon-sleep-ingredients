import { describe, it, expect } from "vitest";
import { computeThisWeekTotals, buildTableRows } from "../js/logic/weekly-totals.js";

const ingredients = [
  { id: "ing1", name: "Ing 1", emoji: "🍎" },
  { id: "ing2", name: "Ing 2", emoji: "🥕" },
  { id: "ing3", name: "Ing 3", emoji: "🥦" },
];

const findRecipeById = (id) => {
  const recipes = {
    r1: { needs: { ing1: 2, ing2: 1 } },
    r2: { needs: { ing3: 3 } },
  };
  return recipes[id] || null;
};

describe("computeThisWeekTotals", () => {
  it("ignores recipes with zero quantity", () => {
    const chosen = [
      { recipe: "r1", qty: 0 },
      { recipe: "r2", qty: 1 },
    ];
    const { map, used } = computeThisWeekTotals(chosen, findRecipeById);
    expect(map.get("ing3")).toBe(3);
    expect(map.has("ing1")).toBe(false);
    expect(used.has("ing3")).toBe(true);
    expect(used.has("ing1")).toBe(false);
  });

  it("aggregates needs for recipes with positive quantities", () => {
    const chosen = [
      { recipe: "r1", qty: 2 },
      { recipe: "r2", qty: 1 },
    ];
    const { map } = computeThisWeekTotals(chosen, findRecipeById);
    expect(map.get("ing1")).toBe(4);
    expect(map.get("ing2")).toBe(2);
    expect(map.get("ing3")).toBe(3);
  });
});

describe("buildTableRows", () => {
  const inventory = new Map([
    ["ing1", 5],
    ["ing2", 0],
    ["ing3", 4],
  ]);

  it("combines this/next totals respecting table filters", () => {
    const thisTotals = {
      map: new Map([["ing1", 3]]),
      used: new Set(["ing1"]),
    };
    const nextTotals = {
      map: new Map([["ing3", 2]]),
      used: new Set(["ing3"]),
    };
    const result = buildTableRows({
      thisTotals,
      nextTotals,
      tableFilter: { this: true, next: true },
      inventoryMap: inventory,
      ingredients,
    });

    expect(result.usedRows.length).toBeGreaterThan(0);
    expect(result.sums.used.cur).toBe(9); // 5 (ing1) + 4 (ing3)
    expect(result.sums.used.tar).toBe(5); // 3 + 2
  });

  it("respects filters when only one side is active", () => {
    const thisTotals = {
      map: new Map([["ing1", 3]]),
      used: new Set(["ing1"]),
    };
    const nextTotals = {
      map: new Map([["ing3", 2]]),
      used: new Set(["ing3"]),
    };
    const result = buildTableRows({
      thisTotals,
      nextTotals,
      tableFilter: { this: true, next: false },
      inventoryMap: inventory,
      ingredients,
    });

    expect(result.sums.used.cur).toBe(5);
    expect(result.sums.used.tar).toBe(3);
    expect(result.sums.other.cur).toBe(4);
  });
});
