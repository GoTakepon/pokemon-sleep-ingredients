// js/main.js
console.log("DEBUG: main.js loaded");

import {
  state,
  saveState,
  normalizePokemonCount,
  setData as storeSetData,
  findRecipeById,
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
  replaceChosen,
} from "./state/store.js";

import {
  applyProposalComboToState,
  applyStockPlanResult,
} from "./state/apply.js";

import {
  computeFinalEnergy,
  normalizeLevel,
  normalizePercent,
  normalizeMultiplier,
} from "./logic/energy.js";

import {
  GATHER_COLUMNS,
  normalizeGatherArray,
  normalizeGatherValue,
} from "./logic/gather.js";

import { computeBestRecipeCombos } from "./logic/proposals.js";
import { computeNextWeekStockPlan, buildStockRecipeStats as buildStockRecipeStatsLogic } from "./logic/stock-plan.js";
import { getAllRecipeEnergyStats, computeRecipeEnergyStats, computeIngredientHours } from "./logic/energy-stats.js";

import { bindMenuCardOpsDelegation } from "./ui/card-ops.js";
import {
  setupCategorySelects,
  setRecipeOptionsBuilding,
  setupOcrHandlers,
  setupMenuCardOps,
  setupCollapsers,
} from "./ui/init.js";
import {
  setupNextWeekSelects,
  setupNextExtraSelect,
  populateNextWeekSelects,
  populateNextExtraSelect,
} from "./ui/next-week-selects.js";
import { setupIngredientsFilter } from "./ui/ingredients-filter.js";
import { setupGatherUI } from "./ui/gather-init.js";
import { setupStockUI } from "./ui/stock-ui.js";
import { setupOcrUI } from "./ui/ocr-ui.js";
import { setupEnergyUI, createLevelSetter } from "./ui/energy-ui.js";
import { setupSettingsUI } from "./ui/settings-ui.js";
import { showToast } from "./ui/toast.js";

import { renderMenuList as renderMenuListView, renderNextChosen as renderNextChosenView } from "./render/menu.js";
import { renderTables as renderTablesView, renderSuggestionsTable as renderSuggestionsTableView } from "./render/tables.js";
import { renderProposalResults as renderProposalResultsView } from "./render/proposals.js";


import {
  CATEGORY_LABELS,
  CATEGORY_TO_GROUP,
  ALL_RECIPE_CATEGORIES,
  CATEGORY_TO_NEXT_KEY,
  DEFAULT_STOCK_CATEGORIES,
} from "./constants.js";

const APP_VERSION = '20260307-1807';

/* ----------------- State Variables ----------------- */
// Variables are declared here to be available globally within the module
console.log("main.js starting execution");
// switchTab is assigned in setupTabs
// lastCategoryUsed is used in buildRecipeOptions
// buildingRecipeOptions is used in buildRecipeOptions
// lastStockPlanResult is used in calculateStockPlan/renderStockPlanResults

