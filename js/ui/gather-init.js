// js/ui/gather-init.js
// 「今週料理提案」タブの初期化ロジック

/**
 * 食材集め関連 UI の初期化をまとめたセットアップ関数。
 * 必要なコールバックを外部から受け取ることで、main.js からロジックを分離している。
 */
export function setupGatherUI({
  elements,
  state,
  save,
  maxGatherSlots,
  syncSuggestControls,
  toggleSuggestCustomInputs,
  normalizeGatherValue,
  setGatherRate,
  setSuggestEventType,
  setSuggestEc,
  setSuggestIsland,
  setFieldBonusPercent,
  setEventBonusMultiplier,
  setSuggestBonusPreset,
  serializeGatherConfig,
  writeToClipboard,
  applyGatherConfig,
  renderGatherTable,
  renderEnergyTable,
  renderProposalResults,
  clearProposalResults,
  getAllRecipeEnergyStats,
  computeBestRecipeCombos,
  applyProposalCombo,
  getCategory,
}) {
  const getActiveCategory = () => {
    if (typeof getCategory === "function") {
      return getCategory();
    }
    return cat?.value || null;
  };

  const parseAdditiveValue = (raw) => {
    if (raw === null || raw === undefined) return raw;
    if (typeof raw === "number") return raw;
    const str = String(raw).trim();
    if (!str) return raw;
    const normalized = str.replace(/＋/g, "+");
    if (!normalized.includes("+")) return raw;
    const parts = normalized.split("+");
    let sum = 0;
    for (const part of parts) {
      const num = Number(part.trim());
      if (!Number.isFinite(num)) return raw;
      sum += num;
    }
    return sum;
  };

  const {
    gatherTable,
    suggestEvent,
    suggestEventCustom,
    suggestEc,
    suggestIsland,
    suggestFieldBonus,
    suggestEventBonus,
    suggestBonusSelect,
    potCapacity,
    excludeMaxLevel,
    excludeOverPot,
    cat,
  } = elements;

  const table = gatherTable || document.getElementById("gatherTable");
  syncSuggestControls();

  if (table && !table.dataset.bound) {
    table.addEventListener("change", (e) => {
      const input = e.target.closest(".gather-input");
      if (!input) return;
      const ingId = input.dataset.ingId;
      const idx = input.dataset.index;
      const aggregated = parseAdditiveValue(input.value);
      const normalized = normalizeGatherValue(aggregated);
      input.value = String(normalized);
      setGatherRate(ingId, idx, normalized);
    });
    table.dataset.bound = "1";
  }

  if (suggestEvent && !suggestEvent.dataset.bound) {
    suggestEvent.addEventListener("change", () => {
      setSuggestEventType(suggestEvent.value);
    });
    suggestEvent.dataset.bound = "1";
  }

  if (suggestEventCustom && !suggestEventCustom.dataset.bound) {
    suggestEventCustom.addEventListener("input", () => {
      state.suggestConfig.eventCustom = suggestEventCustom.value;
      if (state.suggestConfig.eventType !== "custom") {
        setSuggestEventType("custom");
      } else {
        save();
        clearProposalResults();
        syncSuggestControls();
      }
    });
    suggestEventCustom.dataset.bound = "1";
  }

  if (suggestEc && !suggestEc.dataset.bound) {
    suggestEc.addEventListener("change", () => {
      setSuggestEc(suggestEc.value);
    });
    suggestEc.dataset.bound = "1";
  }

  if (suggestIsland && !suggestIsland.dataset.bound) {
    suggestIsland.addEventListener("change", () => {
      setSuggestIsland(suggestIsland.value);
    });
    suggestIsland.dataset.bound = "1";
  }

  if (suggestFieldBonus && !suggestFieldBonus.dataset.bound) {
    suggestFieldBonus.addEventListener("change", () => {
      setFieldBonusPercent(suggestFieldBonus.value);
    });
    suggestFieldBonus.dataset.bound = "1";
  }

  if (suggestEventBonus && !suggestEventBonus.dataset.bound) {
    suggestEventBonus.addEventListener("change", () => {
      setEventBonusMultiplier(suggestEventBonus.value);
    });
    suggestEventBonus.dataset.bound = "1";
  }

  if (suggestBonusSelect && !suggestBonusSelect.dataset.bound) {
    suggestBonusSelect.addEventListener("change", () => {
      setSuggestBonusPreset(suggestBonusSelect.value);
    });
    suggestBonusSelect.dataset.bound = "1";
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

  const gatherExportBtn = document.getElementById("exportGatherRatesBtn");
  const gatherImportBtn = document.getElementById("importGatherRatesBtn");
  const gatherTextArea = document.getElementById("gatherRatesText");

  if (gatherExportBtn && gatherTextArea && !gatherExportBtn.dataset.bound) {
    gatherExportBtn.addEventListener("click", () => {
      const text = serializeGatherConfig();
      gatherTextArea.value = text;
      gatherTextArea.focus();
      gatherTextArea.select();
      writeToClipboard(text);
    });
    gatherExportBtn.dataset.bound = "1";
  }

  if (gatherImportBtn && gatherTextArea && !gatherImportBtn.dataset.bound) {
    gatherImportBtn.addEventListener("click", () => {
      const raw = gatherTextArea.value.trim();
      if (!raw) {
        alert("インポートするデータを入力してください。");
        return;
      }
      try {
        const payload = JSON.parse(raw);
      applyGatherConfig(payload);
      renderGatherTable();
      renderEnergyTable(getActiveCategory());
      clearProposalResults();
      alert("食材集め能力をインポートしました。");
    } catch (err) {
      console.error("Import gather rates failed", err);
      alert(`インポートに失敗しました: ${err.message || err}`);
      }
    });
    gatherImportBtn.dataset.bound = "1";
  }

  if (potCapacity && !potCapacity.dataset.bound) {
    potCapacity.value = String(state.potCapacity || 69);
    potCapacity.addEventListener("change", () => {
      const val = Math.max(1, Number(potCapacity.value) || 69);
      state.potCapacity = val;
      save();
      clearProposalResults();
    });
    potCapacity.dataset.bound = "1";
  }

  if (excludeMaxLevel && !excludeMaxLevel.dataset.bound) {
    excludeMaxLevel.checked = !!state.excludeMaxLevel;
    excludeMaxLevel.addEventListener("change", () => {
      state.excludeMaxLevel = !!excludeMaxLevel.checked;
      save();
      clearProposalResults();
    });
    excludeMaxLevel.dataset.bound = "1";
  }

  if (excludeOverPot && !excludeOverPot.dataset.bound) {
    excludeOverPot.checked = !!state.excludeOverPot;
    excludeOverPot.addEventListener("change", () => {
      state.excludeOverPot = !!excludeOverPot.checked;
      save();
      clearProposalResults();
    });
    excludeOverPot.dataset.bound = "1";
  }

  const calcBtn = document.getElementById("calcRecipeProposalsBtn");
  if (calcBtn && !calcBtn.dataset.bound) {
    calcBtn.addEventListener("click", () => {
      clearProposalResults("計算中...");
      const category = getActiveCategory();
      const potLimit = state.excludeOverPot ? state.potCapacity : null;
      const results = [];

      for (let slot = 1; slot <= maxGatherSlots; slot += 1) {
        const stats = getAllRecipeEnergyStats({
          categoryFilter: category,
          usePokemonCount: true,
          pokemonCount: slot,
          potCapacity: potLimit,
          excludeMaxLevel: state.excludeMaxLevel,
        });

        const combos = computeBestRecipeCombos(stats, {
          pokemonCount: slot,
          maxHours: 24,
          maxMeals: 3,
          maxResults: 1,
          potCapacity: potLimit,
          excludeMaxLevel: state.excludeMaxLevel,
        });

        const best = combos && combos[0]
          ? { ...combos[0], recipes: (combos[0].recipes || []).map((r) => ({ ...r })) }
          : null;

        results.push({ slot, combo: best });
      }

      renderProposalResults(results);
    });
    calcBtn.dataset.bound = "1";
  }

  const proposalsContainer = document.getElementById("proposalResults");
  if (proposalsContainer && !proposalsContainer.dataset.applyBound) {
    proposalsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".proposal-apply-btn");
      if (!btn) return;
      applyProposalCombo(btn.dataset.index);
    });
    proposalsContainer.dataset.applyBound = "1";
  }
}
