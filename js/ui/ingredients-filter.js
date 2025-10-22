import { state as defaultState } from "../state/store.js";

export function setupIngredientsFilter({ stateRef = defaultState, renderTables } = {}) {
  const cThis = document.getElementById('chkThisWeek');
  const cNext = document.getElementById('chkNextWeek');

  const tableState = stateRef || {};
  const previousFilter = tableState.tableFilter || {};
  tableState.tableFilter = {
    this: cThis ? !!cThis.checked : (previousFilter.this ?? true),
    next: cNext ? !!cNext.checked : (previousFilter.next ?? true),
  };

  if (cThis) {
    cThis.addEventListener('change', () => {
      tableState.tableFilter.this = cThis.checked;
      renderTables?.();
    });
  }

  if (cNext) {
    cNext.addEventListener('change', () => {
      tableState.tableFilter.next = cNext.checked;
      renderTables?.();
    });
  }
}
