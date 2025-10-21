// js/ui/card-ops.js
// カード操作（数量の増減・削除）のイベント委譲を扱うモジュール

function noop() {}

export function bindMenuCardOpsDelegation({
  rootIds = [],
  handlers = {},
  renderers = {},
}) {
  const {
    incChosen = noop,
    decChosen = noop,
    setChosenQty = noop,
    removeChosen = noop,
    incNextRecipe = noop,
    decNextRecipe = noop,
    setNextRecipeQty = noop,
    removeNextRecipe = noop,
    incNextExtra = noop,
    decNextExtra = noop,
    setNextExtraQty = noop,
    removeNextExtra = noop,
  } = handlers;

  const {
    renderMenuList = noop,
    renderNextChosen = noop,
    renderTables = noop,
    renderSuggestionsTable = noop,
  } = renderers;

  const renderThis = () => {
    renderMenuList();
    renderTables();
    renderSuggestionsTable();
  };

  const renderNext = (withSuggestions = true) => {
    renderNextChosen();
    renderTables();
    if (withSuggestions) renderSuggestionsTable();
  };

  rootIds.forEach((rootId) => {
    const root = document.getElementById(rootId);
    if (!root) return;

    // クリック（− / ＋ / ×）
    root.addEventListener("click", (e) => {
      const card = e.target.closest(".menu-card");
      if (!card) return;
      const ctx = card.dataset.ctx;
      const catKey = card.dataset.cat || null;
      const id = card.dataset.id;

      if (e.target.classList.contains("op-minus")) {
        if (ctx === "THIS") decChosen(id);
        else if (catKey === "extra") decNextExtra(id);
        else decNextRecipe(catKey, id);
        ctx === "THIS" ? renderThis() : renderNext();
      } else if (e.target.classList.contains("op-plus")) {
        if (ctx === "THIS") incChosen(id);
        else if (catKey === "extra") incNextExtra(id);
        else incNextRecipe(catKey, id);
        ctx === "THIS" ? renderThis() : renderNext();
      } else if (e.target.classList.contains("op-remove")) {
        if (ctx === "THIS") removeChosen(id);
        else if (catKey === "extra") removeNextExtra(id);
        else removeNextRecipe(catKey, id);
        ctx === "THIS" ? renderThis() : renderNext();
      }
    });

    // 数量直接編集
    root.addEventListener("change", (e) => {
      const input = e.target.closest(".qty-input");
      if (!input) return;
      const card = e.target.closest(".menu-card");
      const ctx = card.dataset.ctx;
      const catKey = card.dataset.cat || null;
      const id = card.dataset.id;
      const qty = Math.max(0, parseInt(e.target.value || "0", 10));

      if (ctx === "THIS") {
        setChosenQty(id, qty);
        renderThis();
      } else {
        if (catKey === "extra") setNextExtraQty(id, qty);
        else setNextRecipeQty(catKey, id, qty);
        // 既存挙動では suggestions の更新は不要だったが追加しても差し支えない
        renderNext(false);
      }
    });
  });
}
