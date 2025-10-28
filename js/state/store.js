// js/state/store.js
// アプリ全体の状態と永続化ヘルパー

import { normalizePercent, normalizeMultiplier } from "../logic/energy.js";

export const MAX_GATHER_SLOTS = 4;

const storage = ensureStorage();

function safeParse(key, fallbackFactory) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallbackFactory();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallbackFactory();
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

export function normalizePokemonCount(value) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.min(MAX_GATHER_SLOTS, num));
}

const storedTableFilter = safeParse("tableFilter", () => ({ this: true, next: true }));
const storedEnergyConfig = safeParse("energyConfig", () => ({
  fieldBonusPercent: 0,
  eventBonusMultiplier: 1,
  levels: {},
}));
const storedSuggestConfig = safeParse("suggestConfig", () => ({
  eventType: "none",
  eventCustom: "",
  ec: "none",
  island: "wakakusa_ex",
  fieldBonusPercent: storedEnergyConfig?.fieldBonusPercent ?? 0,
  eventBonusMultiplier: storedEnergyConfig?.eventBonusMultiplier ?? 1,
  bonusPreset: "preset_berries",
  otherMemo: "",
}));
const storedGatherRates = safeParse("gatherRates", () => ({}));
const storedStockConfig = safeParse("stockPlanConfig", () => ({}));
const storedStockGatherRates = safeParse("stockGatherRates", () => ({}));

const gatherRatesPayload = { ...storedGatherRates };
const storedPokemonCountRaw = gatherRatesPayload.__pokemonCount;
if ("__pokemonCount" in gatherRatesPayload) delete gatherRatesPayload.__pokemonCount;

const stockGatherRatesPayload = storedStockGatherRates ? { ...storedStockGatherRates } : {};
const storedCookingCategoriesRaw = Array.isArray(storedStockConfig?.cookingCategories)
  ? storedStockConfig.cookingCategories
  : storedStockConfig?.cookingCategory
    ? [storedStockConfig.cookingCategory]
    : [];

export const state = {
  have: safeParse("have", () => ({})),
  chosen: safeParse("chosen", () => []),
  next: safeParse("next", () => createEmptyNext()),
  nextWeekPlan: null,
  nextVersion: 0,
  data: null,
  index: { recipeById: new Map(), ingredientById: new Map() },
  tableFilter: {
    this: storedTableFilter?.this ?? true,
    next: storedTableFilter?.next ?? true,
  },
  energyConfig: {
    fieldBonusPercent: Number(storedEnergyConfig?.fieldBonusPercent) || 0,
    eventBonusMultiplier: Number(storedEnergyConfig?.eventBonusMultiplier) || 1,
    levels: storedEnergyConfig?.levels && typeof storedEnergyConfig.levels === "object"
      ? storedEnergyConfig.levels
      : {},
  },
  suggestConfig: {
    eventType: storedSuggestConfig?.eventType === "custom" ? "custom" : "none",
    eventCustom: storedSuggestConfig?.eventCustom || "",
    ec: storedSuggestConfig?.ec === "available" ? "available" : "none",
    island: storedSuggestConfig?.island === "normal" ? "normal" : "wakakusa_ex",
    fieldBonusPercent: Number(
      storedSuggestConfig?.fieldBonusPercent ?? storedEnergyConfig?.fieldBonusPercent ?? 0,
    ) || 0,
    eventBonusMultiplier: Number(
      storedSuggestConfig?.eventBonusMultiplier ?? storedEnergyConfig?.eventBonusMultiplier ?? 1,
    ) || 1,
    bonusPreset: ["preset_berries", "ingredient_plus", "skill_up"].includes(
      storedSuggestConfig?.bonusPreset,
    )
      ? storedSuggestConfig.bonusPreset
      : "preset_berries",
    otherMemo: storedSuggestConfig?.otherMemo || "",
  },
  gatherRates: gatherRatesPayload,
  gatherPokemonCount: normalizePokemonCount(storedPokemonCountRaw),
  gatherMemo: storage.getItem("gatherMemo") || "",
  potCapacity: Math.max(1, Number(storage.getItem("potCapacity") || 69)),
  excludeMaxLevel: storage.getItem("excludeMaxLevel") === "1",
  excludeOverPot: storage.getItem("excludeOverPot") === "1",
  stockPlan: {
    bagCapacity: Math.max(1, Number(storedStockConfig?.bagCapacity) || 240),
    islandType: storedStockConfig?.islandType === "normal" ? "normal" : "EX",
    eventType: ["none", "pokemon", "cooking"].includes(storedStockConfig?.eventType)
      ? storedStockConfig.eventType
      : "none",
    cookingCategories: Array.isArray(storedCookingCategoriesRaw)
      ? storedCookingCategoriesRaw.slice()
      : [],
    gatherRates: stockGatherRatesPayload,
    distributeLeftover: storedStockConfig?.distributeLeftover !== false,
    excludeMaxLevel: storedStockConfig?.excludeMaxLevel === true,
  },
};

