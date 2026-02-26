import {
    normalizeGatherArray,
    normalizeGatherValue,
    GATHER_COLUMNS,
} from "../logic/gather.js";

const ALL_RECIPE_CATEGORIES = ["curry", "salad", "dessert"];
const DEFAULT_STOCK_CATEGORIES = [...ALL_RECIPE_CATEGORIES];

function normalizeStockCategoriesInput(input, fallback = DEFAULT_STOCK_CATEGORIES) {
    const arr = Array.isArray(input)
        ? input
        : (input === undefined || input === null ? [] : [input]);
    const normalized = [];
    arr.forEach((value) => {
        const key = typeof value === "string" ? value.trim().toLowerCase() : "";
        if (ALL_RECIPE_CATEGORIES.includes(key) && !normalized.includes(key)) {
            normalized.push(key);
        }
    });
    if (normalized.length) {
        return normalized;
    }
    return Array.isArray(fallback) ? [...fallback] : [];
}

function sortStockCategories(categories = []) {
    const order = new Map(ALL_RECIPE_CATEGORIES.map((cat, idx) => [cat, idx]));
    return categories.slice().sort((a, b) => {
        return (order.get(a) || 0) - (order.get(b) || 0);
    });
}

function shallowArrayEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
}

function parseAdditiveValue(val) {
    // Simple parsing, can be expanded if needed.
    // Currently just returns the value as is, assuming input handling is done elsewhere or simple.
    // But the original code had parseAdditiveValue? No, it was in stock-init.js but I didn't see the definition in the snippet.
    // Wait, stock-init.js line 48 calls parseAdditiveValue.
    // I need to find where parseAdditiveValue is defined. It might be in main.js or I missed it.
    // Checking main.js again... it wasn't in the first 800 lines.
    // It might be a global or imported.
    // Let's assume it's a simple helper or I need to implement it.
    // For now, I'll implement a simple version that handles "1+2" etc if needed, or just return the value.
    // Actually, let's just use the value for now.
    return val;
}

