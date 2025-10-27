// js/main.js
// - OCR解析（./ocr-parse.js）
// - セレクト選択で即追加
// - 数量は 0 まで可（−で 0、× で削除）
// - おすすめレシピ：必要食材「合計数が多い順」に並び替え
import { parseOcrText } from "./ocr-parse.js";
import {
  collectThisWeekIngredientIds,
  buildChosenRecipeSet,
} from "./logic/recommendation.js";
import { computeNextWeekTotals } from "./logic/next-week.js";
import { computeThisWeekTotals, buildTableRows } from "./logic/weekly-totals.js";
import { bindMenuCardOpsDelegation } from "./ui/card-ops.js";
import { setupNextWeekSelects, setupNextExtraSelect } from "./ui/next-week-selects.js";
import { setupIngredientsFilter } from "./ui/ingredients-filter.js";
import {
  computeFinalEnergy,
  normalizeLevel,
  normalizePercent,
  normalizeMultiplier,
} from "./logic/energy.js";
import { getRecipeLevelBonus } from "./data/recipe-level-bonus.js";
import {
  GATHER_COLUMNS,
  normalizeGatherArray,
  normalizeGatherValue,
} from "./logic/gather.js";

let switchTab = null;
let lastProposalCombos = [];
let lastStockPlanResult = null;

const APP_VERSION = '20251027-1627'; // update-version.js と連動

/* ----------------- DOM ----------------- */
const els = {
  // 既存…
  cat: document.getElementById("categorySelect"),
  rec: document.getElementById("recipeSelect"),
  chosen: document.getElementById("menuList"),
  ocr: document.getElementById("ocrInput"),
  parse: document.getElementById("parseBtn"),
  clear: document.getElementById("clearDataBtn"),

  // ★ 次週（3カテゴリ＋extra）
  nwRecCurry:  document.getElementById("nwRecCurry"),
  nwRecSalad:  document.getElementById("nwRecSalad"),
  nwRecSweets: document.getElementById("nwRecSweets"),
  nwListCurry: document.getElementById("nwListCurry"),
  nwListSalad: document.getElementById("nwListSalad"),
  nwListSweets:document.getElementById("nwListSweets"),
  nwExtraSelect: document.getElementById("nwExtraSelect"),
//  nwExtraQty:    document.getElementById("nwExtraQty"),
//  nwExtraAdd:    document.getElementById("nwExtraAdd"),
  energyTable: document.getElementById("energyTable"),
  gatherPokemonCount: document.getElementById("gatherPokemonCount"),
  potCapacity: document.getElementById("potCapacityInput"),
  excludeMaxLevel: document.getElementById("excludeMaxLevelCheckbox"),
  excludeOverPot: document.getElementById("excludeOverPotCheckbox"),
  gatherTable: document.getElementById("gatherTable"),
  stockBagCapacity: document.getElementById("stockBagCapacityInput"),
  stockIsland: document.getElementById("stockIslandSelect"),
  stockEvent: document.getElementById("stockEventSelect"),
  stockCookingWrap: document.getElementById("stockCookingSelectWrap"),
  stockCooking: document.getElementById("stockCookingSelect"),
  stockGatherTable: document.getElementById("stockGatherTable"),
  stockExcludeMax: document.getElementById("stockExcludeMaxCheckbox"),
  stockDistribute: document.getElementById("stockDistributeCheckbox"),
  stockApplyBtn: document.getElementById("applyStockPlanBtn"),
  suggestEvent: document.getElementById("suggestEventSelect"),
  suggestEventCustom: document.getElementById("suggestEventCustomInput"),
  suggestEc: document.getElementById("suggestEcSelect"),
  suggestIsland: document.getElementById("suggestIslandSelect"),
  suggestFieldBonus: document.getElementById("suggestFieldBonusInput"),
  suggestEventBonus: document.getElementById("suggestEventBonusInput"),
  suggestBonusSelect: document.getElementById("suggestBonusSelect"),
};

/* ----------------- State ----------------- */
const storedTableFilter = (() => {
  try {
    const raw = localStorage.getItem("tableFilter");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        this: parsed.this !== undefined ? !!parsed.this : undefined,
        next: parsed.next !== undefined ? !!parsed.next : undefined,
      };
    }
  } catch (err) {
    console.warn("[tableFilter] load failed:", err);
  }
  return null;
})();

const storedEnergyConfig = (() => {
  try {
    const raw = localStorage.getItem("energyConfig");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      fieldBonusPercent: Number(parsed.fieldBonusPercent) || 0,
      eventBonusMultiplier: Number(parsed.eventBonusMultiplier) || 1,
      levels: parsed.levels && typeof parsed.levels === "object" ? parsed.levels : {},
    };
  } catch (err) {
    console.warn("[energyConfig] load failed:", err);
    return null;
  }
})();

const storedGatherRates = (() => {
  try {
    const raw = localStorage.getItem("gatherRates");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    console.warn("[gatherRates] load failed:", err);
    return null;
  }
})();

const storedSuggestConfig = (() => {
  try {
    const raw = localStorage.getItem("suggestConfig");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    console.warn("[suggestConfig] load failed:", err);
    return null;
  }
})();

const storedStockConfig = (() => {
  try {
    const raw = localStorage.getItem("stockPlanConfig");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    console.warn("[stockPlanConfig] load failed:", err);
    return null;
  }
})();

const storedStockGatherRates = (() => {
  try {
    const raw = localStorage.getItem("stockGatherRates");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    console.warn("[stockGatherRates] load failed:", err);
    return null;
  }
})();

function normalizePokemonCount(value) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.min(GATHER_COLUMNS, num));
}

const gatherRatesPayload = storedGatherRates ? { ...storedGatherRates } : {};
const storedPokemonCountRaw = gatherRatesPayload.__pokemonCount;
if ("__pokemonCount" in gatherRatesPayload) delete gatherRatesPayload.__pokemonCount;

const stockGatherRatesPayload = storedStockGatherRates ? { ...storedStockGatherRates } : {};

const state = {
  have:   JSON.parse(localStorage.getItem("have")   || "{}"),
  chosen: JSON.parse(localStorage.getItem("chosen") || "[]"), // 今週
  next:   JSON.parse(localStorage.getItem("next")   || JSON.stringify({
            CURRY: [], SALAD: [], SWEETS: [], extra: []
          })), // 次週 {CURRY:[{recipe,qty}],... , extra:[{ingId,qty}]}
  data: null,
  nextWeekPlan: null,
  nextVersion: 0,
  tableFilter: {
    this: storedTableFilter?.this ?? true,
    next: storedTableFilter?.next ?? true,
  },
  energyConfig: {
    fieldBonusPercent: storedEnergyConfig?.fieldBonusPercent ?? 0,
    eventBonusMultiplier: storedEnergyConfig?.eventBonusMultiplier ?? 1,
    levels: storedEnergyConfig?.levels || {},
  },
  suggestConfig: {
    eventType: storedSuggestConfig?.eventType || "none",
    eventCustom: storedSuggestConfig?.eventCustom || "",
    ec: storedSuggestConfig?.ec || "none",
    island: storedSuggestConfig?.island || "wakakusa_ex",
    fieldBonusPercent: storedSuggestConfig?.fieldBonusPercent ?? (storedEnergyConfig?.fieldBonusPercent ?? 55),
    eventBonusMultiplier: storedSuggestConfig?.eventBonusMultiplier ?? (storedEnergyConfig?.eventBonusMultiplier ?? 1),
    bonusPreset: storedSuggestConfig?.bonusPreset || "preset_berries",
    otherMemo: storedSuggestConfig?.otherMemo || "",
  },
  gatherRates: gatherRatesPayload,
  gatherPokemonCount: normalizePokemonCount(storedPokemonCountRaw),
  gatherMemo: localStorage.getItem("gatherMemo") || "",
  potCapacity: Number(localStorage.getItem("potCapacity") || 69),
  excludeMaxLevel: localStorage.getItem("excludeMaxLevel") === "1",
  excludeOverPot: localStorage.getItem("excludeOverPot") === "1",
  stockPlan: {
    bagCapacity: Math.max(1, Number(storedStockConfig?.bagCapacity) || 240),
    islandType: storedStockConfig?.islandType === "normal" ? "normal" : "EX",
    eventType: ["none", "pokemon", "cooking"].includes(storedStockConfig?.eventType)
      ? storedStockConfig.eventType
      : "none",
    cookingCategory: ["curry", "salad", "dessert"].includes(storedStockConfig?.cookingCategory)
      ? storedStockConfig.cookingCategory
      : "curry",
    gatherRates: stockGatherRatesPayload,
    distributeLeftover: storedStockConfig?.distributeLeftover !== false,
    excludeMaxLevel: storedStockConfig?.excludeMaxLevel === true,
  },
};

