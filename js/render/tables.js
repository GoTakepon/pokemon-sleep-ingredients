// js/render/tables.js
// テーブル描画とおすすめ表示に関するユーティリティ

import { computeNextWeekTotals } from "../logic/next-week.js";
import { computeThisWeekTotals, buildTableRows } from "../logic/weekly-totals.js";
import {
  collectThisWeekIngredientIds,
  buildChosenRecipeSet,
} from "../logic/recommendation.js";

function resolveElement(ref, fallbackId) {
  if (ref) return ref;
  if (fallbackId) return document.getElementById(fallbackId);
  return null;
}

export function buildInventoryMap(ingredients = [], have = {}) {
  const map = new Map();
  (ingredients || []).forEach((ing) => {
    map.set(ing.id, Number(have?.[ing.id] || 0));
  });
  return map;
}

function defaultShortageHoursFactory(state) {
  return (ingId, shortageQty) => {
    if (!shortageQty || shortageQty <= 0) return "-";
    const rates = (state.gatherRates?.[ingId] || [])
      .map((val) => Math.max(0, Number(val) || 0));
    const count = Math.max(1, Number(state.gatherPokemonCount) || 1);
    const dailyRate = rates
      .slice()
      .sort((a, b) => b - a)
      .slice(0, count)
      .reduce((sum, val) => sum + val, 0);
    if (dailyRate <= 0) return "-";
    const hours = (shortageQty / dailyRate) * 24;
    if (!Number.isFinite(hours)) return "-";
    if (hours >= 100) return Math.round(hours).toString();
    return (Math.round(hours * 10) / 10).toFixed(1);
  };
}

export function renderTables({
  state,
  findRecipeById,
  computeShortageHours = defaultShortageHoursFactory(state),
  elements = {},
} = {}) {
  const ingredients = state.data?.ingredients || [];
  const recipesByCat = state.data?.recipes || {};
  const inventoryMap = buildInventoryMap(ingredients, state.have);

  const thisTotals = computeThisWeekTotals(state.chosen, findRecipeById);
  const totalsMap = computeNextWeekTotals(
    state.next,
    recipesByCat,
    ingredients,
    state.nextVersion,
  );
  const nextTotals = {
    map: new Map(
      Array.from(totalsMap.entries()).map(([id, info]) => [
        id,
        Number(info?.qty) || 0,
      ]),
    ),
    used: new Set(totalsMap.keys()),
  };

  const tableFilter = {
    this: state.tableFilter?.this !== undefined ? !!state.tableFilter.this : true,
    next: state.tableFilter?.next !== undefined ? !!state.tableFilter.next : true,
  };

  const { usedRows, otherRows, sums } = buildTableRows({
    thisTotals,
    nextTotals,
    tableFilter,
    inventoryMap,
    ingredients,
    computeShortageHours,
  });

  const writeTable = (el, rows, summary) => {
    if (!el) return;
    const body = rows.length
      ? rows.join("")
      : `<tr><td class="muted" colspan="5">（なし）</td></tr>`;
    const diff = summary.cur - summary.tar;
    el.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">現在</th><th class="num">目標</th><th class="num">差分</th><th class="num">残時間 (h)</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <th>合計</th>
          <th class="num">${summary.cur}</th>
          <th class="num">${summary.tar}</th>
          <th class="num ${diff < 0 ? "neg" : diff > 0 ? "pos" : ""}">${diff}</th>
          <th class="num">-</th>
        </tr>
      </tfoot>`;
  };

  writeTable(
    resolveElement(elements.usedTable, "usedTable"),
    usedRows,
    sums.used,
  );
  writeTable(
    resolveElement(elements.otherTable, "otherTable"),
    otherRows,
    sums.other,
  );
}

function totalNeeds(recipe) {
  let total = 0;
  Object.values(recipe?.needs || {}).forEach((val) => {
    total += Number(val) || 0;
  });
  return total;
}

function shortageSum(recipe, inventoryMap) {
  let lack = 0;
  Object.entries(recipe?.needs || {}).forEach(([id, need]) => {
    const have = inventoryMap.get(id) || 0;
    if (have < need) lack += (need - have);
  });
  return lack;
}

export function renderSuggestionsTable({
  state,
  elements = {},
  els = {},
  findRecipeById,
  em = () => "",
  categoryKey: forcedCategory = null,
} = {}) {
  const refs = { ...els, ...elements };
  const table = resolveElement(refs.recommendTable, "recommendTable");
  if (!table) return;

  const catSelect = resolveElement(refs.cat, "categorySelect");
  const categoryKey = forcedCategory || catSelect?.value;
  if (!categoryKey) {
    table.innerHTML = `
      <thead>
        <tr><th class="left">料理名</th><th class="num">不足(合計)</th><th class="right">状態</th></tr>
      </thead>
      <tbody><tr><td class="muted" colspan="3">カテゴリが選択されていません</td></tr></tbody>`;
    return;
  }

  const ingredients = state.data?.ingredients || [];
  const recipesByCat = state.data?.recipes || {};
  const chosenSet = buildChosenRecipeSet(state.chosen);
  const candidates = (recipesByCat[categoryKey] || []).filter(
    (recipe) => !chosenSet.has(recipe?.id),
  );
  const inventoryMap = buildInventoryMap(ingredients, state.have);
  const nextTotals = computeNextWeekTotals(
    state.next,
    recipesByCat,
    ingredients,
    state.nextVersion,
  );
  const nextWeekIds = new Set(nextTotals.keys());
  const thisWeekIds = collectThisWeekIngredientIds(state.chosen, findRecipeById);

  const rows = [];
  candidates.forEach((recipe) => {
    const deficit = shortageSum(recipe, inventoryMap);
    if (deficit !== 0 && deficit > 10) return;

    const pods = Object.entries(recipe.needs || {}).map(([id, need]) => {
      const have = inventoryMap.get(id) || 0;
      const lack = Math.max(0, need - have);
      let useCls = "";
      const inThis = thisWeekIds.has(id);
      const inNext = nextWeekIds.has(id);
      if (inThis && inNext) useCls = "is-both";
      else if (inThis) useCls = "is-this";
      else if (inNext) useCls = "is-next";
      return `
        <div class="need-pod ${useCls}">
          <div class="em">${em(id)}</div>
          <div class="num">×${need}</div>
          ${lack > 0 ? `<div class="lack">-${lack}</div>` : ""}
        </div>`;
    }).join("");

    rows.push({
      deficit,
      total: totalNeeds(recipe),
      title: recipe.title,
      html: `<tr>
        <td class="title-cell">
          <div class="sugg-title">${recipe.title}</div>
          <div class="need-pods">${pods}</div>
        </td>
        <td class="num">${deficit}</td>
        <td class="status-col">${deficit === 0
          ? '<span class="status-ok">作れる</span>'
          : '<span class="status-near">あと少し</span>'}</td>
      </tr>`,
    });
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.deficit !== b.deficit) return a.deficit - b.deficit;
    return a.title.localeCompare(b.title, "ja");
  });

  table.innerHTML = `
    <thead>
      <tr><th class="left">料理名</th><th class="num">不足(合計)</th><th class="right">状態</th></tr>
    </thead>
    <tbody>
      ${rows.length
        ? rows.map((row) => row.html).join("")
        : `<tr><td class="muted" colspan="3">該当なし</td></tr>`}
    </tbody>
  `;
}
