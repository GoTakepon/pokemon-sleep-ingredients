// js/ui/energy-controls.js
// エナジー計算テーブル周りのイベント初期化

function normalizeElement(ref, fallbackId) {
  if (ref) return ref;
  if (fallbackId) return document.getElementById(fallbackId);
  return null;
}

export function setupEnergyControls({
  elements = {},
  normalizeLevel,
  setRecipeLevel,
  serializeRecipeLevels,
  applyRecipeLevelsData,
  renderEnergyTable,
  writeToClipboard,
} = {}) {
  const energyTable = normalizeElement(elements.energyTable, "energyTable");
  if (energyTable && !energyTable.dataset.bound) {
    energyTable.addEventListener("change", (event) => {
      const input = event.target.closest(".energy-level-input");
      if (!input) return;
      const recipeId = input.dataset.recipeId;
      const normalized = normalizeLevel?.(input.value) ?? Number(input.value) || 0;
      input.value = String(normalized);
      setRecipeLevel?.(recipeId, normalized);
    });
    energyTable.dataset.bound = "1";
  }

  const exportBtn = normalizeElement(elements.energyExportBtn, "exportRecipeLevelsBtn");
  const importBtn = normalizeElement(elements.energyImportBtn, "importRecipeLevelsBtn");
  const textArea = normalizeElement(elements.energyLevelsText, "recipeLevelsText");

  if (exportBtn && textArea && !exportBtn.dataset.bound) {
    exportBtn.addEventListener("click", () => {
      const text = serializeRecipeLevels?.() ?? "";
      textArea.value = text;
      textArea.focus();
      textArea.select();
      writeToClipboard?.(text);
    });
    exportBtn.dataset.bound = "1";
  }

  if (importBtn && textArea && !importBtn.dataset.bound) {
    importBtn.addEventListener("click", () => {
      const raw = textArea.value.trim();
      if (!raw) {
        alert("インポートするデータを入力してください。\nエクスポートボタンで取得したJSONを貼り付けます。");
        return;
      }
      try {
        const data = JSON.parse(raw);
        applyRecipeLevelsData?.(data);
        renderEnergyTable?.();
        alert("レシピレベルをインポートしました。");
      } catch (err) {
        console.error("Import recipe levels failed", err);
        alert(`インポートに失敗しました: ${err?.message || err}`);
      }
    });
    importBtn.dataset.bound = "1";
  }
}
