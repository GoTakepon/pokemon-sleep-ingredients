const noop = () => { };

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

export function populateNextWeekSelects(recipes, elements) {
  const map = {
    CURRY: elements?.nwRecCurry ?? document.getElementById('nwRecCurry'),
    SALAD: elements?.nwRecSalad ?? document.getElementById('nwRecSalad'),
    SWEETS: elements?.nwRecSweets ?? document.getElementById('nwRecSweets'),
  };

  const mapping = {
    CURRY: "curry",
    SALAD: "salad",
    SWEETS: "dessert"
  };

  Object.entries(map).forEach(([KEY, sel]) => {
    if (!sel) return;
    const list = recipes[mapping[KEY]] || [];
    // Keep the first option (placeholder) if exists, or just overwrite?
    // Usually "選択してください" or similar is first.
    // Let's assume we overwrite but add a default option.
    sel.innerHTML = `<option value="">選択してください</option>` +
      list.map(r => `<option value="${r.id}">${r.title}</option>`).join("");
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

export function populateNextExtraSelect(ingredients, element) {
  const sel = element ?? document.getElementById('nwExtraSelect');
  if (!sel) return;
  sel.innerHTML = `<option value="">選択してください</option>` +
    ingredients.map(ing => `<option value="${ing.id}">${ing.name}</option>`).join("");
}
