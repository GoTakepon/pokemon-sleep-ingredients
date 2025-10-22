import { state as defaultState } from "../state/store.js";

const STORAGE_KEY = "tableFilter";

function resolveStorage(explicitStorage) {
  if (explicitStorage) return explicitStorage;
  try {
    return globalThis.localStorage;
  } catch (err) {
    return null;
  }
}

function readStoredFilter(storage, fallback) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        this: parsed.this !== undefined ? !!parsed.this : fallback.this,
        next: parsed.next !== undefined ? !!parsed.next : fallback.next,
      };
    }
  } catch (err) {
    console.warn("[tableFilter] parse failed:", err);
  }
  return fallback;
}

function persistFilter(storage, filter) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      this: !!filter.this,
      next: !!filter.next,
    }));
  } catch (err) {
    console.warn("[tableFilter] persist failed:", err);
  }
}

export function setupIngredientsFilter({
  stateRef = defaultState,
  renderTables,
  storage: explicitStorage,
} = {}) {
  const cThis = document.getElementById("chkThisWeek");
  const cNext = document.getElementById("chkNextWeek");

  const tableState = stateRef || {};
  const storage = resolveStorage(explicitStorage);
  const fallback = tableState.tableFilter || {};
  const stored = readStoredFilter(storage, fallback);
  const initial = {
    this: stored.this ?? (cThis ? !!cThis.checked : true),
    next: stored.next ?? (cNext ? !!cNext.checked : true),
  };

  tableState.tableFilter = {
    this: !!initial.this,
    next: !!initial.next,
  };

  if (cThis) cThis.checked = tableState.tableFilter.this;
  if (cNext) cNext.checked = tableState.tableFilter.next;

  const triggerUpdate = () => {
    persistFilter(storage, tableState.tableFilter);
    renderTables?.();
  };

  if (cThis) {
    cThis.addEventListener("change", () => {
      tableState.tableFilter.this = cThis.checked;
      triggerUpdate();
    });
  }

  if (cNext) {
    cNext.addEventListener("change", () => {
      tableState.tableFilter.next = cNext.checked;
      triggerUpdate();
    });
  }

  // 初期化時も現状の状態を永続化しておく
  persistFilter(storage, tableState.tableFilter);
}
