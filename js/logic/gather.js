// js/logic/gather.js
// 食材集め能力（24時間あたりの個数）入力支援ヘルパー

export const GATHER_COLUMNS = 3;

export function normalizeGatherValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

export function normalizeGatherArray(values, columns = GATHER_COLUMNS) {
  const arr = Array(columns).fill(0);
  if (!Array.isArray(values)) return arr;
  values.forEach((val, idx) => {
    if (idx < columns) {
      arr[idx] = normalizeGatherValue(val);
    }
  });
  return arr;
}