if (!state.next || typeof state.next !== "object") {
  state.next = createEmptyNext();
}
const defaults = createEmptyNext();
for (const key of Object.keys(defaults)) {
  if (!Array.isArray(state.next[key])) state.next[key] = [];
}

state.energyConfig.fieldBonusPercent = normalizePercent(state.energyConfig.fieldBonusPercent);
state.energyConfig.eventBonusMultiplier = normalizeMultiplier(
  state.energyConfig.eventBonusMultiplier,
);
if (!state.energyConfig.levels || typeof state.energyConfig.levels !== "object") {
  state.energyConfig.levels = {};
}

state.suggestConfig.fieldBonusPercent = normalizePercent(
  state.suggestConfig.fieldBonusPercent,
);
state.suggestConfig.eventBonusMultiplier = normalizeMultiplier(
  state.suggestConfig.eventBonusMultiplier,
);

if (!Array.isArray(state.stockPlan.cookingCategories)) {
  state.stockPlan.cookingCategories = [];
}
if (!state.stockPlan.gatherRates || typeof state.stockPlan.gatherRates !== "object") {
  state.stockPlan.gatherRates = {};
}

export function markNextDirty() {
  state.nextVersion = (state.nextVersion || 0) + 1;
}

export function saveState() {
  storage.setItem("have", JSON.stringify(state.have));
  storage.setItem("chosen", JSON.stringify(state.chosen));
  storage.setItem("next", JSON.stringify(state.next));
  storage.setItem("tableFilter", JSON.stringify(state.tableFilter));
  storage.setItem("energyConfig", JSON.stringify(state.energyConfig));
  const gatherPayload = {
    ...state.gatherRates,
    __pokemonCount: state.gatherPokemonCount,
  };
  storage.setItem("gatherRates", JSON.stringify(gatherPayload));
  storage.setItem("gatherMemo", state.gatherMemo || "");
  storage.setItem("potCapacity", String(state.potCapacity || 69));
  storage.setItem("excludeMaxLevel", state.excludeMaxLevel ? "1" : "0");
  storage.setItem("excludeOverPot", state.excludeOverPot ? "1" : "0");
  const stockConfig = {
    bagCapacity: state.stockPlan?.bagCapacity || 240,
    islandType: state.stockPlan?.islandType || "EX",
    eventType: state.stockPlan?.eventType || "none",
    cookingCategories: state.stockPlan?.cookingCategories || [],
    distributeLeftover: state.stockPlan?.distributeLeftover !== false,
    excludeMaxLevel: state.stockPlan?.excludeMaxLevel === true,
  };
  storage.setItem("stockPlanConfig", JSON.stringify(stockConfig));
  storage.setItem("stockGatherRates", JSON.stringify(state.stockPlan?.gatherRates || {}));
  const suggestConfig = {
    eventType: state.suggestConfig?.eventType || "none",
    eventCustom: state.suggestConfig?.eventCustom || "",
    ec: state.suggestConfig?.ec || "none",
    island: state.suggestConfig?.island || "wakakusa_ex",
    fieldBonusPercent: state.suggestConfig?.fieldBonusPercent ?? state.energyConfig.fieldBonusPercent,
    eventBonusMultiplier: state.suggestConfig?.eventBonusMultiplier ?? state.energyConfig.eventBonusMultiplier,
    bonusPreset: state.suggestConfig?.bonusPreset || "preset_berries",
    otherMemo: state.suggestConfig?.otherMemo || "",
  };
  storage.setItem("suggestConfig", JSON.stringify(suggestConfig));
}

