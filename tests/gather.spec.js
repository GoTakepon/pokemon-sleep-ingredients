import { describe, it, expect } from "vitest";
import {
  GATHER_COLUMNS,
  normalizeGatherArray,
  normalizeGatherValue,
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
    expect(arr[3]).toBe(4);
    expect(arr[4]).toBe(0);
  });
});
