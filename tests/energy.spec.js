import { describe, it, expect } from "vitest";
import {
  computeFinalEnergy,
  normalizeLevel,
  normalizePercent,
  normalizeMultiplier,
} from "../js/logic/energy.js";

describe("energy logic", () => {
  it("normalizes level within 0-65", () => {
    expect(normalizeLevel(-5)).toBe(0);
    expect(normalizeLevel(10)).toBe(10);
    expect(normalizeLevel(120)).toBe(65);
  });

  it("normalizes percent and multiplier", () => {
    expect(normalizePercent("12.5")).toBe(12.5);
    expect(normalizePercent(-3)).toBe(0);
    expect(normalizeMultiplier("1.25")).toBeCloseTo(1.25);
    expect(normalizeMultiplier("0")).toBe(1);
  });

  it("computes final energy matching spreadsheet example", () => {
    // base: 17494, level 62 => bonus 215%, field bonus 20%, event 1.1
    const result = computeFinalEnergy({
      baseEnergy: 17494,
      level: 62,
      fieldBonusPercent: 20,
      eventBonusMultiplier: 1.1,
    });
    expect(result).toBe(72739);
  });
});
