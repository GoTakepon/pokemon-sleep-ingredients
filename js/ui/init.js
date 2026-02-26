// js/ui/init.js
// DOM 初期化とイベントバインドをまとめたモジュール

import {
  state,
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
} from "../state/store.js";

export function setupTabs(rerender) {
  const btns = document.querySelectorAll(".tabs .tab");
  const panelThis = document.getElementById("tab_this_week");
  const panelNext = document.getElementById("tab_next_week");
  if (!btns.length || !panelThis || !panelNext) return;

  const activate = (key) => {
    btns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === key));
    const showThis = key === "this";
    panelThis.hidden = !showThis;
    panelNext.hidden = showThis;
    panelThis.classList.toggle("is-active", showThis);
    panelNext.classList.toggle("is-active", !showThis);
    localStorage.setItem("activeTab", key);

    if (key === "next") {
      rerender({ nextWeek: true, tables: true, suggestions: true });
    } else {
      rerender({ tables: true, suggestions: true });
    }
  };

  btns.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  });

  const saved = localStorage.getItem("activeTab") || "this";
  activate(saved);
}

export function setupCategorySelects({ els, buildRecipeOptions, addRecipeById }) {
  els.cat.addEventListener("change", () => buildRecipeOptions());
  els.rec.addEventListener("change", () => {
    if (els.rec.dataset.building === "true") return;
    addRecipeById(els.rec.value);
  });
}

export function setRecipeOptionsBuilding(els, flag) {
  els.rec.dataset.building = flag ? "true" : "false";
}

export function setupOcrHandlers(els, { onParse, onClear }) {
  els.parse?.addEventListener("click", onParse);
  els.clear?.addEventListener("click", onClear);
}

export function setupMenuCardOps({
  rootIds,
  renderMenuList,
  renderNextChosen,
  renderTables,
  renderSuggestionsTable,
}) {
  rootIds.forEach((id) => {
    const root = document.getElementById(id);
    if (!root) return;

    // クリック（− / ＋ / ×）
    root.addEventListener("click", (e) => {
      const card = e.target.closest(".menu-card");
      if (!card) return;
      const ctx = card.dataset.ctx; // 'THIS' or 'NEXT'
      const catKey = card.dataset.cat || null; // 'CURRY'|'SALAD'|'SWEETS'|'extra'
      const targetId = card.dataset.id; // recipeId or ingId

      const rerender = () => {
        if (ctx === "THIS") {
          renderMenuList();
          renderTables();
          renderSuggestionsTable();
        } else {
          renderNextChosen();
          renderTables();
        }
      };

      const doMinus = () => {
        if (ctx === "THIS") decChosen(targetId);
        else if (catKey === "extra") decNextExtra(targetId);
        else decNextRecipe(catKey, targetId);
      };
      const doPlus = () => {
        if (ctx === "THIS") incChosen(targetId);
        else if (catKey === "extra") incNextExtra(targetId);
        else incNextRecipe(catKey, targetId);
      };
      const doRemove = () => {
        if (ctx === "THIS") removeChosen(targetId);
        else if (catKey === "extra") removeNextExtra(targetId);
        else removeNextRecipe(catKey, targetId);
      };

      if (e.target.classList.contains("op-minus")) { doMinus(); rerender(); }
      else if (e.target.classList.contains("op-plus")) { doPlus(); rerender(); }
      else if (e.target.classList.contains("op-remove")) { doRemove(); rerender(); }
    });

    // 数量直接編集
    root.addEventListener("change", (e) => {
      const input = e.target.closest(".qty-input");
      if (!input) return;
      const card = e.target.closest(".menu-card");
      const ctx = card.dataset.ctx;
      const catKey = card.dataset.cat || null;
      const targetId = card.dataset.id;
      const qty = Math.max(0, parseInt(e.target.value || "0", 10));

      if (ctx === "THIS") {
        setChosenQty(targetId, qty);
        renderMenuList();
        renderTables();
        renderSuggestionsTable();
      } else {
        if (catKey === "extra") setNextExtraQty(targetId, qty);
        else setNextRecipeQty(catKey, targetId, qty);
        renderNextChosen();
        renderTables();
      }
    });
  });
}

export function setupNextWeekSelects({ renderNextChosen, renderTables, renderSuggestionsTable }) {
  const map = {
    CURRY: document.getElementById("nwRecCurry"),
    SALAD: document.getElementById("nwRecSalad"),
    SWEETS: document.getElementById("nwRecSweets"),
  };
  Object.entries(map).forEach(([CAT, sel]) => {
    if (!sel) return;
    sel.addEventListener("change", () => {
      const recipeId = sel.value;
      if (!recipeId) return;
      incNextRecipe(CAT, recipeId);
      sel.selectedIndex = 0;
      renderNextChosen();
      renderTables();
      renderSuggestionsTable();
    });
  });
}

export function setupNextExtraSelect({ renderNextChosen, renderTables, renderSuggestionsTable }) {
  const sel = document.getElementById("nwExtraSelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    const ingId = sel.value;
    if (!ingId) return;
    incNextExtra(ingId);
    sel.selectedIndex = 0;
    renderNextChosen();
    renderTables();
    renderSuggestionsTable();
  });
}

export function setupCollapsers() {
  document.querySelectorAll(".collapse-toggle").forEach((btn) => {
    const targetSel = btn.getAttribute("data-target");
    const panel = document.querySelector(targetSel);
    if (!panel) return;
    btn.addEventListener("click", () => {
      const isHidden = panel.hasAttribute("hidden");
      if (isHidden) {
        panel.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  });
}

export function setupIngredientsFilter({ renderTables }) {
  const cThis = document.getElementById("chkThisWeek");
  const cNext = document.getElementById("chkNextWeek");

  const previousFilter = state.tableFilter || {};
  state.tableFilter = {
    this: cThis ? !!cThis.checked : (previousFilter.this ?? true),
    next: cNext ? !!cNext.checked : (previousFilter.next ?? true),
  };

  if (cThis) {
    cThis.addEventListener("change", () => {
      state.tableFilter.this = cThis.checked;
      renderTables();
    });
  }

  if (cNext) {
    cNext.addEventListener("change", () => {
      state.tableFilter.next = cNext.checked;
      renderTables();
    });
  }
}
