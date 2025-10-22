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

const APP_VERSION = '20251022-1127'; // update-version.js と連動

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
};

/* ----------------- State ----------------- */
const state = {
  have:   JSON.parse(localStorage.getItem("have")   || "{}"),
  chosen: JSON.parse(localStorage.getItem("chosen") || "[]"), // 今週
  next:   JSON.parse(localStorage.getItem("next")   || JSON.stringify({
            CURRY: [], SALAD: [], SWEETS: [], extra: []
          })), // 次週 {CURRY:[{recipe,qty}],... , extra:[{ingId,qty}]}
  data: null,
};

function save() {
  localStorage.setItem("have", JSON.stringify(state.have));
  localStorage.setItem("chosen", JSON.stringify(state.chosen));
  localStorage.setItem("next", JSON.stringify(state.next)); // ★追加
}

/* ----------------- Data load ----------------- */
async function loadData() {
  const [ingredients, recipes] = await Promise.all([
    fetch(`./data/ingredients.json?v=${APP_VERSION}`).then( r => r.json()),
    fetch(`./data/recipes.json?v=${APP_VERSION}`).then( r => r.json()),
  ]);
  state.data = { ingredients, recipes };
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
  const panelThis = document.getElementById('tab_this_week');
  const panelNext = document.getElementById('tab_next_week');
  if (!btns.length || !panelThis || !panelNext) return; // ガード

  const activate = (key) => {
    // タブ見た目
    btns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === key));
    // パネル表示
    const showThis = key === 'this';
    panelThis.hidden = !showThis;
    panelNext.hidden = showThis;
    panelThis.classList.toggle('is-active', showThis);
    panelNext.classList.toggle('is-active', !showThis);

    // 状態保存（再読込復元用）
    localStorage.setItem('activeTab', key);

    // パネルごとの再描画
    if (key === 'next') {
      // 次週は切替ごとに再計算・再描画
      renderNextChosen?.();
      renderTables?.();
      renderSuggestionsTable?.();   // ★ 追加
    } else {
      // 今週側は必要に応じて（既存のレンダ関数名に合わせて）
      renderTables?.();
      renderSuggestionsTable?.();   // ★ 追加（安全のため）
    }
  };

  // クリックで切替
  btns.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  // 初期表示（保存があれば復元、なければ 'this'）
  const saved = localStorage.getItem('activeTab') || 'this';
  activate(saved);
}

/* ----------------- Select builders ----------------- */
const CATEGORY_LABELS = {
  curry: "カレー・シチュー",
  salad: "サラダ",
  dessert: "デザート・ドリンク",
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
}