state.energyConfig.fieldBonusPercent = normalizePercent(state.energyConfig.fieldBonusPercent ?? 0);
state.energyConfig.eventBonusMultiplier = normalizeMultiplier(state.energyConfig.eventBonusMultiplier ?? 1);
if (!state.energyConfig.levels || typeof state.energyConfig.levels !== "object") {
  state.energyConfig.levels = {};
}
state.suggestConfig.fieldBonusPercent = normalizePercent(state.suggestConfig.fieldBonusPercent ?? state.energyConfig.fieldBonusPercent ?? 0);
state.suggestConfig.eventBonusMultiplier = normalizeMultiplier(state.suggestConfig.eventBonusMultiplier ?? state.energyConfig.eventBonusMultiplier ?? 1);
state.energyConfig.fieldBonusPercent = state.suggestConfig.fieldBonusPercent;
state.energyConfig.eventBonusMultiplier = state.suggestConfig.eventBonusMultiplier;
const EVENT_OPTIONS = new Set(["none", "halloween"]);
if (!EVENT_OPTIONS.has(state.suggestConfig.eventType)) {
  state.suggestConfig.eventCustom = state.suggestConfig.eventType || state.suggestConfig.eventCustom || "";
  state.suggestConfig.eventType = "custom";
} else if (state.suggestConfig.eventType !== "custom") {
  state.suggestConfig.eventCustom = "";
}
const EC_OPTIONS = new Set(["none", "available"]);
if (!EC_OPTIONS.has(state.suggestConfig.ec)) {
  state.suggestConfig.ec = "none";
}
const ISLAND_OPTIONS = new Set(["wakakusa_ex", "normal"]);
if (!ISLAND_OPTIONS.has(state.suggestConfig.island)) {
  state.suggestConfig.island = "wakakusa_ex";
}
const BONUS_PRESET_MAP = {
  preset_berries: "きのみx2.4",
  ingredient_plus: "食材+1",
  skill_up: "スキル確率×1.25"
};
if (!["preset_berries", "ingredient_plus", "skill_up"].includes(state.suggestConfig.bonusPreset)) {
  state.suggestConfig.bonusPreset = "preset_berries";
}
state.suggestConfig.bonusNote = BONUS_PRESET_MAP[state.suggestConfig.bonusPreset] ?? "";
if (!state.gatherRates || typeof state.gatherRates !== "object") {
  state.gatherRates = {};
}
state.gatherPokemonCount = normalizePokemonCount(state.gatherPokemonCount);
state.potCapacity = Math.max(1, Number(state.potCapacity) || 69);
if (!state.stockPlan || typeof state.stockPlan !== "object") {
  state.stockPlan = {
    bagCapacity: 240,
    islandType: "EX",
    eventType: "none",
    cookingCategory: "curry",
    gatherRates: {},
    distributeLeftover: true,
    excludeMaxLevel: false,
  };
}
if (!state.stockPlan.gatherRates || typeof state.stockPlan.gatherRates !== "object") {
  state.stockPlan.gatherRates = {};
}
state.stockPlan.bagCapacity = Math.max(1, Number(state.stockPlan.bagCapacity) || 240);
if (!["EX", "normal"].includes(state.stockPlan.islandType)) {
  state.stockPlan.islandType = "EX";
}
if (!["none", "pokemon", "cooking"].includes(state.stockPlan.eventType)) {
  state.stockPlan.eventType = "none";
}
if (!["curry", "salad", "dessert"].includes(state.stockPlan.cookingCategory)) {
  state.stockPlan.cookingCategory = "curry";
}
state.stockPlan.distributeLeftover = state.stockPlan.distributeLeftover !== false;
state.stockPlan.excludeMaxLevel = state.stockPlan.excludeMaxLevel === true;

function save() {
  localStorage.setItem("have", JSON.stringify(state.have));
  localStorage.setItem("chosen", JSON.stringify(state.chosen));
  localStorage.setItem("next", JSON.stringify(state.next)); // ★追加
  localStorage.setItem("energyConfig", JSON.stringify(state.energyConfig));
  const gatherPayload = {
    ...state.gatherRates,
    __pokemonCount: state.gatherPokemonCount,
  };
  localStorage.setItem("gatherRates", JSON.stringify(gatherPayload));
  localStorage.setItem("gatherMemo", state.gatherMemo || "");
  localStorage.setItem("potCapacity", String(state.potCapacity || 69));
  localStorage.setItem("excludeMaxLevel", state.excludeMaxLevel ? "1" : "0");
  localStorage.setItem("excludeOverPot", state.excludeOverPot ? "1" : "0");
  const stockConfig = {
    bagCapacity: state.stockPlan?.bagCapacity || 240,
    islandType: state.stockPlan?.islandType || "EX",
    eventType: state.stockPlan?.eventType || "none",
    cookingCategory: state.stockPlan?.cookingCategory || "curry",
    distributeLeftover: state.stockPlan?.distributeLeftover !== false,
    excludeMaxLevel: state.stockPlan?.excludeMaxLevel === true,
  };
  localStorage.setItem("stockPlanConfig", JSON.stringify(stockConfig));
  localStorage.setItem("stockGatherRates", JSON.stringify(state.stockPlan?.gatherRates || {}));
  const suggestConfig = {
    eventType: state.suggestConfig?.eventType || "none",
    eventCustom: state.suggestConfig?.eventCustom || "",
    ec: state.suggestConfig?.ec || "none",
    island: state.suggestConfig?.island || "wakakusa_ex",
    fieldBonusPercent: state.energyConfig.fieldBonusPercent,
    eventBonusMultiplier: state.energyConfig.eventBonusMultiplier,
    bonusPreset: state.suggestConfig?.bonusPreset || "preset_berries",
    otherMemo: state.suggestConfig?.otherMemo || "",
  };
  localStorage.setItem("suggestConfig", JSON.stringify(suggestConfig));
}

function markNextDirty() {
  state.nextVersion = (state.nextVersion || 0) + 1;
}

/* ----------------- Data load ----------------- */
async function loadData() {
  const [ingredients, recipes, nextPlan] = await Promise.all([
    fetch(`./data/ingredients.json?v=${APP_VERSION}`).then( r => r.json()),
    fetch(`./data/recipes.json?v=${APP_VERSION}`).then( r => r.json()),
    fetch(`./nextWeekPlan.json?v=${APP_VERSION}`).then((r) => r.json()).catch(() => ({})),
  ]);
  state.data = { ingredients, recipes };
  if (nextPlan && typeof nextPlan === "object") {
    state.nextWeekPlan = nextPlan;
  }
  buildCategoryOptions(recipes);
}

function buildNextWeekOptions() {
  if (!state?.data) return;
  // 各カテゴリのレシピセレクト
  const catKey = { CURRY:"curry", SALAD:"salad", SWEETS:"dessert" };
  const fill = (sel, list=[]) => {
    if (!sel) return;
    sel.innerHTML =
      '<option value="">選択してください</option>' +
      list.map(r => `<option value="${r.id}">${r.title}</option>`).join("");
  };
  fill(els.nwRecCurry,  state.data.recipes[catKey.CURRY]  || []);
  fill(els.nwRecSalad,  state.data.recipes[catKey.SALAD]  || []);
  fill(els.nwRecSweets, state.data.recipes[catKey.SWEETS] || []);

  // 個別食材セレクト
  if (els.nwExtraSelect) {
    els.nwExtraSelect.innerHTML = (state.data.ingredients||[])
      .map(i => `<option value="${i.id}">${i.emoji||""} ${i.name}</option>`).join("");
  }
}

/* ----------------- Tabs ----------------- */
function setupTabs() {
  const btns = document.querySelectorAll('.tabs .tab');
  const panels = {
    this: document.getElementById('tab_this_week'),
    next: document.getElementById('tab_next_week'),
    gather: document.getElementById('tab_gather'),
    stock: document.getElementById('tab_stock'),
  };
  if (!btns.length || !panels.this) return;

  const activate = (key) => {
    btns.forEach((btn) => {
      const active = btn.dataset.tab === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    Object.entries(panels).forEach(([panelKey, panel]) => {
      if (!panel) return;
      const active = panelKey === key;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });

    localStorage.setItem('activeTab', key);

    if (key === 'next') {
      renderNextChosen?.();
      renderTables?.();
      renderSuggestionsTable?.();
      renderEnergyTable(els.cat?.value || null);
    } else if (key === 'gather') {
      renderGatherTable();
    } else if (key === 'stock') {
      renderStockGatherTable();
      renderStockPlanResults();
    } else {
      renderTables?.();
      renderSuggestionsTable?.();
    }
  };

  btns.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  const saved = localStorage.getItem('activeTab');
  const defaultKey = saved && panels[saved] ? saved : 'this';
  switchTab = activate;
  activate(defaultKey);
}

/* ----------------- Select builders ----------------- */
const CATEGORY_LABELS = {
  curry: "カレー・シチュー",
  salad: "サラダ",
  dessert: "デザート・ドリンク",
};

const ALL_RECIPE_CATEGORIES = ["curry", "salad", "dessert"];
const CATEGORY_TO_NEXT_KEY = {
  curry: "CURRY",
  salad: "SALAD",
  dessert: "SWEETS",
};

function buildCategoryOptions(recipes) {
  const order = ["curry", "salad", "dessert"].filter(k => recipes[k]);
  els.cat.innerHTML = order.map(k => `<option value="${k}">${CATEGORY_LABELS[k] || k}</option>`).join("");
  buildRecipeOptions();
}

let buildingRecipeOptions = false;
function buildRecipeOptions() {
  const cat = els.cat.value;
  const list = state.data.recipes[cat] || [];
  buildingRecipeOptions = true;
  els.rec.innerHTML = list.map(r => `<option value="${r.id}">${r.title}</option>`).join("");
  buildingRecipeOptions = false;
  renderEnergyTable(cat);
}

function addNextRecipe(cat, recipeId) {
  if (!recipeId) return;
  const arr = state.next[cat] || (state.next[cat] = []);
  const hit = arr.find(x => x.recipe === recipeId);
  if (hit) hit.qty += 1; else arr.push({ recipe: recipeId, qty: 1 });
  markNextDirty();
  save(); renderNextChosen(); rerenderTablesAndSuggestions();
}

/* ----------------- Menu actions ----------------- */
function addRecipeById(id) {
  if (!id) return;
  const found = state.chosen.find(c => c.recipe === id);
  if (found) found.qty += 1;
  else state.chosen.push({ recipe: id, qty: 1 });
  save();
  refresh();
}

els.cat.addEventListener("change", () => buildRecipeOptions());
els.rec.addEventListener("change", () => {
  if (buildingRecipeOptions) return;
  addRecipeById(els.rec.value);
});

/* ----------------- OCR ----------------- */
els.parse?.addEventListener("click", () => {
  const raw = (els.ocr?.value || "").trim();
  if (!raw) return alert("OCRテキストを入力してください。");
  const { result, debug } = parseOcrText(raw, state.data.ingredients);
  console.log("OCR debug:", debug);
  state.have = result || {};
  save(); refresh();
});
els.clear?.addEventListener("click", () => {
  state.have = {};
  state.chosen = [];
  if (els.ocr) els.ocr.value = "";
  save(); refresh();
});

/* ----------------- Helpers ----------------- */
function buildInventoryMap() {
  const m = new Map();
  for (const ing of state.data.ingredients) m.set(ing.id, Number(state.have[ing.id] || 0));
  return m;
}
function em(ingId) {
  const ing = state.data.ingredients.find(x => x.id === ingId);
  return ing?.emoji || "";
}

function getRecipeLevel(recipeId) {
  if (!recipeId) return 0;
  const levels = state.energyConfig?.levels || {};
  return normalizeLevel(levels[recipeId] ?? 0);
}

function setRecipeLevel(recipeId, level) {
  if (!recipeId) return;
  const normalized = normalizeLevel(level);
  const levels = state.energyConfig.levels || (state.energyConfig.levels = {});
  if (levels[recipeId] === normalized) return;
  levels[recipeId] = normalized;
  save();
  renderEnergyTable(els.cat?.value || null);
  clearProposalResults();
}

function setFieldBonusPercent(value) {
  const normalized = normalizePercent(value);
  if (state.energyConfig.fieldBonusPercent === normalized && state.suggestConfig.fieldBonusPercent === normalized) return;
  state.energyConfig.fieldBonusPercent = normalized;
  state.suggestConfig.fieldBonusPercent = normalized;
  save();
  renderEnergyTable(els.cat?.value || null);
  clearProposalResults();
}

function setEventBonusMultiplier(value) {
  const normalized = normalizeMultiplier(value);
  if (state.energyConfig.eventBonusMultiplier === normalized && state.suggestConfig.eventBonusMultiplier === normalized) return;
  state.energyConfig.eventBonusMultiplier = normalized;
  state.suggestConfig.eventBonusMultiplier = normalized;
  save();
  renderEnergyTable(els.cat?.value || null);
  clearProposalResults();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ja-JP");
}

function formatHours(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 100) return Math.round(value).toString();
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatEnergyPerHour(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return formatNumber(Math.round(value));
}

function formatRemainingHours(value) {
  return formatHours(value);
}

function formatSlotCount(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
}

function formatEnergyPerSlot(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value);
  return formatNumber(rounded);
}

function computeShortageHoursDisplay(ingId, shortageQty) {
  if (!shortageQty || shortageQty <= 0) return "-";
  const hours = computeIngredientHours(ingId, shortageQty, {
    usePokemonCount: true,
    pokemonCount: state.gatherPokemonCount,
  });
  if (!Number.isFinite(hours) || hours <= 0) return "-";
  return formatRemainingHours(hours);
}

function serializeRecipeLevels() {
  const levels = state.energyConfig?.levels || {};
  const payload = { levels: {} };
  Object.entries(state.data?.recipes || {}).forEach(([_, list]) => {
    (list || []).forEach((recipe) => {
      const normalized = normalizeLevel(levels?.[recipe.id] ?? 0);
      if (normalized > 0) payload.levels[recipe.id] = normalized;
    });
  });
  return JSON.stringify(payload, null, 2);
}

function applyRecipeLevelsData(input) {
  if (!input) throw new Error("空のデータです");
  const payload = input.levels ? input : { levels: input };
  if (!payload.levels || typeof payload.levels !== "object") {
    throw new Error("levels オブジェクトが見つかりません");
  }
  const next = { ...(state.energyConfig.levels || {}) };
  Object.entries(payload.levels).forEach(([id, value]) => {
    const normalized = normalizeLevel(value);
    if (normalized > 0) next[id] = normalized;
  });
  state.energyConfig.levels = next;
  save();
}

function writeToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => {});
  }
  return Promise.resolve();
}

