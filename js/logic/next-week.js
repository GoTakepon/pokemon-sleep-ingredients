// js/logic/next-week.js
// 次週（NEXT）料理の目標材料数を集計するヘルパー

/**
 * 次週の材料需要を計算する。
 * @param {{CURRY:Array, SALAD:Array, SWEETS:Array, extra:Array}} nwState
 * @param {Record<string, Array<{id:string, needs?:Record<string,number>}>>} recipesByCat
 * @param {Array<{id:string, name?:string, emoji?:string}>} ingredients
 * @returns {Map<string, {ingId:string, name:string, emoji:string, qty:number}>}
 */
export function computeNextWeekTotals(nwState = {}, recipesByCat = {}, ingredients = []) {
  const byKey = { CURRY: "curry", SALAD: "salad", SWEETS: "dessert" };

  const sumCat = (catKey, arr) => {
    const list = recipesByCat[catKey] || [];
    const rmap = new Map(list.map((r) => [r.id, r]));
    const totals = new Map();
    (arr || []).forEach(({ recipe, qty }) => {
      const r = rmap.get(recipe);
      const q = Number(qty) || 0;
      if (!r || !q) return;
      Object.entries(r.needs || {}).forEach(([ingId, need]) => {
        const current = totals.get(ingId) || 0;
        totals.set(ingId, current + need * q);
      });
    });
    return totals;
  };

  const catTotals = {
    CURRY: sumCat(byKey.CURRY, nwState.CURRY),
    SALAD: sumCat(byKey.SALAD, nwState.SALAD),
    SWEETS: sumCat(byKey.SWEETS, nwState.SWEETS),
  };

  const merged = new Map();
  for (const cat of ["CURRY", "SALAD", "SWEETS"]) {
    const totals = catTotals[cat];
    totals?.forEach((qty, ingId) => {
      const current = merged.get(ingId) || 0;
      const numeric = Number(qty) || 0;
      if (numeric <= 0) return;
      merged.set(ingId, Math.max(current, numeric));
    });
  }

  (nwState.extra || []).forEach(({ ingId, qty }) => {
    const numeric = Number(qty) || 0;
    if (numeric <= 0) return;
    merged.set(ingId, (merged.get(ingId) || 0) + numeric);
  });

  const result = new Map();

  ingredients.forEach((meta) => {
    const qty = Number(merged.get(meta.id)) || 0;
    if (qty <= 0) {
      merged.delete(meta.id);
      return;
    }
    result.set(meta.id, {
      ingId: meta.id,
      name: meta.name || meta.id,
      emoji: meta.emoji || "",
      qty,
    });
    merged.delete(meta.id);
  });

  merged.forEach((qty, ingId) => {
    const numeric = Number(qty) || 0;
    if (numeric <= 0) return;
    result.set(ingId, { ingId, name: ingId, emoji: "", qty: numeric });
  });

  return result;
}
