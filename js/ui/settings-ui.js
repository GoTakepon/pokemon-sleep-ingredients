import { CATEGORY_TO_GROUP } from "../constants.js";

export function setupSettingsUI({
    elements,
    state,
    saveState,
    buildRecipeOptions,
    addRecipeById,
    renderEnergyTable,
    refreshViews,
}) {
    const {
        cat,
        globalCat,
        rec,
    } = elements;

    if (globalCat) {
        globalCat.addEventListener("change", () => buildRecipeOptions(globalCat.value));
    }
}
