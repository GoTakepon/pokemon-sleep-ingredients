import { describe, it, expect } from "vitest";
import { computeBestRecipeCombos } from "../js/logic/proposals.js";

describe("computeBestRecipeCombos", () => {
  it("calculates slot count and energy per slot from ingredient-only hours", () => {
    const combos = computeBestRecipeCombos(
      [
        {
          id: "r1",
          title: "テストカレー",
          recipe: {},
          finalEnergy: 1200,
          hoursRequired: 24,
          ingredientHoursRequired: 48,
          ingredientShareHours: 16,
          assistShareHours: 8,
        },
      ],
      {
        pokemonCount: 2,
        maxMeals: 1,
        maxResults: 1,
        maxHours: 24,
      },
    );
    expect(combos).toHaveLength(1);
    expect(combos[0].slotCount).toBeCloseTo(16 / 24);
    expect(combos[0].energyPerSlot).toBeCloseTo(1200 / (16 / 24));
    expect(combos[0].totalIngredientShareHours).toBeCloseTo(16);
    expect(combos[0].totalAssistShareHours).toBeCloseTo(8);
    expect(combos[0].recipes[0].ingredientShareHours).toBe(16);
  });

  it("skips combos when ingredient-only hours are not finite", () => {
    const combos = computeBestRecipeCombos(
      [
        {
          id: "assist-only",
          title: "サポートのみ",
          recipe: {},
          finalEnergy: 800,
          hoursRequired: 18,
          ingredientHoursRequired: Number.POSITIVE_INFINITY,
          ingredientShareHours: Number.POSITIVE_INFINITY,
          assistShareHours: Number.POSITIVE_INFINITY,
        },
      ],
      {
        pokemonCount: 1,
        maxMeals: 1,
        maxResults: 1,
      },
    );
    expect(combos).toHaveLength(0);
  });

  it("allows combos when assists reduce total hours below the limit", () => {
    const combos = computeBestRecipeCombos(
      [
        {
          id: "assisted",
          title: "手伝い込み",
          recipe: {},
          finalEnergy: 500,
          hoursRequired: 12, // 実際の稼働時間
          ingredientHoursRequired: 60, // 食材枠のみで換算すると 60h
          ingredientShareHours: 8,
          assistShareHours: 4,
        },
      ],
      {
        pokemonCount: 1,
        maxMeals: 1,
        maxResults: 1,
        maxHours: 24,
      },
    );
    expect(combos).toHaveLength(1);
    expect(combos[0].totalHours).toBe(12);
    expect(combos[0].slotCount).toBeCloseTo(8 / 24);
    expect(combos[0].totalIngredientShareHours).toBeCloseTo(8);
    expect(combos[0].totalAssistShareHours).toBeCloseTo(4);
    expect(combos[0].recipes[0].assistShareHours).toBe(4);
  });
});
