// js/logic/gather.js
// 食材集め能力（24時間あたりの個数）入力支援ヘルパー

export const GATHER_COLUMNS = 3;

export function normalizeGatherValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

export function normalizeGatherArray(values, columns = GATHER_COLUMNS) {
  const arr = Array(columns).fill(0);
  if (!Array.isArray(values)) return arr;
  values.forEach((val, idx) => {
    if (idx < columns) {
      arr[idx] = normalizeGatherValue(val);
    }
  });
  return arr;
}

function defaultNormalizePokemonCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.round(num));
}

export function computeIngredientHours({
  needQty,
  rates = [],
  usePokemonCount = true,
  pokemonCount = 1,
  normalizePokemonCount = defaultNormalizePokemonCount,
} = {}) {
  const required = Number(needQty) || 0;
  if (required <= 0) return 0;

  const normalizedRates = (rates || []).map((val) => Math.max(0, Number(val) || 0));
  let dailyRate = 0;

  if (usePokemonCount) {
    const count = Math.max(1, normalizePokemonCount(pokemonCount));
    const sorted = normalizedRates.slice().sort((a, b) => b - a);
    dailyRate = sorted.slice(0, count).reduce((sum, val) => sum + val, 0);
  } else {
    dailyRate = normalizedRates.reduce((sum, val) => sum + val, 0);
  }

  if (dailyRate <= 0) return Number.POSITIVE_INFINITY;
  return (required / dailyRate) * 24;
}
