import {
    normalizeLevel,
    normalizePercent,
    normalizeMultiplier,
} from "../logic/energy.js";

function serializeRecipeLevels(state) {
    const levels = state.energyConfig?.levels || {};
    const payload = { levels: {} };
    Object.entries(state.data?.recipes || {}).forEach(([_, list]) => {
        (list || []).forEach((recipe) => {
            const normalized = normalizeLevel(levels?.[recipe.id] ?? 0);
            if (normalized > 0) payload.levels[recipe.id] = normalized;
        });
    });
    return JSON.stringify(payload, null, 2);
}

function applyRecipeLevelsData(input, state, saveState) {
    if (!input) throw new Error("空のデータです");
    const payload = input.levels ? input : { levels: input };
    if (!payload.levels || typeof payload.levels !== "object") {
        throw new Error("levels オブジェクトが見つかりません");
    }
    const next = { ...(state.energyConfig.levels || {}) };
    Object.entries(payload.levels).forEach(([id, value]) => {
        const normalized = normalizeLevel(value);
        if (normalized > 0) next[id] = normalized;
    });
    state.energyConfig.levels = next;
    saveState();
}

export function setupEnergyUI({
    elements,
    state,
    saveState,
    renderEnergyTable,
    clearProposalResults,
    getCurrentCategory,
    showToast,
    writeToClipboard,
}) {
    const {
        energyExportBtn,
        energyImportBtn,
        energyLevelsText,
        suggestFieldBonus,
        suggestEventBonus,
        energyTable,
    } = elements;

    // Export
    if (energyExportBtn && energyLevelsText) {
        energyExportBtn.addEventListener("click", () => {
            const text = serializeRecipeLevels(state);
            energyLevelsText.value = text;
            energyLevelsText.focus();
            energyLevelsText.select();
            writeToClipboard(text).then(() => {
                showToast("レシピレベル設定をクリップボードにコピーしました", "success");
            });
        });
    }

    // Import
    if (energyImportBtn && energyLevelsText) {
        energyImportBtn.addEventListener("click", () => {
            const raw = energyLevelsText.value.trim();
            if (!raw) {
                return showToast("インポートするデータを入力してください", "error");
            }
            try {
                const data = JSON.parse(raw);
                applyRecipeLevelsData(data, state, saveState);
                renderEnergyTable(getCurrentCategory(true));
                clearProposalResults();
                showToast("レシピレベル設定をインポートしました", "success");
            } catch (err) {
                console.error(err);
                showToast(`インポートに失敗しました: ${err.message}`, "error");
            }
        });
    }

    // Field Bonus Input
    if (suggestFieldBonus) {
        suggestFieldBonus.addEventListener("change", () => {
            const val = suggestFieldBonus.value;
            const normalized = normalizePercent(val);

            // Sync both configs
            if (state.energyConfig.fieldBonusPercent === normalized && state.suggestConfig.fieldBonusPercent === normalized) return;

            state.energyConfig.fieldBonusPercent = normalized;
            state.suggestConfig.fieldBonusPercent = normalized;
            saveState();

            renderEnergyTable(getCurrentCategory(true));
            clearProposalResults();
        });
    }

    // Event Bonus Input
    if (suggestEventBonus) {
        suggestEventBonus.addEventListener("change", () => {
            const val = suggestEventBonus.value;
            const normalized = normalizeMultiplier(val);

            if (state.energyConfig.eventBonusMultiplier === normalized && state.suggestConfig.eventBonusMultiplier === normalized) return;

            state.energyConfig.eventBonusMultiplier = normalized;
            state.suggestConfig.eventBonusMultiplier = normalized;
            saveState();

            renderEnergyTable(getCurrentCategory(true));
            clearProposalResults();
        });
    }

    // Table Delegation (merged from energy-controls.js)
    const table = energyTable || document.getElementById("energyTable");
    if (table && !table.dataset.bound) {
        table.addEventListener("change", (event) => {
            const input = event.target.closest(".energy-level-input");
            if (!input) return;
            const recipeId = input.dataset.recipeId;
            const rawValue = Number(input.value);
            const normalized = Number.isFinite(rawValue) ? normalizeLevel(rawValue) : 0;
            input.value = String(normalized);

            // Update state
            const levels = state.energyConfig.levels || (state.energyConfig.levels = {});
            if (levels[recipeId] === normalized) return;
            levels[recipeId] = normalized;
            saveState();

            renderEnergyTable(getCurrentCategory(true));
            clearProposalResults();
        });
        table.dataset.bound = "1";
    }
}

export function createLevelSetter({ state, saveState, renderEnergyTable, clearProposalResults, getCurrentCategory }) {
    return function setRecipeLevel(recipeId, level) {
        if (!recipeId) return;
        const normalized = normalizeLevel(level);
        const levels = state.energyConfig.levels || (state.energyConfig.levels = {});
        if (levels[recipeId] === normalized) return;
        levels[recipeId] = normalized;
        saveState();
        renderEnergyTable(getCurrentCategory(true));
        clearProposalResults();
    };
}
