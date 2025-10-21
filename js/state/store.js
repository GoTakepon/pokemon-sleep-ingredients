// js/state/store.js
// アプリ全体で共有する状態と永続化ヘルパー

function safeParse(key, fallbackFactory) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackFactory();
    const parsed = JSON.parse(raw);
    return (typeof parsed === "object" && parsed !== null) ? parsed : fallbackFactory();
  } catch (err) {
    console.warn(`[storage] parse failed for ${key}`, err);
    return fallbackFactory();
  }
}

function createEmptyNext() {
  return {
    CURRY: [],
    SALAD: [],
    SWEETS: [],
    extra: [],
  };
}

export const state = {
  have: safeParse("have", () => ({})),
  chosen: safeParse("chosen", () => []),
  next: safeParse("next", () => createEmptyNext()),
  data: null,
  index: { recipeById: new Map(), ingredientById: new Map() },
  tableFilter: { this: true, next: true },
};

export function resetNextIfMissing() {
  if (!state.next || typeof state.next !== "object") {
    state.next = createEmptyNext();
    return;
  }
  const defaults = createEmptyNext();
  for (const key of Object.keys(defaults)) {
    if (!Array.isArray(state.next[key])) state.next[key] = [];
  }
}

export function saveState() {
  localStorage.setItem("have", JSON.stringify(state.have));
  localStorage.setItem("chosen", JSON.stringify(state.chosen));
  localStorage.setItem("next", JSON.stringify(state.next));
}

function buildIndexes() {
  const recGroups = state?.data?.recipes || {};
  const allRecipes = Object.values(recGroups).flat() || [];
  state.index.recipeById = new Map(allRecipes.map((r) => [r.id, r]));

  const ingredients = state?.data?.ingredients || [];
  state.index.ingredientById = new Map(ingredients.map((i) => [i.id, i]));
}

export function setData({ ingredients, recipes }) {
  state.data = { ingredients, recipes };
  buildIndexes();
}

export function refreshIndexes() {
  buildIndexes();
}

export function findRecipeById(id) {
  const indexed = state.index?.recipeById?.get(id);
  if (indexed) return indexed;
  const groups = state?.data?.recipes || {};
  for (const list of Object.values(groups)) {
    const hit = (list || []).find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

export function findChosen(recipeId) {
  return state.chosen.find((c) => c.recipe === recipeId) || null;
}

export function incChosen(recipeId) {
  const hit = findChosen(recipeId);
  if (hit) {
    hit.qty += 1;
  } else {
    state.chosen.push({ recipe: recipeId, qty: 1 });
  }
  saveState();
}

export function decChosen(recipeId) {
  const hit = findChosen(recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  saveState();
}

export function setChosenQty(recipeId, qty) {
  const hit = findChosen(recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  saveState();
}

export function removeChosen(recipeId) {
  state.chosen = state.chosen.filter((c) => c.recipe !== recipeId);
  saveState();
}

export function findNextArray(catKey) {
  resetNextIfMissing();
  return state.next[catKey] || (state.next[catKey] = []);
}

export function incNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const hit = arr.find((x) => x.recipe === recipeId);
  if (hit) hit.qty += 1;
  else arr.push({ recipe: recipeId, qty: 1 });
  saveState();
}

export function decNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const hit = arr.find((x) => x.recipe === recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  saveState();
}

export function setNextRecipeQty(catKey, recipeId, qty) {
  const arr = findNextArray(catKey);
  const hit = arr.find((x) => x.recipe === recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  saveState();
}

export function removeNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  state.next[catKey] = arr.filter((x) => x.recipe !== recipeId);
  saveState();
}

export function findExtra(ingId) {
  resetNextIfMissing();
  return (state.next.extra || []).find((e) => e.ingId === ingId) || null;
}

export function incNextExtra(ingId) {
  resetNextIfMissing();
  const hit = findExtra(ingId);
  if (hit) hit.qty += 1;
  else state.next.extra.push({ ingId, qty: 1 });
  saveState();
}

export function decNextExtra(ingId) {
  resetNextIfMissing();
  const hit = findExtra(ingId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  saveState();
}

export function setNextExtraQty(ingId, qty) {
  resetNextIfMissing();
  const hit = findExtra(ingId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  if (hit.qty === 0) {
    state.next.extra = state.next.extra.filter((e) => e.ingId !== ingId);
  }
  saveState();
}

export function removeNextExtra(ingId) {
  resetNextIfMissing();
  state.next.extra = (state.next.extra || []).filter((e) => e.ingId !== ingId);
  saveState();
}
