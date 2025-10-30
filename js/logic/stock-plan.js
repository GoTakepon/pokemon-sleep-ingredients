// js/logic/stock-plan.js
// 次週備蓄計画に関する計算ロジック

import { computeNextWeekTotals } from "./next-week.js";

function totalsToQtyMap(rawMap) {
  const out = new Map();
  if (!rawMap) return out;
  if (rawMap instanceof Map) {
    rawMap.forEach((value, key) => {
      const qty = value && typeof value === "object" && "qty" in value ? value.qty : value;
      const numeric = Number(qty) || 0;
      if (numeric > 0) out.set(key, numeric);
    });
    return out;
  }
  Object.entries(rawMap).forEach(([key, value]) => {
    const qty = value && typeof value === "object" && "qty" in value ? value.qty : value;
    const numeric = Number(qty) || 0;
    if (numeric > 0) out.set(key, numeric);
  });
  return out;
}

function sumQtyMap(map) {
  let sum = 0;
  map?.forEach((qty) => {
    sum += Number(qty) || 0;
  });
  return sum;
}

function scaleQtyMap(map, factor) {
  const scalar = Number(factor) || 0;
  const result = new Map();
  if (scalar <= 0) return result;
  map?.forEach((qty, ingId) => {
    const value = (Number(qty) || 0) * scalar;
    if (value > 0) {
      result.set(ingId, value);
    }
  });
  return result;
}

function addQtyMap(target, source) {
  const out = target instanceof Map ? new Map(target) : new Map();
  source?.forEach((qty, ingId) => {
    const value = Number(qty) || 0;
    if (value <= 0) return;
    out.set(ingId, (Number(out.get(ingId)) || 0) + value);
  });
  return out;
}

function findSharedIngredientIds(recipes, minCategories = 2) {
  const threshold = Math.max(1, Math.min(minCategories, recipes.length || 0));
  if (!threshold) return [];
  const freq = new Map();
  recipes.forEach((recipe) => {
    if (!recipe?.needs) return;
    Object.keys(recipe.needs).forEach((ingId) => {
      freq.set(ingId, (freq.get(ingId) || 0) + 1);
    });
  });
  const shared = [];
  freq.forEach((count, ingId) => {
    if (count >= threshold) shared.push(ingId);
  });
  return shared;
}

export function stockPlanSubtractsBoosted(islandType, eventType) {
  if (eventType === "pokemon") return true;
  if (eventType === "cooking") return islandType === "normal";
  return islandType === "normal";
}

function resolveStockPlanEntry(nextWeekPlan, islandType, eventType) {
  if (!nextWeekPlan || typeof nextWeekPlan !== "object") return null;
  const entries = Object.entries(nextWeekPlan);
  for (const [key, entry] of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.island === islandType && entry.event === eventType) {
      return { key, ...entry };
    }
  }
  return null;
}

function pickHighestEnergyStat(stats) {
  if (!Array.isArray(stats) || !stats.length) return null;
  let best = null;
  for (const stat of stats) {
    if (!stat?.recipe) continue;
    if (!best || (stat.finalEnergy || 0) > (best.finalEnergy || 0)) {
      best = stat;
    }
  }
  return best;
}

function uniqueCategories(list = [], fallback = []) {
  const base = Array.isArray(list) && list.length ? list : fallback;
  return Array.from(
    new Set(
      base
        .filter((value) => typeof value === "string")
        .map((value) => value.trim().toLowerCase()),
    ),
  );
}

