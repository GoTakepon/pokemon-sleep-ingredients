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
    const hours = computeIngredientHours({
      needQty: 4,
      rates: [2, 1, 0],
      usePokemonCount: true,
      pokemonCount: 2,
      normalizePokemonCount: (count) => count,
    });
    expect(hours).toBeCloseTo((4 / 3) * 24);
  });

  it("returns infinity when no gather rate is available", () => {
    const hours = computeIngredientHours({
      needQty: 5,
      rates: [0, 0, 0],
      usePokemonCount: false,
    });
    expect(hours).toBe(Number.POSITIVE_INFINITY);
  });
});
