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

    if (cat) {
        cat.addEventListener("change", () => buildRecipeOptions(cat.value));
    }
    if (globalCat) {
        globalCat.addEventListener("change", () => buildRecipeOptions(globalCat.value));
    }
    if (rec) {
        rec.addEventListener("change", () => {
            // Note: buildingRecipeOptions check was in main.js, assuming it's handled or not needed if we don't trigger change programmatically in a loop
            addRecipeById(rec.value);
        });
    }
}