function ensureNextStructure() {
  if (!state.next || typeof state.next !== "object") {
    state.next = createEmptyNext();
  }
  if (!Array.isArray(state.next.CURRY)) state.next.CURRY = [];
  if (!Array.isArray(state.next.SALAD)) state.next.SALAD = [];
  if (!Array.isArray(state.next.SWEETS)) state.next.SWEETS = [];
  if (!Array.isArray(state.next.extra)) state.next.extra = [];
  return state.next;
}

function normalizeNextKey(catKey) {
  const upper = typeof catKey === "string" ? catKey.toUpperCase() : "";
  if (upper === "CURRY" || upper === "SALAD" || upper === "SWEETS") return upper;
  return null;
}

export function findChosen(recipeId) {
  if (!recipeId) return null;
  return state.chosen.find((entry) => entry.recipe === recipeId) || null;
}

export function incChosen(recipeId) {
  if (!recipeId) return false;
  const hit = findChosen(recipeId);
  if (hit) {
    const current = Number(hit.qty) || 0;
    hit.qty = current + 1;
  } else {
    state.chosen.push({ recipe: recipeId, qty: 1 });
  }
  return true;
}

export function decChosen(recipeId) {
  if (!recipeId) return false;
  const hit = findChosen(recipeId);
  if (!hit) return false;
  const prev = Number(hit.qty) || 0;
  const nextQty = Math.max(0, prev - 1);
  if (nextQty === prev) return false;
  hit.qty = nextQty;
  return true;
}

export function setChosenQty(recipeId, qty) {
  if (!recipeId) return false;
  const hit = findChosen(recipeId);
  if (!hit) return false;
  const nextQty = Math.max(0, Number(qty) || 0);
  if (hit.qty === nextQty) return false;
  hit.qty = nextQty;
  return true;
}

export function removeChosen(recipeId) {
  if (!recipeId) return false;
  const before = state.chosen.length;
  state.chosen = state.chosen.filter((entry) => entry.recipe !== recipeId);
  return state.chosen.length !== before;
}

function sanitizeChosenEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const recipeId = entry.recipe || entry.recipeId;
  if (!recipeId) return null;
  const qtyRaw = Number(entry.qty);
  const qty = Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : 0;
  if (qty <= 0) return null;
  return { recipe: recipeId, qty };
}

export function replaceChosen(nextChosen) {
  if (!Array.isArray(nextChosen)) {
    state.chosen = [];
    return state.chosen;
  }
  const sanitized = nextChosen.map(sanitizeChosenEntry).filter(Boolean);
  state.chosen = sanitized;
  return state.chosen;
}

function ensureNextArray(catKey) {
  const next = ensureNextStructure();
  const key = normalizeNextKey(catKey);
  if (!key) return null;
  if (!Array.isArray(next[key])) next[key] = [];
  return next[key];
}

export function findNextEntry(catKey, recipeId) {
  const arr = ensureNextArray(catKey);
  if (!arr || !recipeId) return null;
  return arr.find((entry) => entry.recipe === recipeId) || null;
}

export function incNextRecipe(catKey, recipeId) {
  if (!recipeId) return false;
  const arr = ensureNextArray(catKey);
  if (!arr) return false;
  const hit = arr.find((entry) => entry.recipe === recipeId);
  if (hit) {
    const current = Number(hit.qty) || 0;
    hit.qty = current + 1;
  } else {
    arr.push({ recipe: recipeId, qty: 1 });
  }
  markNextDirty();
  return true;
}

export function decNextRecipe(catKey, recipeId) {
  if (!recipeId) return false;
  const arr = ensureNextArray(catKey);
  if (!arr) return false;
  const hit = arr.find((entry) => entry.recipe === recipeId);
  if (!hit) return false;
  const prev = Number(hit.qty) || 0;
  const nextQty = Math.max(0, prev - 1);
  if (nextQty === prev) return false;
  hit.qty = nextQty;
  markNextDirty();
  return true;
}

export function setNextRecipeQty(catKey, recipeId, qty) {
  if (!recipeId) return false;
  const arr = ensureNextArray(catKey);
  if (!arr) return false;
  const hit = arr.find((entry) => entry.recipe === recipeId);
  if (!hit) return false;
  const nextQty = Math.max(0, Number(qty) || 0);
  if (hit.qty === nextQty) return false;
  hit.qty = nextQty;
  markNextDirty();
  return true;
}

export function removeNextRecipe(catKey, recipeId) {
  if (!recipeId) return false;
  const arr = ensureNextArray(catKey);
  if (!arr) return false;
  const filtered = arr.filter((entry) => entry.recipe !== recipeId);
  if (filtered.length === arr.length) return false;
  const key = normalizeNextKey(catKey);
  state.next[key] = filtered;
  markNextDirty();
  return true;
}