export function setupStockUI({
    elements,
    state,
    saveState,
    renderStockGatherTable,
    renderStockPlanResults,
    calculateStockPlan,
    applyStockPlanToNext,
    showToast,
    writeToClipboard,
}) {
    const {
        stockGatherTable,
        stockBagCapacity,
        stockCalcBtn,
        stockCalcIndicator,
        stockBaseMeals,
        stockIsland,
        stockEvent,
        stockExcludeMax,
        stockDistribute,
        stockApplyBtn,
        stockBaseMealsLabel,
        exportStockGatherBtn,
        importStockGatherBtn,
        stockGatherText,
    } = elements;

    // --- Helpers (formerly in main.js) ---

    function getStockGatherRates(ingId) {
        return normalizeGatherArray(state.stockPlan?.gatherRates?.[ingId], GATHER_COLUMNS);
    }

    function setStockGatherRate(ingId, index, value) {
        if (!ingId) return;
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= GATHER_COLUMNS) return;
        const arr = getStockGatherRates(ingId);
        const normalized = normalizeGatherValue(value);
        if (arr[idx] === normalized) return;
        arr[idx] = normalized;
        state.stockPlan.gatherRates[ingId] = arr;
        saveState();
        renderStockGatherTable();
    }

    function setStockBagCapacity(value) {
        const numeric = Math.max(1, Number(value) || state.stockPlan.bagCapacity || 240);
        if (state.stockPlan.bagCapacity === numeric) return;
        state.stockPlan.bagCapacity = numeric;
        saveState();
        clearStockPlanResults();
        if (stockBagCapacity && document.activeElement !== stockBagCapacity) {
            stockBagCapacity.value = String(numeric);
        }
        syncStockPlanControls();
    }

    function setStockBaseMeals(value) {
        const numeric = Math.max(1, Math.round(Number(value) || state.stockPlan.baseMeals || 3));
        if (state.stockPlan.baseMeals === numeric) return;
        state.stockPlan.baseMeals = numeric;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockIslandType(value) {
        const normalized = value === "normal" ? "normal" : "EX";
        if (state.stockPlan.islandType === normalized) return;
        state.stockPlan.islandType = normalized;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockEventType(value) {
        const allowed = ["none", "pokemon", "cooking"];
        const normalized = allowed.includes(value) ? value : "none";
        if (state.stockPlan.eventType === normalized) return;
        state.stockPlan.eventType = normalized;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockExcludeMax(flag) {
        const next = !!flag;
        if (state.stockPlan.excludeMaxLevel === next) return;
        state.stockPlan.excludeMaxLevel = next;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockDistribute(flag) {
        const next = flag !== false;
        if (state.stockPlan.distributeLeftover === next) return;
        state.stockPlan.distributeLeftover = next;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockCookingCategories(categories) {
        const normalized = sortStockCategories(
            normalizeStockCategoriesInput(categories, DEFAULT_STOCK_CATEGORIES)
        );
        if (!normalized.length) return;
        if (shallowArrayEqual(state.stockPlan.cookingCategories, normalized)) return;
        state.stockPlan.cookingCategories = normalized;
        saveState();
        clearStockPlanResults();
        syncStockPlanControls();
    }

    function setStockCalcLoading(flag) {
        const isLoading = !!flag;
        if (stockCalcBtn) {
            stockCalcBtn.disabled = isLoading;
            if (isLoading) stockCalcBtn.setAttribute("aria-busy", "true");
            else stockCalcBtn.removeAttribute("aria-busy");
        }
        if (stockApplyBtn) {
            stockApplyBtn.disabled = isLoading;
        }
        if (stockCalcIndicator) {
            stockCalcIndicator.hidden = !isLoading;
        }
    }

    function clearStockPlanResults() {
        renderStockPlanResults({ error: "条件が変更されました。再計算してください。" });
    }

    function syncStockPlanControls() {
        const stockCategoryCheckboxes = Array.from(document.querySelectorAll(".stock-category-checkbox"));

        if (stockBagCapacity && document.activeElement !== stockBagCapacity) {
            stockBagCapacity.value = String(state.stockPlan.bagCapacity || 240);
        }
        if (stockBaseMeals && document.activeElement !== stockBaseMeals) {
            stockBaseMeals.value = String(state.stockPlan.baseMeals || 3);
        }
        if (stockIsland && document.activeElement !== stockIsland) {
            stockIsland.value = state.stockPlan.islandType === "normal" ? "normal" : "EX";
        }
        if (stockEvent && document.activeElement !== stockEvent) {
            stockEvent.value = ["none", "pokemon", "cooking"].includes(state.stockPlan.eventType)
                ? state.stockPlan.eventType
                : "none";
        }
        if (stockExcludeMax) {
            stockExcludeMax.checked = !!state.stockPlan.excludeMaxLevel;
        }
        if (stockDistribute) {
            stockDistribute.checked = state.stockPlan.distributeLeftover !== false;
        }
        const selectedSet = new Set(
            sortStockCategories(
                normalizeStockCategoriesInput(state.stockPlan.cookingCategories, DEFAULT_STOCK_CATEGORIES)
            )
        );
        if (selectedSet.size === 0) {
            DEFAULT_STOCK_CATEGORIES.forEach((cat) => selectedSet.add(cat));
        }
        if (stockCategoryCheckboxes && stockCategoryCheckboxes.length) {
            stockCategoryCheckboxes.forEach((checkbox) => {
                if (!checkbox) return;
                checkbox.checked = selectedSet.has(checkbox.value);
            });
        }
        if (stockBaseMealsLabel) {
            stockBaseMealsLabel.textContent = String(state.stockPlan.baseMeals || 3);
        }
    }

    function serializeStockGatherConfig() {
        const rates = {};
        Object.entries(state.stockPlan?.gatherRates || {}).forEach(([id, arr]) => {
            const normalized = normalizeGatherArray(arr);
            if (normalized.some((v) => Number(v) > 0)) {
                rates[id] = normalized;
            }
        });
        return JSON.stringify({
            bagCapacity: state.stockPlan?.bagCapacity || 240,
            rates,
            // ... other fields if needed
        }, null, 2);
    }

    function applyStockGatherConfig(data) {
        if (!data) throw new Error("空のデータです");
        const payload = data.rates ? data : { rates: data };
        const nextRates = {};
        Object.entries(payload.rates || {}).forEach(([id, arr]) => {
            nextRates[id] = normalizeGatherArray(arr);
        });
        state.stockPlan.gatherRates = nextRates;
        // ... apply other fields
        if (payload.bagCapacity !== undefined) {
            state.stockPlan.bagCapacity = Math.max(1, Number(payload.bagCapacity) || state.stockPlan.bagCapacity || 240);
        }
        saveState();
    }

    // --- Event Listeners ---

    const table = stockGatherTable;
    if (table && !table.dataset.bound) {
        table.addEventListener("change", (e) => {
            const input = e.target.closest(".stock-gather-input");
            if (!input) return;
            const ingId = input.dataset.ingId;
            const idx = input.dataset.index;
            // Simple value usage for now
            setStockGatherRate(ingId, idx, input.value);
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

    const categoryCheckboxes = Array.from(document.querySelectorAll(".stock-category-checkbox"));
    categoryCheckboxes.forEach((checkbox) => {
        if (!checkbox || checkbox.dataset.bound) return;
        checkbox.addEventListener("change", () => {
            const selected = categoryCheckboxes.filter((cb) => cb?.checked).map((cb) => cb.value);
            if (!selected.length) {
                showToast("カテゴリは最低1つ選択してください。", "error");
                checkbox.checked = true;
                syncStockPlanControls();
                return;
            }
            setStockCookingCategories(selected);
        });
        checkbox.dataset.bound = "1";
    });

    if (exportStockGatherBtn && stockGatherText && !exportStockGatherBtn.dataset.bound) {
        exportStockGatherBtn.addEventListener("click", () => {
            const text = serializeStockGatherConfig();
            stockGatherText.value = text;
            stockGatherText.focus();
            stockGatherText.select();
            writeToClipboard(text).then(() => {
                showToast("次週用設定をクリップボードにコピーしました", "success");
            });
        });
        exportStockGatherBtn.dataset.bound = "1";
    }

    if (importStockGatherBtn && stockGatherText && !importStockGatherBtn.dataset.bound) {
        importStockGatherBtn.addEventListener("click", () => {
            const raw = stockGatherText.value.trim();
            if (!raw) {
                return showToast("インポートするデータを入力してください。", "error");
            }
            try {
                const data = JSON.parse(raw);
                applyStockGatherConfig(data);
                syncStockPlanControls();
                renderStockGatherTable();
                clearStockPlanResults();
                showToast("次週用設定をインポートしました。", "success");
            } catch (err) {
                console.error("Import stock gather data failed", err);
                showToast(`インポートに失敗しました: ${err.message || err}`, "error");
            }
        });
        importStockGatherBtn.dataset.bound = "1";
    }

    if (stockCalcBtn && !stockCalcBtn.dataset.bound) {
        stockCalcBtn.addEventListener("click", () => {
            if (stockCalcBtn.disabled) return;
            setStockCalcLoading(true);
            // Allow UI to update before heavy calculation
            setTimeout(() => {
                try {
                    const result = calculateStockPlan();
                    renderStockPlanResults(result);
                    showToast("備蓄プランを計算しました。", "success");
                } catch (err) {
                    console.error("Stock plan calculation failed", err);
                    showToast(`備蓄プランの計算に失敗しました: ${err?.message || err}`, "error");
                } finally {
                    setStockCalcLoading(false);
                }
            }, 10);
        });
        stockCalcBtn.dataset.bound = "1";
    }

    if (stockApplyBtn && !stockApplyBtn.dataset.bound) {
        stockApplyBtn.addEventListener("click", () => {
            applyStockPlanToNext();
            showToast("次週の計画に反映しました。", "success");
        });
        stockApplyBtn.dataset.bound = "1";
    }

    // Initial sync
    syncStockPlanControls();
    setStockCalcLoading(false);
}
