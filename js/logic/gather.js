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
  const normalized = (rates || []).map((val) => Math.max(0, Number(val) || 0));

  const ingredientPerSlot = normalized[0] || 0;
  const assistDailyRate = (normalized[1] || 0) + (normalized[2] || 0);

  let ingredientDailyRate = 0;
  if (usePokemonCount) {
    const slots = Math.max(1, normalizePokemonCount(pokemonCount));
    ingredientDailyRate = ingredientPerSlot * slots;
  } else {
    ingredientDailyRate = ingredientPerSlot;
  }

  const totalDailyRate = ingredientDailyRate + assistDailyRate;

  const totalHours =
    required <= 0
      ? 0
      : totalDailyRate > 0
        ? (required / totalDailyRate) * 24
        : Number.POSITIVE_INFINITY;

  const ingredientHours =
    required <= 0
      ? 0
      : ingredientDailyRate > 0
        ? (required / ingredientDailyRate) * 24
        : Number.POSITIVE_INFINITY;

  let ingredientShareHours = 0;
  let assistShareHours = 0;
  if (Number.isFinite(totalHours) && totalHours > 0 && totalDailyRate > 0) {
    if (ingredientDailyRate > 0) {
      ingredientShareHours = totalHours * (ingredientDailyRate / totalDailyRate);
    }
    if (assistDailyRate > 0) {
      assistShareHours = totalHours * (assistDailyRate / totalDailyRate);
    }
  }

  return {
    totalHours,
    ingredientHours,
    totalDailyRate,
    ingredientDailyRate,
    assistDailyRate,
    ingredientShareHours,
    assistShareHours,
  };
}
