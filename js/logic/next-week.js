// js/logic/next-week.js
// 次週（NEXT）料理の目標材料数を集計するヘルパー

/**
 * 次週の材料需要を計算する。
 * @param {{CURRY:Array, SALAD:Array, SWEETS:Array, extra:Array}} nwState
 * @param {Record<string, Array<{id:string, needs?:Record<string,number>}>>} recipesByCat
 * @param {Array<{id:string, name?:string, emoji?:string}>} ingredients
 * @returns {Record<string, {ingId:string, name:string, emoji:string, qty:number}>}
 */
export function computeNextWeekTotals(nwState = {}, recipesByCat = {}, ingredients = []) {
  const byKey = { CURRY: "curry", SALAD: "salad", SWEETS: "dessert" };

  const sumCat = (catKey, arr) => {
    const list = recipesByCat[catKey] || [];
    const rmap = new Map(list.map((r) => [r.id, r]));
    const acc = {};
    (arr || []).forEach(({ recipe, qty }) => {
      const r = rmap.get(recipe);
      const q = Number(qty) || 0;
      if (!r || !q) return;
      Object.entries(r.needs || {}).forEach(([ingId, need]) => {
        acc[ingId] = (acc[ingId] || 0) + need * q;
      });
    });
    return acc;
  };

  const catTotals = {
    CURRY: sumCat(byKey.CURRY, nwState.CURRY),
    SALAD: sumCat(byKey.SALAD, nwState.SALAD),
    SWEETS: sumCat(byKey.SWEETS, nwState.SWEETS),
  };

  const merged = {};
  for (const cat of ["CURRY", "SALAD", "SWEETS"]) {
    for (const [id, q] of Object.entries(catTotals[cat])) {
      merged[id] = Math.max(merged[id] || 0, q);
    }
  }

  (nwState.extra || []).forEach(({ ingId, qty }) => {
    const q = Number(qty) || 0;
    if (q > 0) merged[ingId] = (merged[ingId] || 0) + q;
  });

  const out = {};
  ingredients.forEach((meta) => {
    const qty = Number(merged[meta.id]) || 0;
    if (qty <= 0) return;
    out[meta.id] = {
      ingId: meta.id,
      name: meta.name || meta.id,
      emoji: meta.emoji || "",
      qty,
    };
    delete merged[meta.id];
  });

  // ingredients に存在しない id が merged に残っている場合
  Object.entries(merged).forEach(([id, qty]) => {
    if ((Number(qty) || 0) <= 0) return;
    if (!out[id]) {
      out[id] = { ingId: id, name: id, emoji: "", qty: Number(qty) || 0 };
    }
  });

  return out;
}
