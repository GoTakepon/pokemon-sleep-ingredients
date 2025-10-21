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

    // curry: use max per ingredient (2 vs 4)
    expect(result.ing1.qty).toBe(4);
    expect(result.ing2.qty).toBe(1); // from c1
    expect(result.ing3.qty).toBe(3); // from salad
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
    expect(result.ing1.qty).toBe(2);
    expect(result.newIng.qty).toBe(1);
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
    expect(Object.keys(result).length).toBe(0);
  });
});

function maxOf(...values) {
  return Math.max(...values);
}
