// js/state/apply.js
// 状態変換を伴う操作ヘルパー

import { replaceChosen, replaceNextState } from "./store.js";

export function convertProposalRecipesToChosen(recipes) {
  if (!Array.isArray(recipes)) return [];
  const order = [];
  const counts = new Map();
  recipes.forEach((entry) => {
    const recipeId = entry?.recipeId || entry?.recipe?.id;
    if (!recipeId) return;
    if (!counts.has(recipeId)) order.push(recipeId);
    counts.set(recipeId, (counts.get(recipeId) || 0) + 1);
  });
  return order.map((id) => ({
    recipe: id,
    qty: counts.get(id),
  }));
}

export function applyProposalComboToState(combo) {
  if (!combo || !Array.isArray(combo.recipes) || !combo.recipes.length) {
    return false;
  }
  const nextChosen = convertProposalRecipesToChosen(combo.recipes);
  if (!nextChosen.length) return false;
  replaceChosen(nextChosen);
  return true;
}

export function buildNextStateFromStockPlan(result, categoryToNextKey) {
  if (!result || !result.success) return null;
  const plans = result.categoryPlans || [];
  if (!plans.length) return null;

  const baseMeals = Number(result.baseMeals || 0);
  if (!baseMeals) return null;

  const nextState = {
    CURRY: [],
    SALAD: [],
    SWEETS: [],
    extra: [],
  };

  const topCategoryKey = result.topCategoryKey || null;
  const extraMeals = Number(result.extraMeals || 0);

  plans.forEach((plan) => {
    const key = categoryToNextKey?.[plan.categoryKey];
    if (!key || !plan.recipeId) return;
    const quantity = baseMeals + (plan.categoryKey === topCategoryKey ? extraMeals : 0);
    if (!Number.isFinite(quantity) || quantity === 0) return;
    nextState[key].push({ recipe: plan.recipeId, qty: quantity });
  });

  const extras = [];
  result.bonusTotals?.forEach((qty, ingId) => {
    const numeric = Number(qty) || 0;
    if (numeric !== 0) {
      extras.push({ ingId, qty: numeric });
    }
  });
  nextState.extra = extras;
  return nextState;
}

export function applyStockPlanResult(result, categoryToNextKey) {
  const nextState = buildNextStateFromStockPlan(result, categoryToNextKey);
  if (!nextState) return false;
  replaceNextState(nextState);
  return true;
}