function addNextRecipe(cat, recipeId) {
  if (!recipeId) return;
  const arr = state.next[cat] || (state.next[cat] = []);
  const hit = arr.find(x => x.recipe === recipeId);
  if (hit) hit.qty += 1; else arr.push({ recipe: recipeId, qty: 1 });
  save(); renderNextChosen(); renderTables();
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

/* ----------------- Render ----------------- */
function refresh() {
  renderMenuList();          // 今週
  renderSuggestionsTable();// 今週
  // 次週（タブ未表示でも下準備してOK）
  renderNextChosen();
  renderTables();
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

  // ▼ 個別食材カードも一緒に描画
  renderExtraCards();
}

// 今週/次週チェックに基づき「使用食材／その他の食材」の2表を1回で描画
function renderTables() {
  const invMap = buildInventoryMap();
  const ingredients = state.data.ingredients || [];

  const thisTotals = computeThisWeekTotals(state.chosen, findRecipeById);
  const nextTotalsRaw = computeNextWeekTotals(
    state.next,
    state.data.recipes || {},
    ingredients,
  ) || {};
  const nextMap = new Map(
    Object.entries(nextTotalsRaw).map(([id, info]) => [id, Number(info?.qty) || 0])
  );
  const nextTotals = { map: nextMap, used: new Set(nextMap.keys()) };

  const { usedRows, otherRows, sums } = buildTableRows({
    thisTotals,
    nextTotals,
    tableFilter: state.tableFilter || { this: true, next: true },
    inventoryMap: invMap,
    ingredients,
  });

  const writeTable = (tableId, rows, sumsObj) => {
    const el = document.getElementById(tableId);
    if (!el) return;
    const body = rows.length ? rows.join("") : `<tr><td class="muted" colspan="4">（なし）</td></tr>`;
    const footDiff = sumsObj.cur - sumsObj.tar;
    el.innerHTML = `
      <thead>
        <tr><th>食材名</th><th class="num">現在</th><th class="num">目標</th><th class="num">差分</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <th>合計</th>
          <th class="num">${sumsObj.cur}</th>
          <th class="num">${sumsObj.tar}</th>
          <th class="num ${footDiff < 0 ? 'neg' : footDiff > 0 ? 'pos' : ''}">${footDiff}</th>
        </tr>
      </tfoot>`;
  };

  writeTable('usedTable', usedRows, sums.used);
  writeTable('otherTable', otherRows, sums.other);
}

/* ---- おすすめ（未選択・今週の料理） ---- */
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
const nextTotals = computeNextWeekTotals(state.next, state.data.recipes || {}, state.data.ingredients || []) || {};
  const nextWeekIds = new Set(Object.keys(nextTotals));

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

// ▼ 個別食材は「選んだら即カード化」へ（Addボタン/数量入力は使わない）
function renderExtraCards() {
  const mountEl = document.getElementById("nwExtraList");
  if (!mountEl) return;

  const items = (state.next.extra || []).map(e => {
    const meta = state.data.ingredients.find(i => i.id === e.ingId) || {};
    const title = `${meta.emoji || ""} ${meta.name || ""}`.trim();

    return `
      <div class="menu-card" data-ctx="NEXT" data-cat="extra" data-id="${e.ingId}">
        <div class="header-line">
          <div class="title">${title}</div>
          <div class="qty-ops">
            <button class="op-btn op-minus btn btn-primary">−</button>
            <input class="qty-input" type="number" min="0" value="${e.qty}">
            <button class="op-btn op-plus  btn btn-primary">＋</button>
            <button class="op-btn op-remove btn btn-ghost">×</button>
          </div>
        </div>
      </div>`;
  });

  mountEl.innerHTML = items.length
    ? items.join("")
    : `<div class="empty muted">（なし）</div>`;
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
  if (hit) hit.qty += 1;
  else arr.push({ recipe: recipeId, qty: 1 });
  save();
}
function decNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  const hit = arr.find(x => x.recipe === recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  save();
}
function setNextRecipeQty(catKey, recipeId, qty) {
  const arr = findNextArray(catKey);
  const hit = arr.find(x => x.recipe === recipeId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  save();
}
function removeNextRecipe(catKey, recipeId) {
  const arr = findNextArray(catKey);
  state.next[catKey] = arr.filter(x => x.recipe !== recipeId);
  save();
}

// ==== 個別食材（extra） 用の増減/削除 ====
function findExtra(ingId) {
  return (state.next.extra || []).find(e => e.ingId === ingId) || null;
}
function incNextExtra(ingId) {
  if (!state.next.extra) state.next.extra = [];
  const hit = findExtra(ingId);
  if (hit) hit.qty += 1;
  else state.next.extra.push({ ingId, qty: 1 });
  save();
}
function decNextExtra(ingId) {
  if (!state.next.extra) return;
  const hit = findExtra(ingId);
  if (!hit) return;
  hit.qty = Math.max(0, (hit.qty || 0) - 1);
  save();
}
function setNextExtraQty(ingId, qty) {
  if (!state.next.extra) return;
  const hit = findExtra(ingId);
  if (!hit) return;
  hit.qty = Math.max(0, Number(qty) || 0);
  if (hit.qty === 0) {
    state.next.extra = state.next.extra.filter(e => e.ingId !== ingId);
  }
  save();
}
function removeNextExtra(ingId) {
  if (!state.next.extra) return;
  state.next.extra = state.next.extra.filter(e => e.ingId !== ingId);
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
      renderTables,
      renderSuggestionsTable,
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
      renderTables,
      renderSuggestionsTable,
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
        renderTables();
        renderSuggestionsTable();
      },
    });
    refresh();
  }).catch(err => console.error("Init failed:", err));
});