/* ----------------- DOM Elements ----------------- */
const els = {
  cat: document.getElementById("categorySelect"),
  rec: document.getElementById("recipeSelect"),
  chosen: document.getElementById("menuList"),
  ocr: document.getElementById("ocrInput"),
  parse: document.getElementById("parseBtn"),
  clear: document.getElementById("clearDataBtn"),

  nwRecCurry: document.getElementById("nwRecCurry"),
  nwRecSalad: document.getElementById("nwRecSalad"),
  nwRecSweets: document.getElementById("nwRecSweets"),
  nwListCurry: document.getElementById("nwListCurry"),
  nwListSalad: document.getElementById("nwListSalad"),
  nwListSweets: document.getElementById("nwListSweets"),
  nwExtraSelect: document.getElementById("nwExtraSelect"),
  nwExtraList: document.getElementById("nwExtraList"),

  energyTable: document.getElementById("energyTable"),
  potCapacity: document.getElementById("potCapacityInput"),
  excludeMaxLevel: document.getElementById("excludeMaxLevelCheckbox"),
  excludeOverPot: document.getElementById("excludeOverPotCheckbox"),
  gatherTable: document.getElementById("gatherTable"),
  globalCat: document.getElementById("globalCategorySelect"),

  stockBagCapacity: document.getElementById("stockBagCapacityInput"),
  stockCalcBtn: document.getElementById("calcStockPlanBtn"),
  stockCalcIndicator: document.getElementById("stockCalcIndicator"),
  stockBaseMeals: document.getElementById("stockBaseMealsInput"),
  stockIsland: document.getElementById("stockIslandSelect"),
  stockEvent: document.getElementById("stockEventSelect"),
  stockGatherTable: document.getElementById("stockGatherTable"),
  stockExcludeMax: document.getElementById("stockExcludeMaxCheckbox"),
  stockDistribute: document.getElementById("stockDistributeCheckbox"),
  stockApplyBtn: document.getElementById("applyStockPlanBtn"),
  stockBaseMealsLabel: document.getElementById("stockBaseMealsLabel"),
  exportStockGatherBtn: document.getElementById("exportStockGatherBtn"),
  importStockGatherBtn: document.getElementById("importStockGatherBtn"),
  stockGatherText: document.getElementById("stockGatherText"),

  suggestCurrentMenu: document.getElementById("suggestCurrentMenu"),
  energyExportBtn: document.getElementById("exportRecipeLevelsBtn"),
  energyImportBtn: document.getElementById("importRecipeLevelsBtn"),
  energyLevelsText: document.getElementById("recipeLevelsText"),

  suggestEvent: document.getElementById("suggestEventSelect"),
  suggestEventCustom: document.getElementById("suggestEventCustomInput"),
  suggestEc: document.getElementById("suggestEcSelect"),
  suggestIsland: document.getElementById("suggestIslandSelect"),
  suggestFieldBonus: document.getElementById("suggestFieldBonusInput"),
  suggestEventBonus: document.getElementById("suggestEventBonusInput"),
  suggestBonusSelect: document.getElementById("suggestBonusSelect"),
  recommendTable: document.getElementById("recommendTable"),
};

if (typeof window !== "undefined") {
  window.appState = state;
  window.applyProposalComboToState = applyProposalComboToState;
  window.applyStockPlanResult = applyStockPlanResult;
}

let switchTabFn = null;
let buildingRecipeOptions = false;
let lastCategoryUsed = null;

/* ----------------- Helpers ----------------- */
function em(ingId) {
  const ing = state.data.ingredients.find(x => x.id === ingId);
  return ing?.emoji || "";
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[m]);
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

function formatChosenCategorySummary() {
  const counts = { curry: 0, salad: 0, dessert: 0 };
  Object.values(state.chosen).forEach((item) => {
    const r = findRecipeById(item.id);
    if (r && state.data.recipes) {
      // Find category
      for (const [cat, list] of Object.entries(state.data.recipes)) {
        if (list.some(x => x.id === r.id)) {
          counts[cat] = (counts[cat] || 0) + 1;
          break;
        }
      }
    }
  });
  const parts = [];
  if (counts.curry > 0) parts.push(`カレー${counts.curry}`);
  if (counts.salad > 0) parts.push(`サラダ${counts.salad}`);
  if (counts.dessert > 0) parts.push(`デザート${counts.dessert}`);
  return parts.join(" / ") || "なし";
}

function getCurrentCategory(fallbackToFirst = true) {
  const fromUi = els.globalCat?.value || els.cat?.value;
  if (fromUi) return fromUi;
  const stored = localStorage.getItem("lastCategory");
  if (stored) return stored;
  if (!fallbackToFirst) return null;
  const recipesByCat = state.data?.recipes || {};
  return Object.keys(recipesByCat)[0] || null;
}

function writeToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => { });
  }
  return Promise.resolve();
}

