// js/render/tables.js
// テーブルおよびおすすめ表示に関する描画ユーティリティ

import { computeNextWeekTotals as computeNextWeekTotalsCore } from "../logic/next-week.js";

export { computeNextWeekTotalsCore as computeNextWeekTotals };

/**
 * 所持食材のマップを作成する。
 * @param {Array} ingredients
 * @param {Record<string, number>} have
 * @returns {Map<string, number>}
 */
export function buildInventoryMap(ingredients = [], have = {}) {
  const map = new Map();
  for (const ing of ingredients) {
    map.set(ing.id, Number(have[ing.id] || 0));
  }
  return map;
}

function totalNeeds(recipe) {
  let total = 0;
  for (const n of Object.values(recipe?.needs || {})) total += Number(n) || 0;
  return total;
}

function shortageSum(recipe, invMap) {
  let lack = 0;
  for (const [id, need] of Object.entries(recipe?.needs || {})) {
    const have = invMap.get(id) || 0;
    if (have < need) lack += (need - have);
  }
  return lack;
}

export function renderTables({ state, findRecipeById }) {
  const recipesByCat = state.data?.recipes || {};
  const ingredients = state.data?.ingredients || [];
  const invMap = buildInventoryMap(ingredients, state.have);

  const computeThis = () => {
    const map = new Map();
    const used = new Set();
    (state.chosen || []).forEach(it => {
      const r = findRecipeById(it.recipe);
      const qty = Number(it.qty) || 0;
      if (!r || !qty) return;
      Object.entries(r.needs || {}).forEach(([id, need]) => {
        used.add(id);
        map.set(id, (map.get(id) || 0) + need * qty);
      });
    });
    return { map, used };
  };

  const useThis = !!state.tableFilter?.this;
  const useNext = !!state.tableFilter?.next;

  const thisTotals = computeThis();
  const totalsMap = computeNextWeekTotalsCore(
    state.next,
    recipesByCat,
    ingredients,
    state.nextVersion,
  );
  const nextTotals = {
    map: new Map(
      Array.from(totalsMap.entries()).map(([id, info]) => [id, Number(info?.qty) || 0])
    ),
    used: new Set(totalsMap.keys()),
  };

  const targetMap = new Map();
  const addAll = (m) => m.forEach((v, k) => targetMap.set(k, (targetMap.get(k) || 0) + v));
  if (useThis) addAll(thisTotals.map);
  if (useNext) addAll(nextTotals.map);

  const usedThisSet = thisTotals.used;
  const usedNextSet = nextTotals.used;

  const usedRows = [];
  const otherRows = [];
  let sumCurU = 0, sumTarU = 0;
  let sumCurO = 0, sumTarO = 0;

  for (const ing of ingredients) {
    const id = ing.id;
    const cur = Number(invMap.get(id) || 0);
    const tar = Number(targetMap.get(id) || 0);
    const diff = cur - tar;

    const inThis = usedThisSet.has(id);
    const inNext = usedNextSet.has(id);
    const rowCls = (inThis && inNext) ? "wk-both"
      : inThis ? "wk-this"
      : inNext ? "wk-next"
      : "";

    const rowHtml = `
      <tr class="${rowCls}">
        <td>${ing.emoji || ""} ${ing.name || id}</td>
        <td class="num">${cur}</td>
        <td class="num">${tar}</td>
        <td class="num ${diff < 0 ? "neg" : diff > 0 ? "pos" : ""}">${diff}</td>
      </tr>`;

    if (tar > 0) {
      usedRows.push(rowHtml);
      sumCurU += cur; sumTarU += tar;
    } else {
      otherRows.push(rowHtml);
      sumCurO += cur; sumTarO += tar;
    }
  }

  const writeTable = (tableId, rows, sums) => {
    const el = document.getElementById(tableId);
    if (!el) return;
    const body = rows.length ? rows.join("") : `<tr><td class="muted" colspan="4">（なし）</td></tr>`;
    const footDiff = sums.cur - sums.tar;
    el.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">現在</th><th class="num">目標</th><th class="num">差分</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <th>合計</th>
          <th class="num">${sums.cur}</th>
          <th class="num">${sums.tar}</th>
          <th class="num ${footDiff < 0 ? "neg" : footDiff > 0 ? "pos" : ""}">${footDiff}</th>
        </tr>
      </tfoot>`;
  };

  writeTable("usedTable", usedRows, { cur: sumCurU, tar: sumTarU });
  writeTable("otherTable", otherRows, { cur: sumCurO, tar: sumTarO });
}

export function renderSuggestionsTable({ state, els, findRecipeById, em }) {
  const table = document.getElementById("recommendTable");
  if (!table) return;

  const ingredients = state.data?.ingredients || [];
  const recipesByCat = state.data?.recipes || {};
  const inv = buildInventoryMap(ingredients, state.have);
  const chosenSet = new Set(state.chosen.map(c => c.recipe));
  const cat = els.cat?.value;
  const candidates = (recipesByCat[cat] || []).filter(r => !chosenSet.has(r.id));

  const thisWeekIds = new Set();
  for (const ch of state.chosen) {
    const q = Number(ch?.qty) || 0;
    if (q <= 0) continue;
    const rr = findRecipeById(ch.recipe);
    if (rr && rr.needs) {
      for (const id of Object.keys(rr.needs)) thisWeekIds.add(id);
    }
  }

  const nextTotals = computeNextWeekTotalsCore(
    state.next,
    recipesByCat,
    ingredients,
    state.nextVersion,
  );
  const nextWeekIds = new Set(nextTotals.keys());

  const rows = [];
  for (const r of candidates) {
    const deficit = shortageSum(r, inv);
    if (deficit === 0 || deficit <= 10) {
      const pods = Object.entries(r.needs || {}).map(([id, need]) => {
        const have = inv.get(id) || 0;
        const lack = Math.max(0, need - have);

        let useCls = "";
        const inThis = thisWeekIds.has(id);
        const inNext = nextWeekIds.has(id);
        if (inThis && inNext) useCls = "is-both";
        else if (inThis) useCls = "is-this";
        else if (inNext) useCls = "is-next";

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
          <td class="status-col">${deficit === 0
            ? '<span class="status-ok">作れる</span>'
            : '<span class="status-near">あと少し</span>'}</td>
        </tr>`
      });
    }
  }

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
      ${rows.length ? rows.map(r => r.html).join("") : `<tr><td class="muted" colspan="3">該当なし</td></tr>`}
    </tbody>
  `;
}