function ensureExtraArray() {
  const next = ensureNextStructure();
  if (!Array.isArray(next.extra)) next.extra = [];
  return next.extra;
}

export function findNextExtra(ingId) {
  if (!ingId) return null;
  const arr = ensureExtraArray();
  return arr.find((entry) => entry.ingId === ingId) || null;
}

export function incNextExtra(ingId) {
  if (!ingId) return false;
  const arr = ensureExtraArray();
  const hit = arr.find((entry) => entry.ingId === ingId);
  if (hit) {
    const current = Number(hit.qty) || 0;
    hit.qty = current + 1;
  } else {
    arr.push({ ingId, qty: 1 });
  }
  markNextDirty();
  return true;
}

export function decNextExtra(ingId) {
  if (!ingId) return false;
  const arr = ensureExtraArray();
  const hit = arr.find((entry) => entry.ingId === ingId);
  if (!hit) return false;
  const prev = Number(hit.qty) || 0;
  const nextQty = prev - 1;
  if (nextQty === prev) return false;
  if (nextQty === 0) {
    state.next.extra = arr.filter((entry) => entry.ingId !== ingId);
  } else {
    hit.qty = nextQty;
  }
  markNextDirty();
  return true;
}

export function setNextExtraQty(ingId, qty) {
  if (!ingId) return false;
  const arr = ensureExtraArray();
  const hit = arr.find((entry) => entry.ingId === ingId);
  if (!hit) return false;
  const nextQtyRaw = Number(qty);
  const nextQty = Number.isFinite(nextQtyRaw) ? nextQtyRaw : 0;
  if (hit.qty === nextQty) return false;
  if (nextQty === 0) {
    state.next.extra = arr.filter((entry) => entry.ingId !== ingId);
  } else {
    hit.qty = nextQty;
  }
  markNextDirty();
  return true;
}

export function removeNextExtra(ingId) {
  if (!ingId) return false;
  const arr = ensureExtraArray();
  const filtered = arr.filter((entry) => entry.ingId !== ingId);
  if (filtered.length === arr.length) return false;
  state.next.extra = filtered;
  markNextDirty();
  return true;
}

function sanitizeNextRecipeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const recipeId = entry.recipe || entry.recipeId;
  if (!recipeId) return null;
  const qty = Number(entry.qty);
  if (!Number.isFinite(qty) || qty === 0) return null;
  return { recipe: recipeId, qty };
}

function sanitizeNextExtraEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const ingId = entry.ingId;
  if (!ingId) return null;
  const qty = Number(entry.qty);
  if (!Number.isFinite(qty) || qty === 0) return null;
  return { ingId, qty };
}

export function replaceNextState(nextState) {
  const sanitized = createEmptyNext();
  if (nextState && typeof nextState === "object") {
    const keys = ["CURRY", "SALAD", "SWEETS"];
    keys.forEach((key) => {
      const list = Array.isArray(nextState[key]) ? nextState[key] : [];
      sanitized[key] = list
        .map(sanitizeNextRecipeEntry)
        .filter(Boolean);
    });
    sanitized.extra = Array.isArray(nextState.extra)
      ? nextState.extra.map(sanitizeNextExtraEntry).filter(Boolean)
      : [];
  }
  state.next = sanitized;
  markNextDirty();
  return state.next;
}

function buildIndexes() {
  const recipes = state?.data?.recipes || {};
  const allRecipes = Object.values(recipes).flat();
  state.index.recipeById = new Map(allRecipes.map((recipe) => [recipe.id, recipe]));

  const ingredients = state?.data?.ingredients || [];
  state.index.ingredientById = new Map(ingredients.map((ing) => [ing.id, ing]));
}

export function setData({ ingredients, recipes }) {
  state.data = { ingredients, recipes };
  buildIndexes();
}

export function refreshIndexes() {
  buildIndexes();
}

export function findRecipeById(id) {
  const indexed = state.index.recipeById?.get(id);
  if (indexed) return indexed;
  const groups = state?.data?.recipes || {};
  for (const list of Object.values(groups)) {
    const hit = (list || []).find((recipe) => recipe.id === id);
    if (hit) return hit;
  }
  return null;
}

function ensureStorage() {
  if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}
