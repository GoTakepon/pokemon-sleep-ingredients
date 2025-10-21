// js/logic/weekly-totals.js
// 今週・次週の材料集計を行うヘルパー

/**
 * 今週(THIS)の材料必要量を計算する。
 * @param {Array<{recipe:string, qty:number}>} chosen
 * @param {(id:string)=>{needs?:Record<string,number>}|null} findRecipeById
 * @returns {{map: Map<string, number>, used: Set<string>}}
 */
export function computeThisWeekTotals(chosen = [], findRecipeById) {
  const map = new Map();
  const used = new Set();
  (chosen || []).forEach((item) => {
    const qty = Number(item?.qty) || 0;
    if (!qty) return;
    const recipe = findRecipeById?.(item.recipe);
    if (!recipe?.needs) return;
    Object.entries(recipe.needs).forEach(([id, need]) => {
      used.add(id);
      map.set(id, (map.get(id) || 0) + need * qty);
    });
  });
  return { map, used };
}

/**
 * 今週/次週の使用状況からテーブル表示データを構築する。
 * @param {{map:Map<string,number>, used:Set<string>}} thisTotals
 * @param {{map:Map<string,number>, used:Set<string>}} nextTotals
 * @param {{this:boolean, next:boolean}} tableFilter
 * @param {Map<string, number>} inventoryMap
 * @param {Array<{id:string, name?:string, emoji?:string}>} ingredients
 * @returns {{usedRows:Array<string>, otherRows:Array<string>, sums:{used:{cur:number,tar:number}, other:{cur:number,tar:number}}}}
 */
export function buildTableRows({
  thisTotals,
  nextTotals,
  tableFilter,
  inventoryMap,
  ingredients,
}) {
  const targetMap = new Map();
  const addAll = (source) => source?.forEach?.((value, key) => {
    targetMap.set(key, (targetMap.get(key) || 0) + value);
  });

  if (tableFilter?.this) addAll(thisTotals?.map);
  if (tableFilter?.next) addAll(nextTotals?.map);

  const usedRows = [];
  const otherRows = [];
  let sumCurU = 0;
  let sumTarU = 0;
  let sumCurO = 0;
  let sumTarO = 0;

  const usedThisSet = thisTotals?.used || new Set();
  const usedNextSet = nextTotals?.used || new Set();

  (ingredients || []).forEach((ing) => {
    const id = ing.id;
    const cur = Number(inventoryMap?.get(id) || 0);
    const tar = Number(targetMap.get(id) || 0);
    const diff = cur - tar;
    const inThis = usedThisSet.has(id);
    const inNext = usedNextSet.has(id);
    const rowCls = (inThis && inNext) ? "wk-both"
      : inThis ? "wk-this"
      : inNext ? "wk-next"
      : "";

    const rowHtml = `
      <tr class="${rowCls}">
        <td>${ing.emoji || ""} ${ing.name || id}</td>
        <td class="num">${cur}</td>
        <td class="num">${tar}</td>
        <td class="num ${diff < 0 ? "neg" : diff > 0 ? "pos" : ""}">${diff}</td>
      </tr>`;

    if (tar > 0) {
      usedRows.push(rowHtml);
      sumCurU += cur;
      sumTarU += tar;
    } else {
      otherRows.push(rowHtml);
      sumCurO += cur;
      sumTarO += tar;
    }
  });

  return {
    usedRows,
    otherRows,
    sums: {
      used: { cur: sumCurU, tar: sumTarU },
      other: { cur: sumCurO, tar: sumTarO },
    },
  };
}
