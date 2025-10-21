import { describe, it, expect } from "vitest";
import {
  collectThisWeekIngredientIds,
  buildChosenRecipeSet,
} from "../js/logic/recommendation.js";

describe("collectThisWeekIngredientIds", () => {
  const findRecipeById = (id) => {
    const recipes = {
      r1: { needs: { ing1: 2, ing2: 1 } },
      r2: { needs: { ing3: 1 } },
    };
    return recipes[id] || null;
  };

  it("ignores recipes with qty <= 0", () => {
    const chosen = [
      { recipe: "r1", qty: 0 },
      { recipe: "r2", qty: 1 },
    ];
    const ids = collectThisWeekIngredientIds(chosen, findRecipeById);
    expect(ids.has("ing1")).toBe(false);
    expect(ids.has("ing2")).toBe(false);
    expect(ids.has("ing3")).toBe(true);
  });

  it("aggregates ingredients from recipes with qty > 0", () => {
    const chosen = [
      { recipe: "r1", qty: 2 },
      { recipe: "r2", qty: 1 },
    ];
    const ids = collectThisWeekIngredientIds(chosen, findRecipeById);
    expect(ids.has("ing1")).toBe(true);
    expect(ids.has("ing2")).toBe(true);
    expect(ids.has("ing3")).toBe(true);
  });
});

describe("buildChosenRecipeSet", () => {
  it("includes only recipes with qty > 0", () => {
    const chosen = [
      { recipe: "r1", qty: 0 },
      { recipe: "r2", qty: 3 },
      { recipe: "r3", qty: "" },
      { recipe: "r4", qty: "2" },
    ];
    const set = buildChosenRecipeSet(chosen);
    expect(set.has("r1")).toBe(false);
    expect(set.has("r2")).toBe(true);
    expect(set.has("r3")).toBe(false);
    expect(set.has("r4")).toBe(true);
  });
});
