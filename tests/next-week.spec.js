import { describe, it, expect } from "vitest";
import { computeNextWeekTotals } from "../js/logic/next-week.js";

const recipesByCat = {
  curry: [
    { id: "c1", needs: { ing1: 2, ing2: 1 } },
    { id: "c2", needs: { ing1: 1 } },
  ],
  salad: [
    { id: "s1", needs: { ing3: 3 } },
  ],
  dessert: [],
};

const ingredients = [
  { id: "ing1", name: "Ing 1", emoji: "🍎" },
  { id: "ing2", name: "Ing 2", emoji: "🥕" },
  { id: "ing3", name: "Ing 3", emoji: "🥦" },
];

describe("computeNextWeekTotals", () => {
  it("aggregates categories and takes max across them", () => {
    const nextState = {
      CURRY: [
        { recipe: "c1", qty: 1 },
        { recipe: "c2", qty: 2 },
      ],
      SALAD: [
        { recipe: "s1", qty: 1 },
      ],
      SWEETS: [],
      extra: [],
    };

    const result = computeNextWeekTotals(nextState, recipesByCat, ingredients);

    const ing1 = result.get("ing1");
    const ing2 = result.get("ing2");
    const ing3 = result.get("ing3");

    expect(ing1?.qty).toBe(4);
    expect(ing2?.qty).toBe(1);
    expect(ing3?.qty).toBe(3);
  });

  it("adds extra ingredients", () => {
    const nextState = {
      CURRY: [],
      SALAD: [],
      SWEETS: [],
      extra: [
        { ingId: "ing1", qty: 2 },
        { ingId: "newIng", qty: 1 },
      ],
    };

    const result = computeNextWeekTotals(nextState, recipesByCat, ingredients);
    expect(result.get("ing1")?.qty).toBe(2);
    expect(result.get("newIng")?.qty).toBe(1);
  });

  it("ignores zero quantities", () => {
    const nextState = {
      CURRY: [
        { recipe: "c1", qty: 0 },
      ],
      SALAD: [],
      SWEETS: [],
      extra: [
        { ingId: "ing2", qty: 0 },
      ],
    };

    const result = computeNextWeekTotals(nextState, recipesByCat, ingredients);
    expect(result.size).toBe(0);
  });

  it("reuses cached result when cache key and references are unchanged", () => {
    const nextState = {
      CURRY: [
        { recipe: "c1", qty: 1 },
      ],
      SALAD: [],
      SWEETS: [],
      extra: [],
    };

    const first = computeNextWeekTotals(nextState, recipesByCat, ingredients, 1);
    const second = computeNextWeekTotals(nextState, recipesByCat, ingredients, 1);

    expect(second).not.toBe(first);
    expect(second.get("ing1")?.qty).toBe(2);
    expect(second.get("ing2")?.qty).toBe(1);

    nextState.CURRY[0].qty = 3;
    const third = computeNextWeekTotals(nextState, recipesByCat, ingredients, 2);
    expect(third.get("ing1")?.qty).toBe(6);
    expect(third.get("ing2")?.qty).toBe(3);
  });
});
