import { describe, it, expect } from "vitest";
import { computeNextWeekStockPlan } from "../js/logic/stock-plan.js";

const CATEGORY_TO_NEXT_KEY = {
  curry: "CURRY",
  salad: "SALAD",
  dessert: "SWEETS",
};

const INGREDIENTS = [
  { id: "apple", name: "りんご" },
  { id: "milk", name: "ミルク" },
];

const RECIPES_BY_CATEGORY = {
  curry: [
    {
      id: "curry-a",
      title: "いあいぎりすき焼きカレー",
      needs: { apple: 2 },
    },
  ],
  salad: [
    {
      id: "salad-a",
      title: "りんごさんヨーグルトサラダ",
      needs: { apple: 1 },
    },
  ],
  dessert: [
    {
      id: "dessert-a",
      title: "ミルクプリン",
      needs: { milk: 1 },
    },
  ],
};

const RECIPE_STATS_BY_CATEGORY = {
  curry: [{ recipe: RECIPES_BY_CATEGORY.curry[0], finalEnergy: 1200 }],
  salad: [{ recipe: RECIPES_BY_CATEGORY.salad[0], finalEnergy: 900 }],
  dessert: [{ recipe: RECIPES_BY_CATEGORY.dessert[0], finalEnergy: 600 }],
};

describe("computeNextWeekStockPlan", () => {
  it("clamps基準食数 when bag capacity is insufficient", () => {
    const result = computeNextWeekStockPlan({
      bagCapacity: 6,
      islandType: "EX",
      eventType: "none",
      categories: ["curry", "salad"],
      defaultCategories: ["curry", "salad", "dessert"],
      recipesByCategory: RECIPES_BY_CATEGORY,
      ingredients: INGREDIENTS,
      recipeStatsByCategory: RECIPE_STATS_BY_CATEGORY,
      nextWeekPlan: {},
      distributeLeftover: true,
      boostedIngredientIds: [],
      categoryToNextKey: CATEGORY_TO_NEXT_KEY,
      baseMeals: 5,
    });

    expect(result.baseMeals).toBe(3);
    expect(result.requestedBaseMeals).toBe(5);
    expect(result.warning).toContain("最大セット数は 3 食分");
    expect(Object.fromEntries(result.baseTotals.entries())).toEqual({ apple: 6 });
    expect(result.totalCount).toBeLessThanOrEqual(result.capacity);
  });

  it("keeps余剰充当 off when distributeLeftover is false", () => {
    const result = computeNextWeekStockPlan({
      bagCapacity: 10,
      islandType: "EX",
      eventType: "none",
      categories: ["curry", "salad"],
      defaultCategories: ["curry", "salad", "dessert"],
      recipesByCategory: RECIPES_BY_CATEGORY,
      ingredients: INGREDIENTS,
      recipeStatsByCategory: RECIPE_STATS_BY_CATEGORY,
      nextWeekPlan: {},
      distributeLeftover: false,
      boostedIngredientIds: [],
      categoryToNextKey: CATEGORY_TO_NEXT_KEY,
      baseMeals: 3,
    });

    expect(result.baseMeals).toBe(3);
    expect(result.bonusTotals.size).toBe(0);
    expect(result.sharedSetMultiplier).toBe(0);
    expect(result.remainingCapacity).toBe(10 - result.totalCount);
  });

  it("deduplicatesカテゴリ入力 and ignores unknown keys", () => {
    const result = computeNextWeekStockPlan({
      bagCapacity: 20,
      islandType: "EX",
      eventType: "none",
      categories: ["salad", "curry", "salad", "unknown"],
      defaultCategories: ["curry", "salad", "dessert"],
      recipesByCategory: RECIPES_BY_CATEGORY,
      ingredients: INGREDIENTS,
      recipeStatsByCategory: RECIPE_STATS_BY_CATEGORY,
      nextWeekPlan: {},
      distributeLeftover: true,
      boostedIngredientIds: [],
      categoryToNextKey: CATEGORY_TO_NEXT_KEY,
      baseMeals: 2,
    });

    expect(result.categoryPlans.map((plan) => plan.categoryKey)).toEqual(["curry", "salad"]);
    expect(new Set(result.params.cookingCategories).size).toBe(result.params.cookingCategories.length);
    expect(result.params.cookingCategories).toContain("curry");
    expect(result.params.cookingCategories).toContain("salad");
    expect(result.baseMeals).toBe(2);
    expect(Object.fromEntries(result.baseTotals.entries())).toEqual({ apple: 4 });
  });
});
