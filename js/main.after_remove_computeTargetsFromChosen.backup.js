// js/main.js
// - OCR解析（./ocr-parse.js）
// - セレクト選択で即追加
// - 数量は 0 まで可（−で 0、× で削除）
// - おすすめレシピ：必要食材「合計数が多い順」に並び替え
import { parseOcrText } from "./ocr-parse.js";
import {
  renderTables as renderTablesView,
  renderSuggestionsTable as renderSuggestionsTableView,
} from "./render/tables.js?v=20251021-2058";
import {
  state,
  saveState,
  setData,
  refreshIndexes,
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
} from "./state/store.js?v=20251021-2058";
import {
  setupTabs,
  setupCategorySelects,
  setRecipeOptionsBuilding,
  setupOcrHandlers,
  setupMenuCardOps,
  setupNextWeekSelects,
  setupNextExtraSelect,
  setupCollapsers,
  setupIngredientsFilter,
  initNextState,
} from "./ui/init.js?v=20251021-2058";

const APP_VERSION = '20251021-2058';

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

initNextState();

/* ----------------- Data load ----------------- */
async function loadData() {
  try {
    const [ingredients, recipes] = await Promise.all([
      fetch(`./data/ingredients.json?v=${APP_VERSION}`).then(r => r.json()),
      fetch(`./data/recipes.json?v=${APP_VERSION}`).then(r => r.json()),
    ]);
    setData({ ingredients, recipes });
    buildCategoryOptions(recipes);
    return true;
  } catch (err) {
    console.error("Data load failed:", err);
    alert("データの読み込みに失敗しました。ネットワークを確認し、再読込してください。");
    if (!state.data) {
      setData({ ingredients: [], recipes: {} });
    } else {
      refreshIndexes();
    }
    buildCategoryOptions(state.data.recipes || {});
    return false;
  }
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

function buildRecipeOptions() {
  const cat = els.cat.value;
  const list = state.data.recipes[cat] || [];
  setRecipeOptionsBuilding(els, true);
  els.rec.innerHTML = list.map(r => `<option value="${r.id}">${r.title}</option>`).join("");
  setRecipeOptionsBuilding(els, false);
}

/* ----------------- Menu actions ----------------- */
function addRecipeById(id) {
  if (!id) return;
  incChosen(id);
  refresh();
}

function handleParseOcr() {
  const raw = (els.ocr?.value || "").trim();
  if (!raw) return alert("OCRテキストを入力してください。");
  const { result, debug } = parseOcrText(raw, state.data.ingredients);
  console.log("OCR debug:", debug);
  state.have = result || {};
  saveState();
  refresh();
}

function handleClearOcr() {
  state.have = {};
  state.chosen = [];
  if (els.ocr) els.ocr.value = "";
  saveState();
  refresh();
}

/* ----------------- Helpers ----------------- */
function em(ingId) {
  const ing = state.index?.ingredientById?.get(ingId) || state.data.ingredients.find(x => x.id === ingId);
  return ing?.emoji || "";
}

function renderTables() {
  renderTablesView({ state, findRecipeById });
}

function renderSuggestionsTable() {
  renderSuggestionsTableView({ state, els, findRecipeById, em });
}

/* ----------------- Render ----------------- */
function rerender({
  thisWeek = false,
  nextWeek = false,
  tables = false,
  suggestions = false,
} = {}) {
  if (thisWeek) renderMenuList();
  if (nextWeek) renderNextChosen();
  if (tables) renderTables();
  if (suggestions) renderSuggestionsTable();
}

function refresh() {
  rerender({
    thisWeek: true,
    nextWeek: true,
    tables: true,
    suggestions: true,
  });
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
// 共有カード描画（THIS/NEXT 共通）
// ※ 順序ミスを防ぐためオブジェクト引数に変更
function renderMenuCardsShared({ ctx, items, mountEl, catKey = null }) {
  if (!mountEl) return;
  mountEl.innerHTML = (items || []).map(it => {
    const r = findRecipeById(it.recipe);
    const itemId = ctx === "NEXT" && catKey === "extra" ? it.recipe || it.ingId : it.recipe;
    const inputId = `qty-${ctx.toLowerCase()}-${catKey || "main"}-${itemId}`;
    const inputLabel = ctx === "THIS"
      ? "今週の料理の数量"
      : catKey === "extra"
        ? "次週の個別食材の数量"
        : "次週の料理の数量";
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
            <input id="${inputId}" class="qty-input" name="qty" type="number" min="0" value="${it.qty}" aria-label="${inputLabel}">
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
            <input class="qty-input" type="number" min="0" value="${e.qty}" aria-label="次週の個別食材の数量">
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

/*
  // 既存の「renderTables( tableId, rows, sums )」に合わせて出力
  renderTables('usedTable', usedRows,  {cur:sumCurU, tar:sumTarU, diff:sumCurU - sumTarU});
  renderTables('otherTable', otherRows,{cur:sumCurO, tar:sumTarO, diff:sumCurO - sumTarO});
}
*/
/* ----------------- boot ----------------- */
document.addEventListener("DOMContentLoaded", () => {
  const versionEl = document.getElementById("appVersion");
  if (versionEl) versionEl.textContent = APP_VERSION;
  loadData().then((loaded) => {
    if (!loaded) return;
    setupTabs(rerender);
    setupCollapsers();
    buildNextWeekOptions();
    setupCategorySelects({ els, buildRecipeOptions, addRecipeById });
    setupOcrHandlers(els, { onParse: handleParseOcr, onClear: handleClearOcr });
    setupNextWeekSelects({
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
    });
    setupNextExtraSelect({
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
    });
    setupMenuCardOps({
      rootIds: [
        'menuList',
        'nwListCurry',
        'nwListSalad',
        'nwListSweets',
        'nwExtraList'
      ],
      renderMenuList,
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
    });
    setupIngredientsFilter({
      renderTables: () => {
        renderTables();
        renderSuggestionsTable();
      },
    });
    refresh();
  }).catch(err => console.error("Init failed:", err));
});