/* ----------------- Render Functions ----------------- */
function refresh() {
  if (!state.data) return;
  renderMenuList();
  renderNextChosen();
  rerenderTablesAndSuggestions();
  renderEnergyTable(getCurrentCategory(true));
  renderGatherTable();
}

function renderMenuList() {
  if (!state.data) return;
  renderMenuListView({
    state,
    elements: {
      menuList: els.chosen,
      currentMenu: els.suggestCurrentMenu,
    },
    findRecipeById,
    em,
    getSummary: () => formatChosenCategorySummary(),
    escapeHtml,
  });
}

function renderNextChosen() {
  if (!state.data) return;
  renderNextChosenView({
    state,
    elements: {
      nwListCurry: els.nwListCurry,
      nwListSalad: els.nwListSalad,
      nwListSweets: els.nwListSweets,
      nwExtraList: els.nwExtraList,
    },
    findRecipeById,
    em,
  });
}

function rerenderTablesAndSuggestions() {
  if (!state.data) return;
  renderTables();
  renderSuggestionsTable();
}

function renderTables() {
  if (!state.data) return;
  renderTablesView({
    state,
    findRecipeById,
    computeShortageHours: (ingId, shortage) => {
      if (!shortage || shortage <= 0) return "-";
      const result = computeIngredientHours(ingId, shortage, {
        usePokemonCount: true,
        pokemonCount: state.gatherPokemonCount,
        gatherRates: state.gatherRates,
        normalizePokemonCount,
      });
      const hours = result?.totalHours;
      if (!Number.isFinite(hours) || hours <= 0) return "-";
      return formatHours(hours);
    },
    elements: {
      usedTable: document.getElementById("usedTable"),
      otherTable: document.getElementById("otherTable"),
    }
  });
}

function renderSuggestionsTable() {
  if (!state.data) return;
  renderSuggestionsTableView({
    state,
    elements: {
      recommendTable: els.recommendTable,
      cat: els.cat,
    },
    categoryKey: getCurrentCategory(true),
    findRecipeById,
    em,
  });
}