export function computeNextWeekStockPlan({
  bagCapacity,
  islandType,
  eventType,
  categories = [],
  defaultCategories = [],
  recipesByCategory = {},
  ingredients = [],
  recipeStatsByCategory = {},
  nextWeekPlan = {},
  distributeLeftover = true,
  boostedIngredientIds = [],
  categoryToNextKey = {},
  baseMeals = 3,
}) {
  const capacity = Math.max(1, Number(bagCapacity) || 0);
  const normalizedCategories = uniqueCategories(categories, defaultCategories);

  const categoryStats = normalizedCategories
    .map((categoryKey) => {
      const stats = recipeStatsByCategory[categoryKey] || [];
      const stat = pickHighestEnergyStat(stats);
      return stat?.recipe ? { categoryKey, stat } : null;
    })
    .filter(Boolean);

  if (!categoryStats.length) {
    return { error: "対象カテゴリの最高エナジー料理が見つかりませんでした。" };
  }

  categoryStats.sort(
    (a, b) => (b.stat.finalEnergy || 0) - (a.stat.finalEnergy || 0),
  );

  const basePlan = { CURRY: [], SALAD: [], SWEETS: [], extra: [] };
  categoryStats.forEach(({ categoryKey, stat }) => {
    const key = categoryToNextKey?.[categoryKey];
    if (!key || !stat?.recipe?.id) return;
    basePlan[key] = [{ recipe: stat.recipe.id, qty: 1 }];
  });

  const perSetTotalsRaw = computeNextWeekTotals(
    basePlan,
    recipesByCategory,
    ingredients,
  );
  const perSetTotals = totalsToQtyMap(perSetTotalsRaw);
  const perSetSum = sumQtyMap(perSetTotals);

  const requestedMeals = Math.max(0, Math.round(Number(baseMeals) || 0));
  const maxMealsByCapacity = perSetSum > 0 ? Math.floor(capacity / perSetSum) : requestedMeals;
  const effectiveMeals = Math.min(requestedMeals, Math.max(0, maxMealsByCapacity));

  const baseTotals = scaleQtyMap(perSetTotals, effectiveMeals);
  const baseCount = sumQtyMap(baseTotals);

  const subtractBoosted = stockPlanSubtractsBoosted(islandType, eventType);
  const boostedSet = new Set(boostedIngredientIds || []);

  const extraTotals = new Map();
  const extraMeals = 0;
  let finalTotals = new Map(baseTotals);
  let totalCount = sumQtyMap(finalTotals);
  let leftover = Math.max(0, capacity - totalCount);
  const bonusTotals = new Map();
  let sharedSetMultiplier = 0;
  let sharedSetIngredients = [];

  if (distributeLeftover !== false && leftover > 0) {
    const recipesForIntersection = categoryStats
      .map((choice) => choice.stat?.recipe)
      .filter(Boolean);
    const sharedIds = findSharedIngredientIds(
      recipesForIntersection,
      Math.min(2, recipesForIntersection.length || 0),
    );
    if (sharedIds.length) {
        const sharedTotals = new Map();
        sharedIds.forEach((ingId) => {
          const qty = Number(perSetTotals.get(ingId)) || 0;
          if (qty > 0) sharedTotals.set(ingId, qty);
        });
      if (sharedTotals.size) {
        sharedSetIngredients = Array.from(sharedTotals.keys());
      }
      const sharedSum = sumQtyMap(sharedTotals);
      if (sharedSum > 0) {
        const multiplier = Math.floor(leftover / sharedSum);
        if (multiplier > 0) {
          sharedTotals.forEach((qty, ingId) => {
            const inc = qty * multiplier;
            finalTotals.set(ingId, (finalTotals.get(ingId) || 0) + inc);
            bonusTotals.set(ingId, (bonusTotals.get(ingId) || 0) + inc);
          });
          leftover -= sharedSum * multiplier;
          totalCount = sumQtyMap(finalTotals);
          sharedSetMultiplier = multiplier;
        }
      }
    }
  }

  const baseLabel = `${effectiveMeals}食分`;
  const warning =
    perSetSum > 0 && effectiveMeals < requestedMeals
      ? `バッグ容量に収まる最大セット数は ${effectiveMeals} 食分です（希望: ${requestedMeals} 食分）。`
      : null;

  const planEntry = resolveStockPlanEntry(nextWeekPlan, islandType, eventType);
  const topChoice = categoryStats[0] || null;
  const topCategoryKey = topChoice?.categoryKey || null;

  return {
    success: true,
    capacity,
    baseCount,
    totalCount,
    extraMeals,
    subtractBoosted,
    boostedSet,
    baselineStats: categoryStats.map((choice) => choice.stat),
    topStat: topChoice?.stat || null,
    baseTotals,
    extraTotals,
    bonusTotals,
    finalTotals,
    warning,
    planEntry,
    sharedSetMultiplier,
    sharedSetIngredients,
    categoryPlans: categoryStats.map(({ categoryKey, stat }) => ({
      categoryKey,
      recipeId: stat?.recipe?.id || null,
      recipeTitle: stat?.recipe?.title || "",
      stat,
    })),
    baseMeals: effectiveMeals,
    requestedBaseMeals: requestedMeals,
    maxMealsByCapacity: Number.isFinite(maxMealsByCapacity) ? Math.max(0, maxMealsByCapacity) : requestedMeals,
    topCategoryKey,
    remainingCapacity: leftover,
    params: {
      islandType,
      eventType,
      cookingCategories: normalizedCategories,
    },
  };
}

export function buildStockRecipeStats(
  categories = [],
  { getStats } = {},
) {
  if (typeof getStats !== "function") return {};
  const unique = uniqueCategories(categories, []);
  const result = {};
  unique.forEach((categoryKey) => {
    if (!categoryKey) return;
    result[categoryKey] = getStats(categoryKey) || [];
  });
  return result;
}