function serializeGatherConfig() {
  const rates = {};
  Object.entries(state.gatherRates || {}).forEach(([id, arr]) => {
    const normalized = normalizeGatherArray(arr);
    if (normalized.some((v) => Number(v) > 0)) {
      rates[id] = normalized;
    }
  });
  return JSON.stringify({
    pokemonCount: state.gatherPokemonCount,
    rates,
  }, null, 2);
}

function applyGatherConfig(data) {
  if (!data) throw new Error("空のデータです");
  const payload = data.rates ? data : { rates: data };
  const nextRates = {};
  Object.entries(payload.rates || {}).forEach(([id, arr]) => {
    nextRates[id] = normalizeGatherArray(arr);
  });
  state.gatherRates = nextRates;
  if (payload.pokemonCount !== undefined) {
    state.gatherPokemonCount = normalizePokemonCount(payload.pokemonCount);
  }
  save();
}

function getGatherRates(ingId) {
  return normalizeGatherArray(state.gatherRates?.[ingId], GATHER_COLUMNS);
}

function setGatherRate(ingId, index, value) {
  if (!ingId) return;
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= GATHER_COLUMNS) return;
  const arr = getGatherRates(ingId);
  const normalized = normalizeGatherValue(value);
  if (arr[idx] === normalized) return;
  arr[idx] = normalized;
  state.gatherRates[ingId] = arr;
  save();
  renderGatherTable();
  renderEnergyTable(els.cat?.value || null);
  clearProposalResults();
}

function setGatherPokemonCount(value) {
  const normalized = normalizePokemonCount(value);
  if (state.gatherPokemonCount === normalized) return;
  state.gatherPokemonCount = normalized;
  save();
  renderGatherTable();
  renderEnergyTable(els.cat?.value || null);
  clearProposalResults();
}

function serializeStockGatherConfig() {
  const rates = {};
  Object.entries(state.stockPlan?.gatherRates || {}).forEach(([id, arr]) => {
    const normalized = normalizeGatherArray(arr);
    if (normalized.some((v) => Number(v) > 0)) {
      rates[id] = normalized;
    }
  });
  return JSON.stringify({
    bagCapacity: state.stockPlan?.bagCapacity || 240,
    islandType: state.stockPlan?.islandType || "EX",
    eventType: state.stockPlan?.eventType || "none",
    cookingCategory: state.stockPlan?.cookingCategory || "curry",
    rates,
  }, null, 2);
}

function applyStockGatherConfig(data) {
  if (!data) throw new Error("空のデータです");
  const payload = data.rates ? data : { rates: data };
  const nextRates = {};
  Object.entries(payload.rates || {}).forEach(([id, arr]) => {
    nextRates[id] = normalizeGatherArray(arr);
  });
  state.stockPlan.gatherRates = nextRates;
  if (payload.bagCapacity !== undefined) {
    state.stockPlan.bagCapacity = Math.max(1, Number(payload.bagCapacity) || state.stockPlan.bagCapacity || 240);
  }
  if (payload.islandType && ["EX", "normal"].includes(payload.islandType)) {
    state.stockPlan.islandType = payload.islandType;
  }
  if (payload.eventType && ["none", "pokemon", "cooking"].includes(payload.eventType)) {
    state.stockPlan.eventType = payload.eventType;
  }
  if (payload.cookingCategory && ["curry", "salad", "dessert"].includes(payload.cookingCategory)) {
    state.stockPlan.cookingCategory = payload.cookingCategory;
  }
  save();
}

function getStockGatherRates(ingId) {
  return normalizeGatherArray(state.stockPlan?.gatherRates?.[ingId], GATHER_COLUMNS);
}

function setStockGatherRate(ingId, index, value) {
  if (!ingId) return;
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= GATHER_COLUMNS) return;
  const arr = getStockGatherRates(ingId);
  const normalized = normalizeGatherValue(value);
  if (arr[idx] === normalized) return;
  arr[idx] = normalized;
  state.stockPlan.gatherRates[ingId] = arr;
  save();
  renderStockGatherTable();
}

function getStockBoostedIngredients() {
  const boosted = new Set();
  Object.entries(state.stockPlan?.gatherRates || {}).forEach(([id, arr]) => {
    if (Array.isArray(arr) && arr.some((v) => Number(v) > 0)) {
      boosted.add(id);
    }
  });
  return boosted;
}

function computeIngredientHours(ingId, needQty, { usePokemonCount = true, pokemonCount = state.gatherPokemonCount } = {}) {
  if ((Number(needQty) || 0) <= 0) return 0;
  const rates = getGatherRates(ingId);
  const normalizedRates = rates.map((val) => Math.max(0, val));
  let dailyRate;
  if (usePokemonCount) {
    const count = normalizePokemonCount(pokemonCount);
    const sorted = [...normalizedRates].sort((a, b) => b - a);
    dailyRate = sorted.slice(0, count).reduce((sum, val) => sum + val, 0);
  } else {
    dailyRate = normalizedRates.reduce((sum, val) => sum + val, 0);
  }
  if (dailyRate <= 0) return Number.POSITIVE_INFINITY;
  return (needQty / dailyRate) * 24;
}

function computeRecipeEnergyStats(recipe, {
  level,
  fieldBonusPercent,
  eventBonusMultiplier,
  usePokemonCount = false,
  pokemonCount = state.gatherPokemonCount,
  potCapacity = null,
} = {}) {
  const finalEnergy = computeFinalEnergy({
    baseEnergy: recipe.energy,
    level,
    fieldBonusPercent,
    eventBonusMultiplier,
  });
  if (potCapacity && Number(recipe.total || 0) > potCapacity) {
    return { finalEnergy, hoursRequired: Number.POSITIVE_INFINITY, energyPerHour: null, overflow: true };
  }

  let hoursRequired = 0;
  for (const [ingId, qty] of Object.entries(recipe.needs || {})) {
    const need = Number(qty) || 0;
    const hours = computeIngredientHours(ingId, need, { usePokemonCount, pokemonCount });
    if (!Number.isFinite(hours)) {
      hoursRequired = Number.POSITIVE_INFINITY;
      break;
    }
    hoursRequired += hours;
  }

  const energyPerHour = (Number.isFinite(hoursRequired) && hoursRequired > 0)
    ? finalEnergy / hoursRequired
    : null;

  return { finalEnergy, hoursRequired, energyPerHour };
}

function getAllRecipeEnergyStats({
  categoryFilter = null,
  usePokemonCount = false,
  pokemonCount = state.gatherPokemonCount,
  potCapacity = state.potCapacity,
  excludeMaxLevel = state.excludeMaxLevel,
  maxLevel = 65,
} = {}) {
  const recipesByCat = state.data?.recipes || {};
  const { fieldBonusPercent, eventBonusMultiplier } = state.energyConfig;
  const stats = [];
  Object.entries(recipesByCat).forEach(([catKey, list]) => {
    if (categoryFilter && catKey !== categoryFilter) return;
    (list || []).forEach((recipe) => {
      const level = getRecipeLevel(recipe.id);
      if (excludeMaxLevel && level >= maxLevel) return;
      const calc = computeRecipeEnergyStats(recipe, {
        level,
        fieldBonusPercent,
        eventBonusMultiplier,
        usePokemonCount,
        pokemonCount,
        potCapacity: state.excludeOverPot ? potCapacity : null,
      });
      stats.push({
        id: recipe.id,
        title: recipe.title,
        categoryKey: catKey,
        categoryLabel: CATEGORY_LABELS[catKey] || catKey,
        recipe,
        ...calc,
      });
    });
  });
  return stats;
}

function clearProposalResults(message = "条件が変更されました。再計算してください。") {
  const container = document.getElementById("proposalResults");
  lastProposalCombos = [];
  if (container) {
    container.innerHTML = `<p class="muted">${message}</p>`;
  }
  updateProposalAppliedHighlight(null);
}

