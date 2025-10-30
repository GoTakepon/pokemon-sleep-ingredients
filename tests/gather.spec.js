import { describe, it, expect } from "vitest";
import {
  GATHER_COLUMNS,
  normalizeGatherArray,
  normalizeGatherValue,
  computeIngredientHours,
} from "../js/logic/gather.js";

describe("gather logic", () => {
  it("normalizes individual values", () => {
    expect(normalizeGatherValue(5)).toBe(5);
    expect(normalizeGatherValue(-3)).toBe(0);
    expect(normalizeGatherValue("3.5")).toBe(3.5);
  });

  it("builds a fixed-length array", () => {
    const arr = normalizeGatherArray([1, "2", -3, 4]);
    expect(arr).toHaveLength(GATHER_COLUMNS);
    expect(arr[0]).toBe(1);
    expect(arr[1]).toBe(2);
    expect(arr[2]).toBe(0);
  });

  it("computes ingredient hours with pokemon slot selection", () => {
    const result = computeIngredientHours({
      needQty: 4,
      rates: [2, 1, 0],
      usePokemonCount: true,
      pokemonCount: 2,
      normalizePokemonCount: (count) => count,
    });
    expect(result.totalDailyRate).toBe(5);
    expect(result.ingredientDailyRate).toBe(4);
    expect(result.assistDailyRate).toBe(1);
    expect(result.totalHours).toBeCloseTo((4 / 5) * 24);
    expect(result.ingredientHours).toBeCloseTo((4 / 4) * 24);
    expect(result.ingredientShareHours).toBeCloseTo(result.totalHours * (4 / 5));
    expect(result.assistShareHours).toBeCloseTo(result.totalHours * (1 / 5));
  });

  it("returns infinity when no gather rate is available", () => {
    const result = computeIngredientHours({
      needQty: 5,
      rates: [0, 0, 0],
      usePokemonCount: false,
    });
    expect(result.totalHours).toBe(Number.POSITIVE_INFINITY);
    expect(result.ingredientHours).toBe(Number.POSITIVE_INFINITY);
    expect(result.ingredientShareHours).toBe(0);
    expect(result.assistShareHours).toBe(0);
  });

  it("prioritises assist rates when computing total hours", () => {
    const result = computeIngredientHours({
      needQty: 6,
      rates: [1, 5, 0],
      usePokemonCount: true,
      pokemonCount: 1,
      normalizePokemonCount: (count) => count,
    });
    expect(result.totalDailyRate).toBe(6);
    expect(result.totalHours).toBeCloseTo((6 / 6) * 24);
    expect(result.ingredientHours).toBeCloseTo((6 / 1) * 24);
    expect(result.ingredientShareHours).toBeCloseTo(result.totalHours * (1 / 6), 4);
    expect(result.assistShareHours).toBeCloseTo(result.totalHours * (5 / 6), 4);
  });
});
