import { computeFinalEnergy } from "./energy.js";
import { computeIngredientHours as computeIngredientHoursLogic, GATHER_COLUMNS, normalizeGatherArray } from "./gather.js";
import { CATEGORY_LABELS } from "../constants.js";

// Move constants to a shared file or just duplicate/accept as arg.
// For now, I'll accept CATEGORY_LABELS or just use the keys if labels not needed for calculation (labels are for UI).
// getAllRecipeEnergyStats adds categoryLabel.

export function computeIngredientHours(ingId, needQty, {
    usePokemonCount = true,
    pokemonCount = 0, // Default 0 if not provided, but caller should provide
    gatherRates = {}, // Map of ingId -> rates array
    normalizePokemonCount = (v) => v,
} = {}) {
    const rates = normalizeGatherArray(gatherRates[ingId], GATHER_COLUMNS);
    return computeIngredientHoursLogic({
        needQty,
        rates,
        usePokemonCount,
        pokemonCount,
        normalizePokemonCount,
    });
}

export function computeRecipeEnergyStats(recipe, {
    level,
    fieldBonusPercent,
    eventBonusMultiplier,
    usePokemonCount = false,
    pokemonCount = 0,
    potCapacity = null,
    gatherRates = {},
    normalizePokemonCount = (v) => v,
} = {}) {
    const finalEnergy = computeFinalEnergy({
        baseEnergy: recipe.energy,
        level,
        fieldBonusPercent,
        eventBonusMultiplier,
    });

    if (potCapacity && Number(recipe.total || 0) > potCapacity) {
        return {
            finalEnergy,
            hoursRequired: Number.POSITIVE_INFINITY,
            ingredientHoursRequired: Number.POSITIVE_INFINITY,
            energyPerHour: null,
            overflow: true,
        };
    }

    let totalHoursRequired = 0;
    let ingredientHoursRequired = 0;
    let ingredientShareHours = 0;
    let assistShareHours = 0;
    let totalHoursInfinite = false;
    let ingredientHoursInfinite = false;
    let shareInvalid = false;

    for (const [ingId, qty] of Object.entries(recipe.needs || {})) {
        const need = Number(qty) || 0;
        const baseResult = computeIngredientHours(ingId, need, {
            usePokemonCount: false, // Base calculation doesn't use pokemon count for "hours per ingredient" in this context?
            // Wait, original main.js: computeIngredientHours(ingId, need, { usePokemonCount: false });
            // So it ignores pokemon count for the base calculation loop?
            // Yes.
            gatherRates,
            normalizePokemonCount,
        });

        const totalHours = baseResult?.totalHours;
        const ingredientHours = baseResult?.ingredientHours;
        const baseTotalDaily = baseResult?.totalDailyRate;
        const baseIngredientDaily = baseResult?.ingredientDailyRate;
        const baseAssistDaily = baseResult?.assistDailyRate;

        if (!Number.isFinite(totalHours)) {
            totalHoursInfinite = true;
        } else if (!totalHoursInfinite) {
            totalHoursRequired += totalHours;
        }

        if (!Number.isFinite(ingredientHours)) {
            ingredientHoursInfinite = true;
        } else if (!ingredientHoursInfinite) {
            ingredientHoursRequired += ingredientHours;
        }

        if (
            Number.isFinite(totalHours) &&
            Number.isFinite(baseTotalDaily) &&
            baseTotalDaily > 0 &&
            Number.isFinite(baseIngredientDaily) &&
            Number.isFinite(baseAssistDaily)
        ) {
            const ingredientRatio = Math.max(0, Math.min(1, baseIngredientDaily / baseTotalDaily));
            const assistRatio = Math.max(0, Math.min(1, baseAssistDaily / baseTotalDaily));
            const shareHours = totalHours;
            ingredientShareHours += shareHours * ingredientRatio;
            assistShareHours += shareHours * assistRatio;
        } else {
            shareInvalid = true;
        }
    }

    if (totalHoursInfinite) {
        totalHoursRequired = Number.POSITIVE_INFINITY;
        ingredientShareHours = Number.POSITIVE_INFINITY;
        assistShareHours = Number.POSITIVE_INFINITY;
    }

    if (ingredientHoursInfinite) {
        ingredientHoursRequired = Number.POSITIVE_INFINITY;
    }

    const energyPerHour = (Number.isFinite(totalHoursRequired) && totalHoursRequired > 0)
        ? finalEnergy / totalHoursRequired
        : null;

    return {
        finalEnergy,
        hoursRequired: totalHoursRequired,
        ingredientHoursRequired,
        ingredientShareHours: !shareInvalid ? ingredientShareHours : Number.POSITIVE_INFINITY,
        assistShareHours: !shareInvalid ? assistShareHours : Number.POSITIVE_INFINITY,
        energyPerHour,
    };
}

export function getAllRecipeEnergyStats({
    recipes = {}, // state.data.recipes
    levels = {}, // state.energyConfig.levels
    fieldBonusPercent = 0,
    eventBonusMultiplier = 1,
    gatherRates = {},
    categoryFilter = null,
    usePokemonCount = false,
    pokemonCount = 0,
    potCapacity = null,
    excludeMaxLevel = false,
    maxLevel = 65,
    excludeOverPot = false,
    normalizeLevel = (v) => v,
    normalizePokemonCount = (v) => v,
    CATEGORY_LABELS = {},
} = {}) {
    const stats = [];
    Object.entries(recipes).forEach(([catKey, list]) => {
        if (categoryFilter && catKey !== categoryFilter) return;
        (list || []).forEach((recipe) => {
            const level = normalizeLevel(levels[recipe.id] ?? 0);
            if (excludeMaxLevel && level >= maxLevel) return;

            const calc = computeRecipeEnergyStats(recipe, {
                level,
                fieldBonusPercent,
                eventBonusMultiplier,
                usePokemonCount,
                pokemonCount,
                potCapacity: excludeOverPot ? potCapacity : null,
                gatherRates,
                normalizePokemonCount,
            });

            stats.push({
                id: recipe.id,
                title: recipe.title,
                categoryKey: catKey,
                categoryLabel: CATEGORY_LABELS[catKey] || catKey,
                recipe,
                ...calc,
            });
        });
    });
    return stats;
}
