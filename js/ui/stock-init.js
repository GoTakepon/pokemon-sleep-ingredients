// js/ui/stock-init.js
// 「次週備蓄計画」タブの初期化ロジック

/**
 * 次週備蓄計画タブの UI 初期化。
 */
export function setupStockPlanUI({
  elements,
  state,
  setStockGatherRate,
  clearStockPlanResults,
  setStockCalcLoading,
  setStockBagCapacity,
  setStockBaseMeals,
  setStockIslandType,
  setStockEventType,
  setStockExcludeMax,
  setStockDistribute,
  setStockCookingCategories,
  serializeStockGatherConfig,
  writeToClipboard,
  applyStockGatherConfig,
  syncStockPlanControls,
  renderStockGatherTable,
  renderStockPlanResults,
  calculateStockPlan,
  applyStockPlanToNext,
}) {
  const {
    stockGatherTable,
    stockBagCapacity,
    stockCalcBtn,
    stockBaseMeals,
    stockIsland,
    stockEvent,
    stockExcludeMax,
    stockDistribute,
    stockApplyBtn,
  } = elements;

  const table = stockGatherTable || document.getElementById("stockGatherTable");
  if (table && !table.dataset.bound) {
    table.addEventListener("change", (e) => {
      const input = e.target.closest(".stock-gather-input");
      if (!input) return;
      const ingId = input.dataset.ingId;
      const idx = input.dataset.index;
      const aggregated = parseAdditiveValue(input.value);
      setStockGatherRate(ingId, idx, aggregated);
      clearStockPlanResults();
    });
    table.dataset.bound = "1";
  }

  if (stockBagCapacity && !stockBagCapacity.dataset.bound) {
    stockBagCapacity.addEventListener("change", () => {
      setStockBagCapacity(stockBagCapacity.value);
    });
    stockBagCapacity.dataset.bound = "1";
  }

  if (stockBaseMeals && !stockBaseMeals.dataset.bound) {
    stockBaseMeals.addEventListener("change", () => {
      setStockBaseMeals(stockBaseMeals.value);
    });
    stockBaseMeals.dataset.bound = "1";
  }

  if (stockIsland && !stockIsland.dataset.bound) {
    stockIsland.addEventListener("change", () => {
      setStockIslandType(stockIsland.value);
    });
    stockIsland.dataset.bound = "1";
  }

  if (stockEvent && !stockEvent.dataset.bound) {
    stockEvent.addEventListener("change", () => {
      setStockEventType(stockEvent.value);
    });
    stockEvent.dataset.bound = "1";
  }

  if (stockExcludeMax && !stockExcludeMax.dataset.bound) {
    stockExcludeMax.addEventListener("change", () => {
      setStockExcludeMax(stockExcludeMax.checked);
    });
    stockExcludeMax.dataset.bound = "1";
  }

  if (stockDistribute && !stockDistribute.dataset.bound) {
    stockDistribute.addEventListener("change", () => {
      setStockDistribute(stockDistribute.checked);
    });
    stockDistribute.dataset.bound = "1";
  }

  const categoryCheckboxes = Array.from(
    document.querySelectorAll(".stock-category-checkbox"),
  );

  categoryCheckboxes.forEach((checkbox) => {
    if (!checkbox || checkbox.dataset.bound) return;
    checkbox.addEventListener("change", () => {
      const selected = categoryCheckboxes.filter((cb) => cb?.checked).map((cb) => cb.value);
      if (!selected.length) {
        alert("カテゴリは最低1つ選択してください。");
        checkbox.checked = true;
        syncStockPlanControls();
        return;
      }
      setStockCookingCategories(selected);
    });
    checkbox.dataset.bound = "1";
  });

  const exportBtn = document.getElementById("exportStockGatherBtn");
  const importBtn = document.getElementById("importStockGatherBtn");
  const textArea = document.getElementById("stockGatherText");

  if (exportBtn && textArea && !exportBtn.dataset.bound) {
    exportBtn.addEventListener("click", () => {
      const text = serializeStockGatherConfig();
      textArea.value = text;
      textArea.focus();
      textArea.select();
      writeToClipboard(text);
    });
    exportBtn.dataset.bound = "1";
  }

  if (importBtn && textArea && !importBtn.dataset.bound) {
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
    importBtn.dataset.bound = "1";
  }

  const calcBtn = stockCalcBtn || document.getElementById("calcStockPlanBtn");
  if (calcBtn && !calcBtn.dataset.bound) {
    calcBtn.addEventListener("click", () => {
      if (calcBtn.disabled) return;
      setStockCalcLoading(true);
      setTimeout(() => {
        try {
          const result = calculateStockPlan();
          renderStockPlanResults(result);
        } catch (err) {
          console.error("Stock plan calculation failed", err);
          alert(`備蓄プランの計算に失敗しました: ${err?.message || err}`);
        } finally {
          setStockCalcLoading(false);
        }
      }, 0);
    });
    calcBtn.dataset.bound = "1";
  }

  if (stockApplyBtn && !stockApplyBtn.dataset.bound) {
    stockApplyBtn.addEventListener("click", () => {
      applyStockPlanToNext();
    });
    stockApplyBtn.dataset.bound = "1";
  }

  syncStockPlanControls();
  renderStockGatherTable();
  renderStockPlanResults();
  setStockCalcLoading(false);
}