/* ----------------- Render ----------------- */
function refresh() {
  renderMenuList();
  renderNextChosen();
  rerenderTablesAndSuggestions();
  renderEnergyTable(els.cat?.value || null);
  renderGatherTable();
}

function renderNextChosen() {
  const map = {
    CURRY:  document.getElementById('nwListCurry'),
    SALAD:  document.getElementById('nwListSalad'),
    SWEETS: document.getElementById('nwListSweets'),
  };
  ['CURRY','SALAD','SWEETS'].forEach(k => {
    renderMenuCardsShared({
      ctx: 'NEXT',
      items: state.next[k] || [],
      mountEl: map[k],
      catKey: k
    });
  });
  renderExtraCards();
}

function rerenderTablesAndSuggestions() {
  renderTables();
  renderSuggestionsTable();
}

// 今週/次週チェックに基づき「使用食材／その他の食材」の2表を1回で描画
function renderTables() {
  const invMap = buildInventoryMap();
  const ingredients = state.data.ingredients || [];

  const useThis = state.tableFilter?.this !== undefined ? !!state.tableFilter.this : true;
  const useNext = state.tableFilter?.next !== undefined ? !!state.tableFilter.next : true;
  const tableFilter = { this: useThis, next: useNext };

  const thisTotals = computeThisWeekTotals(state.chosen, findRecipeById);
  const nextTotalsMap = computeNextWeekTotals(
    state.next,
    state.data.recipes || {},
    ingredients,
    state.nextVersion,
  );
  const nextTotals = {
    map: new Map(
      Array.from(nextTotalsMap.entries()).map(([id, info]) => [id, Number(info?.qty) || 0])
    ),
    used: new Set(nextTotalsMap.keys()),
  };

  const { usedRows, otherRows, sums } = buildTableRows({
    thisTotals,
    nextTotals,
    tableFilter,
    inventoryMap: invMap,
    ingredients,
    computeShortageHours: (ingId, shortage) => computeShortageHoursDisplay(ingId, shortage),
  });

  const writeTable = (tableId, rows, sumsObj) => {
    const el = document.getElementById(tableId);
    if (!el) return;
    const body = rows.length ? rows.join("") : `<tr><td class="muted" colspan="5">（なし）</td></tr>`;
    const footDiff = sumsObj.cur - sumsObj.tar;
    el.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">現在</th><th class="num">目標</th><th class="num">差分</th><th class="num">残時間 (h)</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <th>合計</th>
          <th class="num">${sumsObj.cur}</th>
          <th class="num">${sumsObj.tar}</th>
          <th class="num ${footDiff < 0 ? 'neg' : footDiff > 0 ? 'pos' : ''}">${footDiff}</th>
          <th class="num">-</th>
        </tr>
      </tfoot>`;
  };

  writeTable('usedTable', usedRows, sums.used);
  writeTable('otherTable', otherRows, sums.other);
}

function renderEnergyTable(selectedCategory = null) {
  const table = els.energyTable || document.getElementById("energyTable");
  if (!table || !state?.data?.recipes) return;

  const { fieldBonusPercent, eventBonusMultiplier, levels = {} } = state.energyConfig || {};

  const recipesByCat = state.data.recipes || {};
  const categoryLabelEl = document.getElementById("energyCategoryLabel");
  const rows = [];
  const filterKey = selectedCategory || els.cat?.value || Object.keys(recipesByCat)[0];
  const targetList = filterKey ? recipesByCat[filterKey] || [] : Object.values(recipesByCat).flat();

  if (categoryLabelEl) {
    categoryLabelEl.textContent = CATEGORY_LABELS[filterKey] || filterKey || "-";
  }

  (targetList || []).forEach((recipe) => {
    const level = normalizeLevel(levels[recipe.id] ?? 0);
    const { finalEnergy, hoursRequired, energyPerHour } = computeRecipeEnergyStats(recipe, {
      level,
      fieldBonusPercent,
      eventBonusMultiplier,
      usePokemonCount: false,
    });
    const hoursDisplay = formatHours(hoursRequired);
    const energyPerHourDisplay = formatEnergyPerHour(energyPerHour);
    const pods = Object.entries(recipe.needs || {}).map(([id, qty]) => `
      <div class="need-pod">
        <div class="em">${em(id)}</div>
        <div class="num">×${qty}</div>
      </div>
    `).join("");
    rows.push({
      category: CATEGORY_LABELS[filterKey] || filterKey || "-",
      recipe,
      level,
      finalEnergy,
      hoursRequired,
      energyPerHour,
      pods,
      hoursDisplay,
      energyPerHourDisplay,
    });
  });

  rows.sort((a, b) => b.finalEnergy - a.finalEnergy || a.recipe.title.localeCompare(b.recipe.title, "ja"));

  const tbody = rows.length
    ? rows.map((row) => `
        <tr>
          <td class="energy-title-cell">
            <div class="energy-title">${row.recipe.title}</div>
            ${row.pods ? `<div class="need-pods">${row.pods}</div>` : ""}
          </td>
          <td>
            <input
              type="number"
              min="0"
              max="65"
              step="1"
              class="energy-level-input"
              data-recipe-id="${row.recipe.id}"
              value="${row.level}"
            >
          </td>
          <td class="num">${formatNumber(row.finalEnergy)}</td>
          <td class="num">${row.hoursDisplay}</td>
          <td class="num">${row.energyPerHourDisplay}</td>
        </tr>
      `).join("")
    : `<tr><td class="muted center" colspan="5">（データなし）</td></tr>`;

  table.innerHTML = `
    <thead>
      <tr>
        <th>料理名</th>
        <th>レシピLv</th>
        <th class="num">最終エナジー</th>
        <th class="num">必要時間 (h)</th>
        <th class="num">エナジー/時</th>
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
  `;
}

function renderGatherTable() {
  const table = els.gatherTable || document.getElementById("gatherTable");
  if (!table || !state?.data?.ingredients) return;

  const pokemonInput = els.gatherPokemonCount || document.getElementById("gatherPokemonCount");
  if (pokemonInput && document.activeElement !== pokemonInput) {
    pokemonInput.value = String(state.gatherPokemonCount);
  }

  const headerLabels = ["食材ポケ", "きのポケ", "他常駐"];
  const rows = (state.data.ingredients || []).map((ing) => {
    const rates = getGatherRates(ing.id);
    const inputs = rates.map((val, idx) => `
      <td class="num">
        <input
          type="number"
          min="0"
          step="0.1"
          class="gather-input"
          data-ing-id="${ing.id}"
          data-index="${idx}"
          value="${val}"
        >
      </td>
    `).join("");
    return `
      <tr>
        <td class="cell-ing">
          <span class="em">${ing.emoji || ""}</span>
          <span class="name">${ing.name || ing.id}</span>
        </td>
        ${inputs}
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <thead>
      <tr>
        <th>食材名</th>
        ${headerLabels.map((label) => `<th class="num">${label}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderStockGatherTable() {
  const table = els.stockGatherTable || document.getElementById("stockGatherTable");
  if (!table || !state?.data?.ingredients) return;

  const headerLabels = ["食材ポケ", "きのポケ", "他常駐"];
  const rows = (state.data.ingredients || []).map((ing) => {
    const rates = getStockGatherRates(ing.id);
    const inputs = rates.map((val, idx) => `
      <td class="num">
        <input
          type="number"
          min="0"
          step="0.1"
          class="stock-gather-input"
          data-ing-id="${ing.id}"
          data-index="${idx}"
          value="${val}"
        >
      </td>
    `).join("");
    return `
      <tr>
        <td class="cell-ing">
          <span class="em">${ing.emoji || ""}</span>
          <span class="name">${ing.name || ing.id}</span>
        </td>
        ${inputs}
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <thead>
      <tr>
        <th>食材名</th>
        ${headerLabels.map((label) => `<th class="num">${label}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function computeBestRecipeCombos(
  stats,
  {
    maxMeals = 3,
    maxHours = 24,
    maxResults = 3,
    allowRepeats = true,
    pokemonCount = state.gatherPokemonCount,
    excludeMaxLevel = false,
    maxLevel = 65,
    potCapacity = null,
  } = {},
) {
  const valid = stats.filter(
    (s) =>
      Number.isFinite(s.hoursRequired) &&
      s.hoursRequired > 0 &&
      Number.isFinite(s.finalEnergy) &&
      s.finalEnergy > 0,
  );
  const normCount = Math.max(1, normalizePokemonCount(pokemonCount));
  const combosMap = new Map();
  const n = valid.length;

  const addIfValid = (indexes) => {
    if (!indexes.length || indexes.length > maxMeals) return;
    const key = indexes
      .slice()
      .sort((a, b) => a - b)
      .join("-");
    if (!allowRepeats && combosMap.has(key)) return;

    const recipes = indexes.map((idx) => valid[idx]);
    let totalHours = 0;
    let totalEnergy = 0;
    for (const stat of recipes) {
      totalHours += stat.hoursRequired;
      totalEnergy += stat.finalEnergy;
    }

    if (!Number.isFinite(totalHours) || totalHours <= 0) return;
    if (totalHours / normCount > maxHours) return;

    const efficiency = totalEnergy / totalHours;
    if (!combosMap.has(key) || combosMap.get(key).totalEnergy < totalEnergy) {
      combosMap.set(key, {
        recipes,
        totalHours,
        totalEnergy,
        efficiency,
      });
    }
  };

  // 探索
  for (let i = 0; i < n; i++) {
    addIfValid([i]);
    for (let j = 0; j < n; j++) {
      addIfValid([i, j]);
      for (let k = 0; k < n; k++) {
        addIfValid([i, j, k]);
      }
    }
  }

  const sorted = Array.from(combosMap.values()).sort((a, b) =>
    b.totalEnergy - a.totalEnergy ||
    b.efficiency - a.efficiency ||
    a.recipes.length - b.recipes.length
  ).slice(0, maxResults);

  return sorted.map((combo) => {
    const entries = combo.recipes.map((stat) => ({
      recipe: stat.recipe,
      recipeId: stat.id ?? stat.recipe?.id,
      title: stat.title,
      hoursRequired: stat.hoursRequired,
      finalEnergy: stat.finalEnergy,
    }));
    const slotCount = (Number.isFinite(combo.totalHours) && combo.totalHours > 0)
      ? combo.totalHours / 24
      : null;
    const energyPerSlot = slotCount && slotCount > 0
      ? combo.totalEnergy / slotCount
      : null;
    return {
      ...combo,
      recipes: entries,
      slotCount,
      energyPerSlot,
    };
  });
}

function totalNeeds(recipe) {
  let total = 0;
  for (const n of Object.values(recipe.needs || {})) total += Number(n) || 0;
  return total;
}
function shortageSum(recipe, invMap) {
  let lack = 0;
  for (const [id, need] of Object.entries(recipe.needs || {})) {
    const have = invMap.get(id) || 0;
    if (have < need) lack += (need - have);
  }
  return lack;
}

function renderProposalResults(combos) {
  const container = document.getElementById("proposalResults");
  if (!container) return;
  lastProposalCombos = Array.isArray(combos) ? combos : [];
  if (!lastProposalCombos.length) {
    container.innerHTML = `<p class="muted">条件を満たす料理の組み合わせが見つかりませんでした。</p>`;
    updateProposalAppliedHighlight(null);
    return;
  }

  container.innerHTML = lastProposalCombos.map((combo, idx) => {
    const entries = combo.recipes || [];
    const totalHours = formatHours(combo.totalHours);
    const totalEnergy = formatNumber(combo.totalEnergy);
    const slotCount = formatSlotCount(combo.slotCount);
    const energyPerSlot = formatEnergyPerSlot(combo.energyPerSlot);
    const rows = entries.map((r, mealIdx) => `
      <tr>
        <td class="num">${mealIdx + 1}</td>
        <td class="proposal-recipe-cell">${r.title}</td>
        <td class="num">${formatHours(r.hoursRequired)}</td>
        <td class="num">${formatNumber(r.finalEnergy)}</td>
      </tr>
    `).join("");
    return `
      <div class="proposal-card" data-proposal-index="${idx}">
        <div class="proposal-header">
          <span class="proposal-rank">提案 ${idx + 1}</span>
          <button
            type="button"
            class="btn btn-primary proposal-apply-btn"
            data-index="${idx}"
            aria-label="提案 ${idx + 1} を今週の料理に反映"
          >
            今週の料理に反映
          </button>
        </div>
        <table class="table proposal-table">
          <thead>
            <tr>
              <th class="num">順番</th>
              <th class="left">料理名</th>
              <th class="num">所要時間 (h)</th>
              <th class="num">エナジー</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <th colspan="2">合計</th>
              <th class="num">${totalHours}</th>
              <th class="num">${totalEnergy}</th>
            </tr>
          </tfoot>
        </table>
        <div class="proposal-summary">
          <span>稼働枠数 (合計時間 ÷ 24h): ${slotCount}</span>
          <span>1枠あたりエナジー: ${energyPerSlot}</span>
        </div>
      </div>
    `;
  }).join("");
  updateProposalAppliedHighlight(null);
}

function updateProposalAppliedHighlight(activeIndex = null) {
  const container = document.getElementById("proposalResults");
  if (!container) return;
  container.querySelectorAll(".proposal-card").forEach((card) => {
    const idx = Number(card.dataset.proposalIndex);
    card.classList.toggle("is-applied", activeIndex !== null && idx === activeIndex);
  });
}

function convertProposalRecipesToChosen(recipes) {
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

function applyProposalCombo(index) {
  if (index === null || index === undefined) return;
  const numericIndex = Number(index);
  if (!Number.isInteger(numericIndex) || numericIndex < 0) return;
  const combo = lastProposalCombos?.[numericIndex];
  if (!combo || !Array.isArray(combo.recipes) || !combo.recipes.length) return;
  const nextChosen = convertProposalRecipesToChosen(combo.recipes);
  if (!nextChosen.length) return;
  state.chosen = nextChosen;
  save();
  renderMenuList();
  rerenderTablesAndSuggestions();
  renderEnergyTable(els.cat?.value || null);
  if (typeof switchTab === "function") {
    switchTab("this");
  }
  updateProposalAppliedHighlight(numericIndex);
}

function renderSuggestionsTable() {
  const table = document.getElementById("recommendTable");
  if (!table) return;

  const cat = els.cat.value;
  const inv = buildInventoryMap();
  const chosenSet = buildChosenRecipeSet(state.chosen);
  const candidates = (state.data.recipes[cat] || []).filter(r => !chosenSet.has(r.id));

  // 今週＝選択済みレシピの needs を合算 (キー集合だけ欲しい)
  const thisWeekIds = collectThisWeekIngredientIds(state.chosen, findRecipeById);
  // 次週＝computeNextWeekTotals のキー
  const nextTotalsMap = computeNextWeekTotals(
    state.next,
    state.data.recipes || {},
    state.data.ingredients || [],
    state.nextVersion,
  );
  const nextWeekIds = new Set(nextTotalsMap.keys());

  const rows = [];
  for (const r of candidates) {
    const deficit = shortageSum(r, inv);
    if (deficit === 0 || deficit <= 10) { // 作れる / あと少し（10以下）

      // ★ 食材チップに色クラスを付与
      const pods = Object.entries(r.needs || {}).map(([id, need]) => {
        const have = inv.get(id) || 0;
        const lack = Math.max(0, need - have);

        // どちらに使われているか
        let useCls = "";
        const inThis = thisWeekIds.has(id);
        const inNext = nextWeekIds.has(id);
        if (inThis && inNext) useCls = "is-both";
        else if (inThis)     useCls = "is-this";
        else if (inNext)     useCls = "is-next";

        return `<div class="need-pod ${useCls}">
                  <div class="em">${em(id)}</div>
                  <div class="num">×${need}</div>
                  ${lack > 0 ? `<div class="lack">-${lack}</div>` : ""}
                </div>`;
      }).join("");

      rows.push({
        deficit,
        total: totalNeeds(r),
        title: r.title,
        html: `<tr>
          <td class="title-cell">
            <div class="sugg-title">${r.title}</div>
            <div class="need-pods">${pods}</div>
          </td>
          <td class="num">${deficit}</td>
          <td class="status-col">${deficit===0
            ? '<span class="status-ok">作れる</span>'
            : '<span class="status-near">あと少し</span>'}</td>
        </tr>`
      });
    }
  }

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;     // 必要食材合計が多い順
    if (a.deficit !== b.deficit) return a.deficit - b.deficit; // 次点で不足少ない順
    return a.title.localeCompare(b.title, "ja");
  });

  table.innerHTML = `
    <thead>
      <tr><th class="left">料理名</th><th class="num">不足(合計)</th><th class="right">状態</th></tr>
    </thead>
    <tbody>
      ${rows.length ? rows.map(r => r.html).join("") : `<tr><td class="muted" colspan="3">該当なし</td></tr>`}
    </tbody>
  `;
}

function resolveStockPlanEntry(islandType, eventType) {
  if (!state.nextWeekPlan || typeof state.nextWeekPlan !== "object") return null;
  const entries = Object.entries(state.nextWeekPlan);
  for (const [key, entry] of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.island === islandType && entry.event === eventType) {
      return { key, ...entry };
    }
  }
  return null;
}

function stockPlanSubtractsBoosted(islandType, eventType) {
  if (eventType === "pokemon") return true;
  if (eventType === "cooking") return islandType === "normal";
  return islandType === "normal";
}

function findHighestEnergyStatForCategory(categoryKey, options = {}) {
  const stats = getAllRecipeEnergyStats({
    categoryFilter: categoryKey,
    excludeMaxLevel: options.excludeMaxLevel ?? state.stockPlan.excludeMaxLevel,
  });
  if (!stats?.length) return null;
  let best = null;
  for (const stat of stats) {
    if (!stat?.recipe) continue;
    if (!best || (stat.finalEnergy || 0) > (best.finalEnergy || 0)) {
      best = stat;
    }
  }
  return best;
}

function intersectIngredientIds(recipes) {
  const list = recipes.filter(Boolean);
  if (!list.length) return [];
  const first = list[0];
  const baseSet = new Set(Object.keys(first?.needs || {}));
  for (let i = 1; i < list.length; i += 1) {
    const recipe = list[i];
    const nextSet = new Set(Object.keys(recipe?.needs || {}));
    for (const id of Array.from(baseSet)) {
      if (!nextSet.has(id)) {
        baseSet.delete(id);
      }
    }
    if (!baseSet.size) break;
  }
  return Array.from(baseSet);
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

function totalsToQtyMap(rawMap) {
  const out = new Map();
  if (!rawMap) return out;
  rawMap.forEach((value, key) => {
    const qty = value && typeof value === "object" && "qty" in value ? value.qty : value;
    const numeric = Number(qty) || 0;
    if (numeric > 0) {
      out.set(key, numeric);
    }
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

function computeNextWeekStockPlan({
  bagCapacity,
  islandType,
  eventType,
  cookingCategory,
}) {
  if (!state?.data?.ingredients || !state?.data?.recipes) {
    return { error: "データを読み込み中です。しばらくお待ちください。" };
  }
  const capacity = Math.max(1, Number(bagCapacity) || 0);
  const categoriesRaw = eventType === "cooking" ? [cookingCategory] : ALL_RECIPE_CATEGORIES;
  const categories = categoriesRaw.filter((cat, idx, arr) => arr.indexOf(cat) === idx);

  const categoryStats = categories.map((cat) => {
    const stat = findHighestEnergyStatForCategory(cat, {
      excludeMaxLevel: state.stockPlan.excludeMaxLevel,
    });
    return stat?.recipe ? { categoryKey: cat, stat } : null;
  }).filter(Boolean);

  if (!categoryStats.length) {
    return { error: "対象カテゴリの最高エナジー料理が見つかりませんでした。" };
  }

  categoryStats.sort((a, b) => (b.stat.finalEnergy || 0) - (a.stat.finalEnergy || 0));

  const basePlan = { CURRY: [], SALAD: [], SWEETS: [], extra: [] };
  categoryStats.forEach(({ categoryKey, stat }) => {
    const key = CATEGORY_TO_NEXT_KEY[categoryKey];
    if (!key || !stat?.recipe?.id) return;
    basePlan[key] = [{ recipe: stat.recipe.id, qty: 1 }];
  });

  const perSetTotalsRaw = computeNextWeekTotals(
    basePlan,
    state.data.recipes || {},
    state.data.ingredients || [],
  );
  const perSetTotals = totalsToQtyMap(perSetTotalsRaw);
  const baseMeals = 3;
  const baseTotals = scaleQtyMap(perSetTotals, baseMeals);
  const baseCount = sumQtyMap(baseTotals);

  const subtractBoosted = stockPlanSubtractsBoosted(islandType, eventType);
  const boostedSet = subtractBoosted ? getStockBoostedIngredients() : new Set();

  const topChoice = categoryStats[0] || null;
  const topStat = topChoice?.stat || null;
  const topCategoryKey = topChoice?.categoryKey || null;
  const categoryPlans = categoryStats.map(({ categoryKey, stat }) => ({
    categoryKey,
    recipeId: stat?.recipe?.id || null,
    recipeTitle: stat?.recipe?.title || "",
    stat,
  }));
  const extraPerSet = new Map();
  perSetTotals.forEach((qty, ingId) => {
    const value = Number(qty) || 0;
    if (value <= 0) return;
    if (subtractBoosted && boostedSet.has(ingId)) return;
    extraPerSet.set(ingId, value);
  });
  const effectivePerSetSum = sumQtyMap(extraPerSet);

  const extraCapacity = Math.max(0, capacity - baseCount);
  const extraMeals = effectivePerSetSum > 0 ? Math.max(0, Math.floor(extraCapacity / effectivePerSetSum)) : 0;

  const extraTotals = scaleQtyMap(extraPerSet, extraMeals);

  let finalTotals = addQtyMap(baseTotals, extraTotals);
  let totalCount = sumQtyMap(finalTotals);
  let leftover = Math.max(0, capacity - totalCount);
  const bonusTotals = new Map();
  let sharedSetMultiplier = 0;
  let sharedSetIngredients = [];
  if (state.stockPlan.distributeLeftover !== false && leftover > 0) {
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
        if (qty > 0) {
          sharedTotals.set(ingId, qty);
        }
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

  const warning = baseCount > capacity
    ? "バッグ容量が3食分を下回っています。容量を見直すか、入力値を調整してください。"
    : null;

  const planEntry = resolveStockPlanEntry(islandType, eventType);

  return {
    success: true,
    capacity,
    baseCount,
    totalCount,
    extraMeals,
    subtractBoosted,
    boostedSet,
    baselineStats: categoryStats.map((choice) => choice.stat),
    topStat,
    baseTotals,
    extraTotals,
    bonusTotals,
    finalTotals,
    warning,
    planEntry,
    sharedSetMultiplier,
    sharedSetIngredients,
    categoryPlans,
    baseMeals,
    extraMeals,
    topCategoryKey,
    remainingCapacity: leftover,
    params: {
      islandType,
      eventType,
      cookingCategory,
    },
  };
}

function formatStockPlanTotalsRow({ ingredient, baseQty, extraQty, bonusQty, totalQty }) {
  return `
    <tr>
      <td class="cell-ing">
        <span class="em">${ingredient.emoji || ""}</span>
        <span class="name">${ingredient.name || ingredient.id}</span>
      </td>
      <td class="num">${baseQty}</td>
      <td class="num">${extraQty}</td>
      <td class="num">${bonusQty}</td>
      <td class="num">${totalQty}</td>
    </tr>
  `;
}

function renderStockPlanResults(result) {
  if (result !== undefined) {
    lastStockPlanResult = result;
  }
  const table = document.getElementById("stockPlanTable");
  const nEl = document.getElementById("stockMealsN");
  const totalEl = document.getElementById("stockTotalCount");
  const noteEl = document.getElementById("stockPlanNotes");
  if (!table) return;

  const current = lastStockPlanResult;
  if (!current || current.error) {
    table.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">3食分</th><th class="num">追加分</th><th class="num">余剰充当</th><th class="num">合計</th></tr>
      </thead>
      <tbody><tr><td class="muted" colspan="5">${current?.error || "条件を設定し、「備蓄プランを計算」を押してください。"}</td></tr></tbody>
    `;
    if (nEl) nEl.textContent = "-";
    if (totalEl) totalEl.textContent = "-";
    if (noteEl) noteEl.textContent = current?.planEntry?.plan || "";
    return;
  }

  const baseTotals = current.baseTotals || new Map();
  const extraTotals = current.extraTotals || new Map();
  const bonusTotals = current.bonusTotals || new Map();
  const finalTotals = current.finalTotals || new Map();

  const rows = [];
  const ingredientMap = new Map((state.data?.ingredients || []).map((ing) => [ing.id, ing]));
  const allIds = new Set([
    ...Array.from(baseTotals.keys()),
    ...Array.from(extraTotals.keys()),
    ...Array.from(bonusTotals.keys()),
    ...Array.from(finalTotals.keys()),
  ]);
  allIds.forEach((ingId) => {
    const meta = ingredientMap.get(ingId) || { id: ingId, name: ingId, emoji: "" };
    const totalQty = Number(finalTotals.get(ingId) || 0);
    const baseQty = Number(baseTotals.get(ingId) || 0);
    const extraQty = Number(extraTotals.get(ingId) || 0);
    const bonusQty = Number(bonusTotals.get(ingId) || 0);
    if (totalQty <= 0 && baseQty <= 0 && extraQty <= 0 && bonusQty <= 0) return;
    rows.push(formatStockPlanTotalsRow({
      ingredient: meta,
      baseQty,
      extraQty,
      bonusQty,
      totalQty,
    }));
  });

  table.innerHTML = `
    <thead>
      <tr><th>食材名</th><th class="num">3食分</th><th class="num">追加分</th><th class="num">余剰充当</th><th class="num">合計</th></tr>
    </thead>
    <tbody>${rows.length ? rows.join("") : `<tr><td class="muted" colspan="5">（備蓄対象なし）</td></tr>`}</tbody>
  `;

  if (nEl) nEl.textContent = String(current.extraMeals || 0);
  if (totalEl) totalEl.textContent = String(current.totalCount || current.baseCount || 0);

  if (noteEl) {
    const notes = [];
    if (current.planEntry?.plan) {
      notes.push(`方針: ${current.planEntry.plan}`);
    }
    if (current.warning) {
      notes.push(current.warning);
    }
    if (current.baselineStats?.length) {
      const titles = current.baselineStats.map((s) => s.recipe?.title).filter(Boolean);
      if (titles.length) {
        notes.push(`3食分: ${titles.join("、")}`);
      }
    }
    if (current.topStat?.recipe?.title) {
      notes.push(`追加分は ${current.topStat.recipe.title} を基準に計算しました。`);
    }
    if (state.stockPlan.excludeMaxLevel) {
      notes.push("レシピレベルMaxの料理は除外しています。");
    }
    if (current.sharedSetMultiplier > 0) {
      const names = (current.sharedSetIngredients || []).map((id) => {
        const meta = ingredientMap.get(id);
        const label = meta ? `${meta.emoji || ""} ${meta.name || meta.id}`.trim() : id;
        return label || id;
      });
      notes.push(`共通食材セット × ${current.sharedSetMultiplier}: ${names.join("、")}`);
    } else if (state.stockPlan.distributeLeftover !== false) {
      if (!current.sharedSetIngredients || current.sharedSetIngredients.length === 0) {
        notes.push("共通食材が存在しないため余剰充当は行っていません。");
      } else if ((current.remainingCapacity || 0) > 0) {
        notes.push("余剰容量はありますが、共通食材セットを追加するには不足していました。");
      }
    }
    if (state.stockPlan.distributeLeftover === false) {
      notes.push("余剰充当: 無効 (バッグ容量に空きが出る場合があります)");
    }
    noteEl.textContent = notes.join("\n");
  }
}

function clearStockPlanResults(message = "条件が変更されました。再計算してください。") {
  lastStockPlanResult = { error: message };
  renderStockPlanResults();
}

function applyStockPlanToNext() {
  const result = lastStockPlanResult;
  if (!result || !result.success) {
    alert("先に備蓄プランを計算してください。");
    return;
  }
  const plans = result.categoryPlans || [];
  if (!plans.length) {
    alert("反映できる料理プランが見つかりませんでした。");
    return;
  }

  const baseMeals = Number(result.baseMeals || 0);
  if (!baseMeals) {
    alert("反映に必要な基準食数が得られませんでした。");
    return;
  }

  const nextState = {
    CURRY: [],
    SALAD: [],
    SWEETS: [],
    extra: [],
  };

  const topCategoryKey = result.topCategoryKey || null;
  const extraMeals = Number(result.extraMeals || 0);

  plans.forEach((plan) => {
    const key = CATEGORY_TO_NEXT_KEY[plan.categoryKey];
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

  state.next = nextState;
  markNextDirty();
  save();
  renderNextChosen();
  rerenderTablesAndSuggestions();
  if (typeof switchTab === "function") {
    switchTab("next");
  }
  alert("備蓄計算結果を次週計画へ反映しました。");
}


// 共有カード描画（THIS/NEXT 共通）
// ※ 順序ミスを防ぐためオブジェクト引数に変更
function renderMenuCardsShared({ ctx, items, mountEl, catKey = null }) {
  if (!mountEl) return;
  mountEl.innerHTML = (items || []).map(it => {
    const r = findRecipeById(it.recipe);
    const needs = (ctx === "EXTRA")
      ? "" // 個別食材はチップ非表示
      : Object.entries(r?.needs || {})
          .map(([id, n]) => `
            <div class="need-pill">
              <span class="em">${em(id)}</span>
              <span class="num">×${n}</span>
            </div>
          `).join("");

    return `
      <div class="menu-card"
           data-ctx="${ctx}" data-cat="${catKey || ""}" data-id="${it.recipe}">
        <!-- ▲ 同一行：タイトル（左）＋ 操作ボタン（右） -->
        <div class="header-line">
          <div class="title">${r?.title ?? ""}</div>
          <div class="qty-ops">
            <button class="op-btn op-minus btn btn-primary">−</button>
            <input class="qty-input" type="number" min="0" value="${it.qty}">
            <button class="op-btn op-plus  btn btn-primary">＋</button>
            <button class="op-btn op-remove btn btn-ghost">×</button>
          </div>
        </div>
        <!-- ▼ 食材ピルは下段で横並び -->
        <div class="needs">${needs}</div>
      </div>
    `;
  }).join("") || `<div class="empty muted">（なし）</div>`;
}

function renderMenuList() {
  const wrap = document.getElementById('menuList');
  renderMenuCardsShared({
    ctx: 'THIS',
    items: state.chosen,
    mountEl: wrap
  });
}

function renderExtraCards() {
  const wrap = document.getElementById('nwExtraList');
  if (!wrap) return;
  const extras = state.next.extra || [];
  if (!extras.length) {
    wrap.innerHTML = `<div class="empty muted">（なし）</div>`;
    return;
  }

  const ingredients = state.data?.ingredients || [];
  const map = new Map(ingredients.map((ing) => [ing.id, ing]));

  wrap.innerHTML = extras.map((item) => {
    const meta = map.get(item.ingId) || { name: item.ingId, emoji: "" };
    const label = `${meta.emoji || ""} ${meta.name || item.ingId}`.trim();
    return `
      <div class="menu-card" data-ctx="NEXT" data-cat="extra" data-id="${item.ingId}">
        <div class="header-line">
          <div class="title">${label}</div>
          <div class="qty-ops">
            <button class="op-btn op-minus btn btn-primary">−</button>
            <input class="qty-input" type="number" step="1" value="${item.qty}" aria-label="${label} の数量">
            <button class="op-btn op-plus btn btn-primary">＋</button>
            <button class="op-btn op-remove btn btn-ghost">×</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function displayAppVersion() {
  const el = document.getElementById("appVersion");
  if (el) el.textContent = APP_VERSION;
}

/* ==== 今週（THIS）用の増減/削除 ==== */
function findChosen(recipeId) {
  return state.chosen.find(c => c.recipe === recipeId) || null;
}
function incChosen(recipeId) {
  const hit = findChosen(recipeId);
  if (hit) hit.qty += 1;
  else state.chosen.push({ recipe: recipeId, qty: 1 });
  save();
}
function decChosen(recipeId) {
  const hit = findChosen(recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  save();
}
function setChosenQty(recipeId, qty) {
  const hit = findChosen(recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  save();
}
function removeChosen(recipeId) {
  state.chosen = state.chosen.filter(c => c.recipe !== recipeId);
  save();
}

/* ==== 次週（NEXT）用の増減/削除 ==== */
function findNextArray(catKey) {
  return state.next[catKey] || (state.next[catKey] = []);
}
function incNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const hit = arr.find(x => x.recipe === recipeId);
  if (hit) {
    hit.qty += 1;
  } else {
    arr.push({ recipe: recipeId, qty: 1 });
  }
  markNextDirty();
  save();
}
function decNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const hit = arr.find(x => x.recipe === recipeId);
  if (!hit) return;
  const prev = hit.qty || 0;
  const nextQty = Math.max(0, prev - 1);
  if (nextQty === prev) return;
  hit.qty = nextQty;
  markNextDirty();
  save();
}
function setNextRecipeQty(catKey, recipeId, qty) {
  const arr = findNextArray(catKey);
  const hit = arr.find(x => x.recipe === recipeId);
  if (!hit) return;
  const nextQty = Math.max(0, Number(qty) || 0);
  if (hit.qty === nextQty) return;
  hit.qty = nextQty;
  markNextDirty();
  save();
}
function removeNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const filtered = arr.filter(x => x.recipe !== recipeId);
  if (filtered.length === arr.length) return;
  state.next[catKey] = filtered;
  markNextDirty();
  save();
}

// ==== 個別食材（extra） 用の増減/削除 ====
function findExtra(ingId) {
  return (state.next.extra || []).find(e => e.ingId === ingId) || null;
}
function incNextExtra(ingId) {
  if (!state.next.extra) state.next.extra = [];
  const hit = findExtra(ingId);
  if (hit) {
    hit.qty = (Number(hit.qty) || 0) + 1;
  } else {
    state.next.extra.push({ ingId, qty: 1 });
  }
  markNextDirty();
  save();
}
function decNextExtra(ingId) {
  if (!state.next.extra) return;
  const hit = findExtra(ingId);
  if (!hit) return;
  const prev = Number(hit.qty) || 0;
  const nextQty = prev - 1;
  if (nextQty === prev) return;
  if (nextQty === 0) {
    state.next.extra = state.next.extra.filter(e => e.ingId !== ingId);
  } else {
    hit.qty = nextQty;
  }
  markNextDirty();
  save();
}
function setNextExtraQty(ingId, qty) {
  if (!state.next.extra) return;
  const hit = findExtra(ingId);
  if (!hit) return;
  let nextQty = Number(qty);
  if (!Number.isFinite(nextQty)) nextQty = 0;
  if (hit.qty === nextQty) return;
  if (nextQty === 0) {
    state.next.extra = state.next.extra.filter(e => e.ingId !== ingId);
  } else {
    hit.qty = nextQty;
  }
  markNextDirty();
  save();
}
function removeNextExtra(ingId) {
  if (!state.next.extra) return;
  const filtered = state.next.extra.filter(e => e.ingId !== ingId);
  if (filtered.length === state.next.extra.length) return;
  state.next.extra = filtered;
  markNextDirty();
  save();
}

function findRecipeById(id) {
  const groups = state?.data?.recipes || {};
  for (const list of Object.values(groups)) {
    const hit = (list || []).find(r => r.id === id);
    if (hit) return hit;
  }
  return null;
}

function setupCollapsers(){
  document.querySelectorAll('.collapse-toggle').forEach(btn=>{
    const targetSel = btn.getAttribute('data-target');
    const panel = document.querySelector(targetSel);
    if(!panel) return;
    btn.addEventListener('click', ()=>{
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function setupEnergyControls() {
  const table = els.energyTable || document.getElementById("energyTable");

  if (table) {
    table.addEventListener("change", (e) => {
      const input = e.target.closest(".energy-level-input");
      if (!input) return;
      const recipeId = input.dataset.recipeId;
      const normalized = normalizeLevel(input.value);
      input.value = String(normalized);
      setRecipeLevel(recipeId, normalized);
    });
  }

  const exportBtn = document.getElementById("exportRecipeLevelsBtn");
  const importBtn = document.getElementById("importRecipeLevelsBtn");
  const textArea = document.getElementById("recipeLevelsText");
  if (exportBtn && textArea) {
    exportBtn.addEventListener("click", () => {
      const text = serializeRecipeLevels();
      textArea.value = text;
      textArea.focus();
      textArea.select();
      writeToClipboard(text);
    });
  }
  if (importBtn && textArea) {
    importBtn.addEventListener("click", () => {
      const raw = textArea.value.trim();
      if (!raw) {
        alert("インポートするデータを入力してください。\nエクスポートボタンで取得したJSONを貼り付けます。");
        return;
      }
      try {
        const data = JSON.parse(raw);
        applyRecipeLevelsData(data);
        renderEnergyTable();
        alert("レシピレベルをインポートしました。");
      } catch (err) {
        console.error("Import recipe levels failed", err);
        alert(`インポートに失敗しました: ${err.message || err}`);
      }
    });
  }
}

function syncSuggestControls() {
  if (els.suggestEvent && document.activeElement !== els.suggestEvent) {
    const value = (state.suggestConfig.eventType === "halloween" || state.suggestConfig.eventType === "custom")
      ? state.suggestConfig.eventType
      : "none";
    els.suggestEvent.value = value;
  }
  if (els.suggestEventCustom && document.activeElement !== els.suggestEventCustom) {
    els.suggestEventCustom.value = state.suggestConfig.eventType === "custom"
      ? (state.suggestConfig.eventCustom || "")
      : "";
  }
  if (els.suggestEc && document.activeElement !== els.suggestEc) {
    els.suggestEc.value = state.suggestConfig.ec === "available" ? "available" : "none";
  }
  if (els.suggestIsland && document.activeElement !== els.suggestIsland) {
    els.suggestIsland.value = state.suggestConfig.island === "normal" ? "normal" : "wakakusa_ex";
  }
  if (els.suggestFieldBonus && document.activeElement !== els.suggestFieldBonus) {
    els.suggestFieldBonus.value = String(state.suggestConfig.fieldBonusPercent ?? 0);
  }
  if (els.suggestEventBonus && document.activeElement !== els.suggestEventBonus) {
    els.suggestEventBonus.value = String(state.suggestConfig.eventBonusMultiplier ?? 1);
  }
  if (els.suggestBonusSelect && document.activeElement !== els.suggestBonusSelect) {
    els.suggestBonusSelect.value = state.suggestConfig.bonusPreset || "preset_berries";
  }
  toggleSuggestCustomInputs();
}

function toggleSuggestCustomInputs() {
  if (els.suggestEventCustom) {
    const visible = els.suggestEvent?.value === "custom";
    els.suggestEventCustom.classList.toggle("is-visible", visible);
    els.suggestEventCustom.disabled = !visible;
  }
}

function setupGatherTable() {
  const table = els.gatherTable || document.getElementById("gatherTable");
  syncSuggestControls();
  if (table && !table.dataset.bound) {
    table.addEventListener("change", (e) => {
      const input = e.target.closest(".gather-input");
      if (!input) return;
      const ingId = input.dataset.ingId;
      const idx = input.dataset.index;
      const normalized = normalizeGatherValue(input.value);
      input.value = String(normalized);
      setGatherRate(ingId, idx, normalized);
    });
    table.dataset.bound = "1";
  }

  const pokemonInput = els.gatherPokemonCount || document.getElementById("gatherPokemonCount");
  if (pokemonInput && !pokemonInput.dataset.bound) {
    pokemonInput.value = String(state.gatherPokemonCount);
    pokemonInput.addEventListener("change", () => {
      setGatherPokemonCount(pokemonInput.value);
    });
    pokemonInput.dataset.bound = "1";
  }

  if (els.suggestEvent && !els.suggestEvent.dataset.bound) {
    els.suggestEvent.addEventListener("change", () => {
      setSuggestEventType(els.suggestEvent.value);
    });
    els.suggestEvent.dataset.bound = "1";
  }
  if (els.suggestEventCustom && !els.suggestEventCustom.dataset.bound) {
    els.suggestEventCustom.addEventListener("input", () => {
      state.suggestConfig.eventCustom = els.suggestEventCustom.value;
      setSuggestEventType("custom");
    });
    els.suggestEventCustom.dataset.bound = "1";
  }
  if (els.suggestEc && !els.suggestEc.dataset.bound) {
    els.suggestEc.addEventListener("change", () => {
      setSuggestEc(els.suggestEc.value);
    });
    els.suggestEc.dataset.bound = "1";
  }
  if (els.suggestIsland && !els.suggestIsland.dataset.bound) {
    els.suggestIsland.addEventListener("change", () => {
      setSuggestIsland(els.suggestIsland.value);
    });
    els.suggestIsland.dataset.bound = "1";
  }
  if (els.suggestFieldBonus && !els.suggestFieldBonus.dataset.bound) {
    els.suggestFieldBonus.addEventListener("change", () => {
      setFieldBonusPercent(els.suggestFieldBonus.value);
    });
    els.suggestFieldBonus.dataset.bound = "1";
  }
  if (els.suggestEventBonus && !els.suggestEventBonus.dataset.bound) {
    els.suggestEventBonus.addEventListener("change", () => {
      setEventBonusMultiplier(els.suggestEventBonus.value);
    });
    els.suggestEventBonus.dataset.bound = "1";
  }
  if (els.suggestBonusSelect && !els.suggestBonusSelect.dataset.bound) {
    els.suggestBonusSelect.addEventListener("change", () => {
      setSuggestBonusPreset(els.suggestBonusSelect.value);
    });
    els.suggestBonusSelect.dataset.bound = "1";
  }
  toggleSuggestCustomInputs();

  const memoInput = document.getElementById("gatherMemoText");
  if (memoInput && !memoInput.dataset.bound) {
    memoInput.value = state.gatherMemo || "";
    memoInput.addEventListener("input", () => {
      state.gatherMemo = memoInput.value || "";
      save();
    });
    memoInput.dataset.bound = "1";
  }

  const potInput = els.potCapacity || document.getElementById("potCapacityInput");
  if (potInput && !potInput.dataset.bound) {
    potInput.value = String(state.potCapacity || 69);
    potInput.addEventListener("change", () => {
      const val = Math.max(1, Number(potInput.value) || 69);
      state.potCapacity = val;
      save();
      clearProposalResults();
    });
    potInput.dataset.bound = "1";
  }

  const excludeMaxLevelInput = els.excludeMaxLevel || document.getElementById("excludeMaxLevelCheckbox");
  if (excludeMaxLevelInput && !excludeMaxLevelInput.dataset.bound) {
    excludeMaxLevelInput.checked = !!state.excludeMaxLevel;
    excludeMaxLevelInput.addEventListener("change", () => {
      state.excludeMaxLevel = !!excludeMaxLevelInput.checked;
      save();
      clearProposalResults();
    });
    excludeMaxLevelInput.dataset.bound = "1";
  }

  const excludeOverPotInput = els.excludeOverPot || document.getElementById("excludeOverPotCheckbox");
  if (excludeOverPotInput && !excludeOverPotInput.dataset.bound) {
    excludeOverPotInput.checked = !!state.excludeOverPot;
    excludeOverPotInput.addEventListener("change", () => {
      state.excludeOverPot = !!excludeOverPotInput.checked;
      save();
      clearProposalResults();
    });
    excludeOverPotInput.dataset.bound = "1";
  }

  const calcBtn = document.getElementById("calcRecipeProposalsBtn");
  if (calcBtn && !calcBtn.dataset.bound) {
    calcBtn.addEventListener("click", () => {
      clearProposalResults();
      const stats = getAllRecipeEnergyStats({
        categoryFilter: els.cat?.value || null,
        usePokemonCount: true,
        pokemonCount: state.gatherPokemonCount,
        potCapacity: state.excludeOverPot ? state.potCapacity : null,
        excludeMaxLevel: state.excludeMaxLevel,
      });
      const combos = computeBestRecipeCombos(stats, {
        pokemonCount: state.gatherPokemonCount,
        maxHours: 24,
        maxMeals: 3,
        maxResults: 3,
        potCapacity: state.excludeOverPot ? state.potCapacity : null,
        excludeMaxLevel: state.excludeMaxLevel,
      });
      renderProposalResults(combos);
    });
    calcBtn.dataset.bound = "1";
  }
}
function setupStockPlanControls() {
  const table = els.stockGatherTable || document.getElementById("stockGatherTable");
  if (table && !table.dataset.bound) {
    table.addEventListener("change", (e) => {
      const input = e.target.closest(".stock-gather-input");
      if (!input) return;
      const ingId = input.dataset.ingId;
      const idx = input.dataset.index;
      setStockGatherRate(ingId, idx, input.value);
      clearStockPlanResults();
    });
    table.dataset.bound = "1";
  }

  if (els.stockBagCapacity) {
    els.stockBagCapacity.addEventListener("change", () => setStockBagCapacity(els.stockBagCapacity.value));
  }
  if (els.stockIsland) {
    els.stockIsland.addEventListener("change", () => setStockIslandType(els.stockIsland.value));
  }
  if (els.stockEvent) {
    els.stockEvent.addEventListener("change", () => setStockEventType(els.stockEvent.value));
  }
  if (els.stockCooking) {
    els.stockCooking.addEventListener("change", () => setStockCookingCategory(els.stockCooking.value));
  }
  if (els.stockExcludeMax) {
    els.stockExcludeMax.addEventListener("change", () => setStockExcludeMax(els.stockExcludeMax.checked));
  }
  if (els.stockDistribute) {
    els.stockDistribute.addEventListener("change", () => setStockDistribute(els.stockDistribute.checked));
  }

  const exportBtn = document.getElementById("exportStockGatherBtn");
  const importBtn = document.getElementById("importStockGatherBtn");
  const textArea = document.getElementById("stockGatherText");
  if (exportBtn && textArea) {
    exportBtn.addEventListener("click", () => {
      const text = serializeStockGatherConfig();
      textArea.value = text;
      textArea.focus();
      textArea.select();
      writeToClipboard(text);
    });
  }
  if (importBtn && textArea) {
    importBtn.addEventListener("click", () => {
      const raw = textArea.value.trim();
      if (!raw) {
        alert("インポートするデータを入力してください。");
        return;
      }
      try {
        const data = JSON.parse(raw);
        applyStockGatherConfig(data);
        syncStockPlanControls();
        renderStockGatherTable();
        clearStockPlanResults();
        alert("次週用の食材集め能力をインポートしました。");
      } catch (err) {
        console.error("Import stock gather data failed", err);
        alert(`インポートに失敗しました: ${err.message || err}`);
      }
    });
  }

  const calcBtn = document.getElementById("calcStockPlanBtn");
  if (calcBtn && !calcBtn.dataset.bound) {
    calcBtn.addEventListener("click", () => {
      const result = computeNextWeekStockPlan({
        bagCapacity: state.stockPlan.bagCapacity,
        islandType: state.stockPlan.islandType,
        eventType: state.stockPlan.eventType,
        cookingCategory: state.stockPlan.cookingCategory,
      });
      renderStockPlanResults(result);
    });
    calcBtn.dataset.bound = "1";
  }

  if (els.stockApplyBtn && !els.stockApplyBtn.dataset.bound) {
    els.stockApplyBtn.addEventListener("click", () => {
      applyStockPlanToNext();
    });
    els.stockApplyBtn.dataset.bound = "1";
  }

  syncStockPlanControls();
  renderStockGatherTable();
  renderStockPlanResults();
}

/*
// 今週：選んだすべての料理 × それぞれの数量 をそのまま合算
*/


/*
function renderUnifiedIngredients(){
  const inv = buildInventoryMap();         // 現在在庫 Map(id->qty)
  const {map: targetMap, usedThis, usedNext} = buildMergedTargets();

  // used / other の2配列を作る（共通フォーマット）
  const usedRows = [];
  const otherRows = [];
  let sumCurU=0,sumTarU=0, sumCurO=0,sumTarO=0;

  // state.data.ingredients は id昇順などでループ可能と仮定
  (state.data.ingredients || []).forEach(ing=>{
    const id = ing.id;
    const cur = inv.get(id)||0;
    const tar = targetMap.get(id)||0;
    const diff = cur - tar;

    const cls =
      (usedThis.has(id) && usedNext.has(id)) ? 'wk-both' :
      (usedThis.has(id))                     ? 'wk-this' :
      (usedNext.has(id))                     ? 'wk-next' : '';

    const row = {
      cls,
      nameHtml: `${em(id)} ${ing.name}`,   // 左: 絵文字＋名前（既存と同じ）
      cur, tar, diff
    };

    if(tar>0){
      usedRows.push(row);
      sumCurU+=cur; sumTarU+=tar;
    }else{
      otherRows.push(row);
      sumCurO+=cur; sumTarO+=tar; // tar=0 が多い想定
    }
  });

  // 既存の「renderTables( tableId, rows, sums )」に合わせて出力
  renderTables('usedTable', usedRows,  {cur:sumCurU, tar:sumTarU, diff:sumCurU - sumTarU});
  renderTables('otherTable', otherRows,{cur:sumCurO, tar:sumTarO, diff:sumCurO - sumTarO});
}
*/
/* ----------------- boot ----------------- */
document.addEventListener("DOMContentLoaded", () => {
  displayAppVersion();
  loadData().then(() => {
    // boot / after loadData
    setupTabs();
    setupCollapsers();                 // ← 追加（折りたたみ）
    buildNextWeekOptions();   // セレクトに候補を流し込む（既存）
    setupNextWeekSelects({
      onAddRecipe: addNextRecipe,
      renderNextChosen,
      rerenderAll: rerenderTablesAndSuggestions,
      save,
      elements: {
        CURRY: els.nwRecCurry,
        SALAD: els.nwRecSalad,
        SWEETS: els.nwRecSweets,
      },
    });
    setupNextExtraSelect({
      onAddExtra: incNextExtra,
      renderNextChosen,
      rerenderAll: rerenderTablesAndSuggestions,
      save,
      element: els.nwExtraSelect,
    });
    renderNextChosen();       // ← 追加（初期描画）
    // ★ ここで一度だけイベント委譲をセット
    bindMenuCardOpsDelegation({
      rootIds: [
        'menuList',        // 今週のカード置き場
        'nwListCurry',     // 次週：カレー・シチュー
        'nwListSalad',     // 次週：サラダ
        'nwListSweets',    // 次週：デザート・ドリンク
        'nwExtraList'      // （もし個別食材カードを表示するなら）
      ],
      handlers: {
        incChosen,
        decChosen,
        setChosenQty,
        removeChosen,
        incNextRecipe,
        decNextRecipe,
        setNextRecipeQty,
        removeNextRecipe,
        incNextExtra,
        decNextExtra,
        setNextExtraQty,
        removeNextExtra,
      },
      renderers: {
        renderMenuList,
        renderNextChosen,
        renderTables,
        renderSuggestionsTable,
      }
    });
    setupIngredientsFilter({
      stateRef: state,
      renderTables: () => {
        rerenderTablesAndSuggestions();
      },
    });
    setupEnergyControls();
    setupGatherTable();
    setupStockPlanControls();
    refresh();
  }).catch(err => console.error("Init failed:", err));
});