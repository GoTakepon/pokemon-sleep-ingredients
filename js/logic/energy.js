// js/logic/energy.js
// 最終エナジー算出ロジック

import { getRecipeLevelBonus } from "../data/recipe-level-bonus.js";

export function normalizeLevel(value) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(num, 65));
}

export function normalizePercent(value) {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, num);
}

export function normalizeMultiplier(value) {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num) || num <= 0) return 1;
  return Math.max(0, num);
}

export function computeFinalEnergy({
  baseEnergy = 0,
  level = 0,
  fieldBonusPercent = 0,
  eventBonusMultiplier = 1,
}) {
  const base = Math.max(0, Number(baseEnergy) || 0);
  const lvl = normalizeLevel(level);
  const levelBonusRate = getRecipeLevelBonus(lvl);
  const bonusFromLevel = Math.round(base * levelBonusRate);
  const fieldRate = normalizePercent(fieldBonusPercent) / 100;
  const eventMultiplier = normalizeMultiplier(eventBonusMultiplier);
  const globalMultiplier = (1 + fieldRate) * eventMultiplier;
  const total = (base + bonusFromLevel) * globalMultiplier;
  return Math.floor(total);
}
