// js/logic/recommendation.js
// おすすめレシピ用の判定ロジックを切り出したヘルパー

/**
 * 今週の料理で使用している食材ID集合を取得する。
 * @param {Array<{recipe:string, qty:number}>} chosen
 * @param {(id:string) => {needs?:Record<string,number>}|null} findRecipeById
 * @returns {Set<string>}
 */
export function collectThisWeekIngredientIds(chosen = [], findRecipeById) {
  const ids = new Set();
  for (const ch of chosen) {
    const qty = Number(ch?.qty) || 0;
    if (qty <= 0) continue;
    const recipe = findRecipeById?.(ch.recipe);
    if (!recipe?.needs) continue;
    for (const ingId of Object.keys(recipe.needs)) ids.add(ingId);
  }
  return ids;
}

/**
 * 数量が 0 より大きい料理だけを対象に recipe ID の集合を作る。
 * @param {Array<{recipe:string, qty:number}>} chosen
 * @returns {Set<string>}
 */
export function buildChosenRecipeSet(chosen = []) {
  return new Set(
    chosen
      .filter(ch => (Number(ch?.qty) || 0) > 0)
      .map(ch => ch.recipe)
  );
}