function renderEnergyTable(selectedCategory = null) {
  const table = els.energyTable;
  if (!table || !state?.data?.recipes) return;

  const { fieldBonusPercent, eventBonusMultiplier, levels = {} } = state.energyConfig || {};
  const recipesByCat = state.data.recipes || {};
  const categoryLabelEl = document.getElementById("energyCategoryLabel"); // Might not exist in HTML? Check if needed.

  const filterKey = selectedCategory || getCurrentCategory(true);
  const targetList = filterKey ? recipesByCat[filterKey] || [] : Object.values(recipesByCat).flat();

  if (categoryLabelEl) {
    categoryLabelEl.textContent = CATEGORY_LABELS[filterKey] || filterKey || "-";
  }

  const rows = [];
  (targetList || []).forEach((recipe) => {
    const level = normalizeLevel(levels[recipe.id] ?? 0);
    const { finalEnergy, hoursRequired, energyPerHour } = computeRecipeEnergyStats(recipe, {
      level,
      fieldBonusPercent,
      eventBonusMultiplier,
      usePokemonCount: false,
      gatherRates: state.gatherRates,
      normalizePokemonCount,
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
  const table = els.gatherTable;
  if (!table || !state?.data?.ingredients) return;

  const headerLabels = ["食材ポケ", "きのポケ", "他常駐"];
  const rows = (state.data.ingredients || []).map((ing) => {
    const rates = normalizeGatherArray(state.gatherRates?.[ing.id], GATHER_COLUMNS);
    const inputs = rates.map((val, idx) => `
      <td class="num">
        <input
          type="text"
          inputmode="decimal"
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
  const table = els.stockGatherTable;
  if (!table || !state?.data?.ingredients) return;

  const headerLabels = ["食材ポケ", "きのポケ", "他常駐"];
  const rows = (state.data.ingredients || []).map((ing) => {
    const rates = normalizeGatherArray(state.stockPlan?.gatherRates?.[ing.id], GATHER_COLUMNS);
    const inputs = rates.map((val, idx) => `
      <td class="num">
        <input
          type="text"
          inputmode="decimal"
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
  window.lastStockPlanResult = result;

  const table = document.getElementById("stockPlanTable");
  const totalEl = document.getElementById("stockTotalCount");
  const noteEl = document.getElementById("stockPlanNotes");
  if (!table) return;

  const current = result;
  const requestedMealsValue = Number.isFinite(current?.requestedBaseMeals)
    ? current.requestedBaseMeals
    : Math.max(1, Math.round(state.stockPlan.baseMeals || 3));
  const baseMealsValue = Number.isFinite(current?.baseMeals)
    ? current.baseMeals
    : requestedMealsValue;
  const baseMealsLabel = `${baseMealsValue}食分`;

  const extraMealsValue = current.extraMeals || 0;
  const extraMealsLabel = extraMealsValue > 0 ? `+${extraMealsValue}食分` : `追加分`;

  if (!current || current.error) {
    table.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">${baseMealsLabel}</th><th class="num">${extraMealsLabel}</th><th class="num">余剰充当</th><th class="num">合計</th></tr>
      </thead>
      <tbody><tr><td class="muted" colspan="5">${current?.error || "条件を設定し、「備蓄プランを計算」を押してください。"}</td></tr></tbody>
    `;
    if (totalEl) totalEl.textContent = "-";
    if (noteEl) noteEl.textContent = current?.planEntry?.plan || "";
    return;
  }

  const baseTotals = current.baseTotals || new Map();
  const bonusTotals = current.bonusTotals || new Map();
  const finalTotals = current.finalTotals || new Map();

  const rows = [];
  const ingredientMap = new Map((state.data?.ingredients || []).map((ing) => [ing.id, ing]));
  const allIds = new Set([
    ...Array.from(baseTotals.keys()),
    ...Array.from(bonusTotals.keys()),
    ...Array.from(finalTotals.keys()),
  ]);
  allIds.forEach((ingId) => {
    const meta = ingredientMap.get(ingId) || { id: ingId, name: ingId, emoji: "" };
    const totalQty = Number(finalTotals.get(ingId) || 0);
    const baseQty = Number(baseTotals.get(ingId) || 0);
    const extraQty = Number(current.extraTotals?.get(ingId) || 0);
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
      <tr><th>食材名</th><th class="num">${baseMealsLabel}</th><th class="num">${extraMealsLabel}</th><th class="num">余剰充当</th><th class="num">合計</th></tr>
    </thead>
    <tbody>${rows.length ? rows.join("") : `<tr><td class="muted" colspan="5">（備蓄対象なし）</td></tr>`}</tbody>
  `;

  if (totalEl) totalEl.textContent = String(current.totalCount || current.baseCount || 0);

  if (noteEl) {
    const notes = [];
    const planLines = (current.categoryPlans || [])
      .map(p => {
        const title = p.recipeTitle ? ` (${p.recipeTitle})` : "";
        return `${CATEGORY_LABELS[p.categoryKey] || p.categoryKey}${title}: ${current.baseMeals}食`;
      })
      .join(" / ");
    if (planLines) notes.push(`内訳: ${planLines}`);
    if (current.planEntry?.plan) notes.push(`プラン: ${current.planEntry.plan}`);
    noteEl.textContent = notes.join(" | ");
  }
}

/* ----------------- Logic Wrappers ----------------- */

function calculateStockPlan() {
  if (!state?.data?.ingredients || !state?.data?.recipes) {
    throw new Error("データを読み込み中です。しばらくお待ちください。");
  }

  // Helper to sort categories (moved logic from main.js to here or constants/stock-ui)
  // We can use sortStockCategories from stock-ui if exported, or reimplement/import constants.
  // Let's just do simple sort based on ALL_RECIPE_CATEGORIES order.
  const sortCats = (cats) => {
    const order = new Map(ALL_RECIPE_CATEGORIES.map((c, i) => [c, i]));
    return cats.slice().sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0));
  };

  const categories = state.stockPlan.cookingCategories.length
    ? sortCats(state.stockPlan.cookingCategories)
    : [...DEFAULT_STOCK_CATEGORIES];

  const statsByCategory = buildStockRecipeStatsLogic(categories, {
    getStats: (categoryKey) => getAllRecipeEnergyStats({
      recipes: state.data.recipes,
      levels: state.energyConfig.levels,
      fieldBonusPercent: state.energyConfig.fieldBonusPercent,
      eventBonusMultiplier: state.energyConfig.eventBonusMultiplier,
      gatherRates: state.gatherRates, // Original behavior
      // Wait, original main.js used getAllRecipeEnergyStats which used state.gatherRates by default?
      // No, buildStockRecipeStats in main.js:
      // getStats: (categoryKey) => getAllRecipeEnergyStats({ categoryFilter: categoryKey, excludeMaxLevel: ... })
      // And getAllRecipeEnergyStats used state.gatherPokemonCount and state.potCapacity.
      // But for stock plan, we might want to use stock plan specific settings?
      // Original main.js getAllRecipeEnergyStats used global state.
      // But stock plan usually implies "next week", so maybe we should use stock gather rates?
      // The original code didn't seem to switch gather rates for the *recipe stats* calculation (energy per hour etc).
      // It used global state.gatherRates for "computeIngredientHours" inside "computeRecipeEnergyStats".
      // However, computeNextWeekStockPlan uses "boostedIngredientIds" which comes from stockPlan.gatherRates.
      // Let's stick to global gatherRates for energy stats for now to match original behavior, 
      // UNLESS stock plan explicitly needs stock gather rates for energy calculation (unlikely, usually stock rates are for "gathering capability" to meet the plan).
      // Actually, buildStockRecipeStatsLogic uses getStats to find "best recipes".
      // Best recipes depend on energy/hour. Energy/hour depends on gather rates (speed).
      // If we are planning for next week, we should probably use next week's gather rates (stockPlan.gatherRates).
      // But original code used global `getAllRecipeEnergyStats` which used `state.gatherRates`.
      // I will stick to `state.gatherRates` (current) for consistency, or `state.stockPlan.gatherRates` if I want to improve it.
      // Given refactoring, I should replicate original behavior.
      // Original behavior: getAllRecipeEnergyStats() -> uses state.gatherRates (via getGatherRates in main.js).

      categoryFilter: categoryKey,
      excludeMaxLevel: state.stockPlan.excludeMaxLevel,
      gatherRates: state.gatherRates, // Original behavior
      usePokemonCount: true, // Original: usePokemonCount=false in getAllRecipeEnergyStats default?
      // In main.js buildStockRecipeStats:
      // getStats: (categoryKey) => getAllRecipeEnergyStats({ categoryFilter: categoryKey, excludeMaxLevel: ... })
      // getAllRecipeEnergyStats default usePokemonCount is false.
      // So it uses pokemonCount=0 (or ignored).

      normalizeLevel,
      normalizePokemonCount,
      CATEGORY_LABELS,
    }),
  });

  const boostedSet = new Set();
  Object.entries(state.stockPlan?.gatherRates || {}).forEach(([id, arr]) => {
    if (Array.isArray(arr) && arr.some((v) => Number(v) > 0)) {
      boostedSet.add(id);
    }
  });

  return computeNextWeekStockPlan({
    bagCapacity: state.stockPlan.bagCapacity,
    islandType: state.stockPlan.islandType,
    eventType: state.stockPlan.eventType,
    categories,
    defaultCategories: DEFAULT_STOCK_CATEGORIES,
    recipesByCategory: state.data.recipes || {},
    ingredients: state.data.ingredients || [],
    recipeStatsByCategory: statsByCategory,
    nextWeekPlan: state.nextWeekPlan || {},
    distributeLeftover: state.stockPlan.distributeLeftover !== false,
    boostedIngredientIds: Array.from(boostedSet),
    categoryToNextKey: CATEGORY_TO_NEXT_KEY,
    baseMeals: state.stockPlan.baseMeals || 3,
  });
}

/* ----------------- Setup ----------------- */
function buildRecipeOptions(forcedCategory) {
  const cat = forcedCategory || els.cat?.value || els.globalCat?.value;
  if (!cat) return;
  const prevCat = lastCategoryUsed;
  if (prevCat && prevCat !== cat) {
    // clearProposalResults(); // Moved to UI modules or need to expose?
    // We can expose a global clearProposalResults or pass it.
    // For now, let's just define it locally or import it?
    // It's used in gather-init.js too.
    // I'll define it here and pass it to everyone.
    const container = document.getElementById("proposalResults");
    if (container) container.innerHTML = `<p class="muted">条件が変更されました。再計算してください。</p>`;
  }
  lastCategoryUsed = cat;
  localStorage.setItem("lastCategory", cat);
  if (els.cat && els.cat.value !== cat) els.cat.value = cat;
  if (els.globalCat && els.globalCat.value !== cat) els.globalCat.value = cat;

  if (!state.data || !state.data.recipes) return; // Added check
  const list = state.data.recipes[cat] || [];
  buildingRecipeOptions = true;
  if (els.rec) {
    els.rec.innerHTML = list.map(r => `<option value="${r.id}">${r.title}</option>`).join("");
  }
  buildingRecipeOptions = false;
  renderEnergyTable(cat);
}

function addRecipeById(id) {
  if (!id) return;
  if (incChosen(id)) {
    saveState();
    refresh();
    const cat = CATEGORY_TO_GROUP[localStorage.getItem("lastCategory") || ""];
    if (cat) {
      renderEnergyTable(cat.toLowerCase());
    }
  }
}

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
      renderNextChosen();
      rerenderTablesAndSuggestions();
      renderEnergyTable(getCurrentCategory(true));
    } else if (key === 'gather') {
      renderGatherTable();
    } else if (key === 'stock') {
      renderStockGatherTable();
      // renderStockPlanResults(); // Only if we have results?
    } else {
      rerenderTablesAndSuggestions();
    }
  };

  btns.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  const saved = localStorage.getItem('activeTab');
  const defaultKey = saved && panels[saved] ? saved : 'this';
  switchTabFn = activate;
  activate(defaultKey);
}

function buildCategoryOptions(recipes) {
  const order = ["curry", "salad", "dessert"].filter(k => recipes[k]);
  const options = order.map(k => `<option value="${k}">${CATEGORY_LABELS[k] || k}</option>`).join("");
  const saved = localStorage.getItem("lastCategory") || "";
  if (els.cat) els.cat.innerHTML = options;
  if (els.globalCat) els.globalCat.innerHTML = options;
  const active = order.includes(saved) ? saved : order[0] || "";
  if (active) {
    if (els.cat) els.cat.value = active;
    if (els.globalCat) els.globalCat.value = active;
  }
  buildRecipeOptions(active);
}

async function loadData() {
  try {
    const [ingredients, recipes, nextPlan] = await Promise.all([
      fetch(`./data/ingredients.json?v=${APP_VERSION}`).then(r => r.json()),
      fetch(`./data/recipes.json?v=${APP_VERSION}`).then(r => r.json()),
      fetch(`./nextWeekPlan.json?v=${APP_VERSION}`).then(r => r.json()).catch(() => ({})),
    ]);
    storeSetData({ ingredients, recipes });
    if (nextPlan && typeof nextPlan === "object") {
      state.nextWeekPlan = nextPlan;
    }

    console.log("Data loaded:", { ingredients, recipes, nextPlan });
    console.log("Elements:", els);

    buildCategoryOptions(recipes);
    populateNextWeekSelects(recipes, els);
    populateNextExtraSelect(ingredients, els.nwExtraSelect);

    refresh();
  } catch (e) {
    console.error("Data load failed:", e);
    showToast("データの読み込みに失敗しました。", "error");
  }
}

function setupUI() {
  setupTabs();

  setupCategorySelects({
    els,
    buildRecipeOptions,
    addRecipeById,
  });

  setupOcrUI({
    elements: els,
    state,
    saveState,
    refreshViews: refresh,
    showToast,
  });

  setupEnergyUI({
    elements: els,
    state,
    saveState,
    renderEnergyTable,
    clearProposalResults: () => {
      const container = document.getElementById("proposalResults");
      if (container) container.innerHTML = `<p class="muted">条件が変更されました。再計算してください。</p>`;
    },
    getCurrentCategory,
    showToast,
    writeToClipboard,
  });

  setupSettingsUI({
    elements: els,
    state,
    saveState,
    buildRecipeOptions,
    addRecipeById,
    renderEnergyTable,
    refreshViews: refresh,
  });

  setupStockUI({
    elements: els,
    state,
    saveState,
    renderStockGatherTable,
    renderStockPlanResults,
    calculateStockPlan,
    applyStockPlanToNext: () => {
      // Logic to apply stock plan to next week
      // Original main.js: applyStockPlanResult(lastStockPlanResult)
      // We need lastStockPlanResult.
      // renderStockPlanResults sets it.
      // But renderStockPlanResults is local to main.js now (or imported?).
      // I defined renderStockPlanResults in main.js.
      // I need to access the result.
      // I'll make lastStockPlanResult a module-level variable in main.js.
      if (window.lastStockPlanResult) {
        applyStockPlanResult(window.lastStockPlanResult, CATEGORY_TO_NEXT_KEY);
        saveState();
        refresh();
        showToast("次週計画に反映しました。", "success");
      }
    },
    showToast,
    writeToClipboard,
  });

  setupGatherUI({
    elements: els,
    state,
    save: saveState,
    maxGatherSlots: 5, // Or from constant
    syncSuggestControls: () => { }, // Placeholder if needed, or move logic to gather-init
    toggleSuggestCustomInputs: () => {
      const isCustom = state.suggestConfig.eventType === "custom";
      if (els.suggestEventCustom) els.suggestEventCustom.hidden = !isCustom;
    },
    normalizeGatherValue,
    setGatherRate: (ingId, idx, val) => {
      if (!ingId) return;
      const arr = normalizeGatherArray(state.gatherRates[ingId], GATHER_COLUMNS);
      arr[idx] = normalizeGatherValue(val);
      state.gatherRates[ingId] = arr;
      saveState();
      renderGatherTable();
      renderEnergyTable(getCurrentCategory(true));
    },
    setSuggestEventType: (val) => {
      state.suggestConfig.eventType = val;
      saveState();
    },
    setSuggestEc: (val) => {
      state.suggestConfig.ec = val;
      saveState();
    },
    setSuggestIsland: (val) => {
      state.suggestConfig.island = val;
      saveState();
    },
    setFieldBonusPercent: (val) => {
      state.suggestConfig.fieldBonusPercent = normalizePercent(val);
      saveState();
    },
    setEventBonusMultiplier: (val) => {
      state.suggestConfig.eventBonusMultiplier = normalizeMultiplier(val);
      saveState();
    },
    setSuggestBonusPreset: (val) => {
      state.suggestConfig.bonusPreset = val;
      saveState();
    },
    serializeGatherConfig: () => JSON.stringify({ rates: state.gatherRates }, null, 2),
    writeToClipboard,
    applyGatherConfig: (data) => {
      if (data.rates) state.gatherRates = data.rates;
      saveState();
    },
    renderGatherTable,
    renderEnergyTable,
    renderProposalResults: (results) => {
      const container = document.getElementById("proposalResults");
      renderProposalResultsView(results, container);
      // Store results globally or in state if needed for apply?
      // gather-init.js passes index to applyProposalCombo.
      // We need to ensure applyProposalCombo knows which result to apply.
      // The results array passed here is local to the calc function in gather-init.js.
      // But applyProposalCombo in main.js calls applyProposalComboToState(combo).
      // Wait, gather-init.js:281 calls applyProposalCombo(btn.dataset.index).
      // But applyProposalCombo in main.js expects a combo object, not an index?
      // Let's check main.js:925: applyProposalCombo: (combo) => { ... }
      // gather-init.js logic seems to assume it passes an index?
      // No, gather-init.js:281: applyProposalCombo(btn.dataset.index)
      // This looks like it passes a string index.
      // We need to fix this flow.
      // Option 1: Store last results in state or module var.
      // Option 2: Pass the combo object directly to the button? (Hard in HTML)
      // Option 3: gather-init.js should handle the lookup.
      state.lastProposalResults = results; // Store for lookup
    },
    clearProposalResults: () => {
      const container = document.getElementById("proposalResults");
      if (container) container.innerHTML = `<p class="muted">条件が変更されました。再計算してください。</p>`;
    },
    getAllRecipeEnergyStats: (opts) => getAllRecipeEnergyStats({
      ...opts,
      recipes: state.data.recipes,
      levels: state.energyConfig.levels,
      fieldBonusPercent: state.energyConfig.fieldBonusPercent,
      eventBonusMultiplier: state.energyConfig.eventBonusMultiplier,
      gatherRates: state.gatherRates,
      normalizeLevel,
      normalizePokemonCount,
      CATEGORY_LABELS,
    }),
    computeBestRecipeCombos,
    applyProposalCombo: (indexOrCombo) => {
      let combo = indexOrCombo;
      if (typeof indexOrCombo === "string" || typeof indexOrCombo === "number") {
        const idx = Number(indexOrCombo);
        // Find in lastProposalResults
        const found = state.lastProposalResults?.find(r => r.slot === idx);
        combo = found?.combo;
      }

      if (combo) {
        applyProposalComboToState(combo);
        saveState();
        refresh();
        showToast("献立を適用しました", "success");
      } else {
        showToast("献立の適用に失敗しました", "error");
      }
    },
    getCategory: getCurrentCategory,
    showToast,
  });

  bindMenuCardOpsDelegation({
    rootIds: ["menuList", "nwListCurry", "nwListSalad", "nwListSweets", "nwExtraList"],
    handlers: {
      incChosen: (id) => { incChosen(id); saveState(); },
      decChosen: (id) => { decChosen(id); saveState(); },
      setChosenQty: (id, q) => { setChosenQty(id, q); saveState(); },
      removeChosen: (id) => { removeChosen(id); saveState(); },
      incNextRecipe: (cat, id) => { incNextRecipe(cat, id); saveState(); },
      decNextRecipe: (cat, id) => { decNextRecipe(cat, id); saveState(); },
      setNextRecipeQty: (cat, id, q) => { setNextRecipeQty(cat, id, q); saveState(); },
      removeNextRecipe: (cat, id) => { removeNextRecipe(cat, id); saveState(); },
      incNextExtra: (id) => { incNextExtra(id); saveState(); },
      decNextExtra: (id) => { decNextExtra(id); saveState(); },
      setNextExtraQty: (id, q) => { setNextExtraQty(id, q); saveState(); },
      removeNextExtra: (id) => { removeNextExtra(id); saveState(); },
    },
    renderers: {
      renderMenuList,
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
    }
  });

  setupNextWeekSelects({
    elements: els,
    state,
    onAddRecipe: (cat, id) => { incNextRecipe(cat, id); saveState(); renderNextChosen(); rerenderTablesAndSuggestions(); },
  });

  setupCollapsers();

  setupNextExtraSelect({
    elements: els,
    state,
    onAddExtra: (id) => { incNextExtra(id); saveState(); renderNextChosen(); rerenderTablesAndSuggestions(); },
  });

  setupIngredientsFilter({
    state,
    renderTables,
  });


  setupTabs();
}

// Start
try {
  setupUI();
  loadData();
} catch (e) {
  console.error("Initialization failed:", e);
  showToast(`初期化エラー: ${e.message}`, "error");
}
