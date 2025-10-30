// js/logic/proposals.js
// 料理提案に関する純粋な計算ロジック

function defaultNormalizeCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.round(num));
}

/**
 * 指定されたレシピ候補の中から、条件に合う組み合わせを探索する。
 * @param {Array<Object>} stats - 各レシピの統計情報（finalEnergy, hoursRequired などを含む）
 * @param {Object} options
 * @param {number} [options.maxMeals=3] - 組み合わせに含める最大料理数
 * @param {number} [options.maxHours=24] - 1枠あたりで許容する最大稼働時間
 * @param {number} [options.maxResults=3] - 返却する候補数
 * @param {boolean} [options.allowRepeats=true] - 同一レシピの重複を許可するか
 * @param {number} [options.pokemonCount=1] - 食材ポケモン枠数
 * @param {Function} [options.normalizePokemonCount] - 枠数を正規化する関数
 * @returns {Array<Object>} - 最良候補の配列
 */
export function computeBestRecipeCombos(
  stats,
  {
    maxMeals = 3,
    maxHours = 24,
    maxResults = 3,
    allowRepeats = true,
    pokemonCount = 1,
    normalizePokemonCount = defaultNormalizeCount,
  } = {},
) {
  const valid = (stats || []).filter(
    (entry) =>
      Number.isFinite(entry?.hoursRequired) &&
      entry.hoursRequired > 0 &&
      Number.isFinite(entry?.finalEnergy) &&
      entry.finalEnergy > 0,
  );

  if (!valid.length) return [];

  const normCount = Math.max(1, normalizePokemonCount(pokemonCount));
  const combosMap = new Map();
  const n = valid.length;

  const addIfValid = (indexes) => {
    if (!indexes.length || indexes.length > maxMeals) return;
    const key = indexes.slice().sort((a, b) => a - b).join("-");
    if (!allowRepeats && combosMap.has(key)) return;

    const recipes = indexes.map((idx) => valid[idx]);
    let totalHours = 0;
    let totalIngredientOnlyHours = 0;
    let totalIngredientShareHours = 0;
    let totalAssistShareHours = 0;
    let totalEnergy = 0;
    let ingredientHoursValid = true;
    let shareHoursValid = true;
    for (const stat of recipes) {
      totalHours += stat.hoursRequired;
      totalEnergy += stat.finalEnergy;
      if (!Number.isFinite(stat.ingredientHoursRequired)) {
        ingredientHoursValid = false;
      } else {
        totalIngredientOnlyHours += stat.ingredientHoursRequired;
      }

      if (Number.isFinite(stat.ingredientShareHours)) {
        totalIngredientShareHours += stat.ingredientShareHours;
      } else {
        shareHoursValid = false;
      }

      if (Number.isFinite(stat.assistShareHours)) {
        totalAssistShareHours += stat.assistShareHours;
      } else {
        shareHoursValid = false;
      }
    }

    if (!Number.isFinite(totalHours) || totalHours <= 0) return;
    if (!ingredientHoursValid || !Number.isFinite(totalIngredientOnlyHours)) return;
    if (!shareHoursValid) return;
    if (totalHours / normCount > maxHours) return;

    const efficiency = totalEnergy / totalHours;
    const stored = combosMap.get(key);
    if (!stored || stored.totalEnergy < totalEnergy) {
      combosMap.set(key, {
        recipes,
        totalHours,
        totalIngredientOnlyHours,
        totalIngredientShareHours,
        totalAssistShareHours,
        totalEnergy,
        efficiency,
      });
    }
  };

  for (let i = 0; i < n; i += 1) {
    addIfValid([i]);
    for (let j = 0; j < n; j += 1) {
      addIfValid([i, j]);
      for (let k = 0; k < n; k += 1) {
        addIfValid([i, j, k]);
      }
    }
  }

  const sorted = Array.from(combosMap.values())
    .sort(
      (a, b) =>
        b.totalEnergy - a.totalEnergy ||
        b.efficiency - a.efficiency ||
        a.recipes.length - b.recipes.length,
    )
    .slice(0, maxResults);

  return sorted.map((combo) => {
    const entries = combo.recipes.map((stat) => ({
      recipe: stat.recipe,
      recipeId: stat.id ?? stat.recipe?.id,
      title: stat.title,
      hoursRequired: stat.hoursRequired,
      ingredientHoursRequired: stat.ingredientHoursRequired,
      ingredientShareHours: stat.ingredientShareHours,
      assistShareHours: stat.assistShareHours,
      finalEnergy: stat.finalEnergy,
    }));
    const slotCount =
      Number.isFinite(combo.totalIngredientShareHours) && combo.totalIngredientShareHours > 0
        ? combo.totalIngredientShareHours / 24
        : null;
    const energyPerSlot =
      slotCount && slotCount > 0 ? combo.totalEnergy / slotCount : null;
    return {
      ...combo,
      totalIngredientHours: combo.totalIngredientOnlyHours,
      totalIngredientShareHours: combo.totalIngredientShareHours,
      totalAssistShareHours: combo.totalAssistShareHours,
      recipes: entries,
      slotCount,
      energyPerSlot,
    };
  });
}
