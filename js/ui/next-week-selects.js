const noop = () => {};

export function setupNextWeekSelects({
  onAddRecipe = noop,
  renderNextChosen = noop,
  rerenderAll = null,
  renderTables = noop,
  renderSuggestionsTable = noop,
  save = noop,
  elements,
} = {}) {
  const map = {
    CURRY: elements?.CURRY ?? document.getElementById('nwRecCurry'),
    SALAD: elements?.SALAD ?? document.getElementById('nwRecSalad'),
    SWEETS: elements?.SWEETS ?? document.getElementById('nwRecSweets'),
  };

  Object.entries(map).forEach(([CAT, sel]) => {
    if (!sel) return;
    sel.addEventListener('change', () => {
      const recipeId = sel.value;
      if (!recipeId) return;
      onAddRecipe(CAT, recipeId);
      sel.selectedIndex = 0;
      renderNextChosen();
      if (typeof rerenderAll === "function") rerenderAll();
      else {
        renderTables();
        renderSuggestionsTable();
      }
      save();
    });
  });
}

export function setupNextExtraSelect({
  onAddExtra = noop,
  renderNextChosen = noop,
  rerenderAll = null,
  renderTables = noop,
  renderSuggestionsTable = noop,
  save = noop,
  element,
} = {}) {
  const sel = element ?? document.getElementById('nwExtraSelect');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const ingId = sel.value;
    if (!ingId) return;
    onAddExtra(ingId);
    sel.selectedIndex = 0;
    renderNextChosen();
    if (typeof rerenderAll === "function") rerenderAll();
    else {
      renderTables();
      renderSuggestionsTable();
    }
    save();
  });
}
