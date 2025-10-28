// js/render/menu.js
// 今週・次週の料理カード描画まわりをまとめたモジュール

function resolveElement(ref, fallbackId) {
  if (ref) return ref;
  if (fallbackId) return document.getElementById(fallbackId);
  return null;
}

function renderMenuCardsShared({
  ctx,
  items = [],
  mountEl,
  catKey = null,
  findRecipeById,
  em = () => "",
}) {
  if (!mountEl) return;
  mountEl.innerHTML = (items || []).map((it) => {
    const recipe = findRecipeById?.(it.recipe);
    const needsHtml = ctx === "EXTRA"
      ? ""
      : Object.entries(recipe?.needs || {})
          .map(([id, n]) => `
            <div class="need-pill">
              <span class="em">${em(id)}</span>
              <span class="num">×${n}</span>
            </div>
          `).join("");

    return `
      <div class="menu-card"
           data-ctx="${ctx}"
           data-cat="${catKey || ""}"
           data-id="${it.recipe}">
        <div class="header-line">
          <div class="title">${recipe?.title ?? ""}</div>
          <div class="qty-ops">
            <button class="op-btn op-minus btn btn-primary">−</button>
            <input class="qty-input" type="number" min="0" value="${it.qty}">
            <button class="op-btn op-plus btn btn-primary">＋</button>
            <button class="op-btn op-remove btn btn-ghost">×</button>
          </div>
        </div>
        <div class="needs">${needsHtml}</div>
      </div>
    `;
  }).join("") || `<div class="empty muted">（なし）</div>`;
}

function renderCurrentMenuSummary({
  container,
  getSummary,
  escapeHtml = (value) => value,
}) {
  if (!container) return;
  const summary = getSummary?.() || "";
  if (!summary) {
    container.innerHTML = `<span class="current-menu-empty muted">今週の料理は未選択です</span>`;
    return;
  }
  container.innerHTML = `
    <span class="current-menu-label">今週の料理:</span>
    <span class="current-menu-text">${escapeHtml(summary)}</span>
  `;
}

function renderExtraCards({
  state,
  elements = {},
}) {
  const wrap = resolveElement(elements.nwExtraList, "nwExtraList");
  if (!wrap) return;

  const extras = state.next?.extra || [];
  if (!extras.length) {
    wrap.innerHTML = `<div class="empty muted">（なし）</div>`;
    return;
  }

  const ingredients = state.data?.ingredients || [];
  const ingredientMap = new Map(ingredients.map((ing) => [ing.id, ing]));

  wrap.innerHTML = extras.map((item) => {
    const meta = ingredientMap.get(item.ingId) || { name: item.ingId, emoji: "" };
    const label = `${meta.emoji || ""} ${meta.name || item.ingId}`.trim();
    return `
      <div class="menu-card" data-ctx="NEXT" data-cat="extra" data-id="${item.ingId}">
        <div class="header-line">
          <div class="title">${label}</div>
          <div class="qty-ops">
            <button class="op-btn op-minus btn btn-primary">−</button>
            <input class="qty-input" type="number" step="1" value="${item.qty}" aria-label="${label} の数量">
            <button class="op-btn op-plus btn btn-primary">＋</button>
            <button class="op-btn op-remove btn btn-ghost">×</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

export function renderMenuList({
  state,
  elements = {},
  findRecipeById,
  em,
  getSummary,
  escapeHtml,
}) {
  const mountEl = resolveElement(elements.menuList, "menuList");
  renderMenuCardsShared({
    ctx: "THIS",
    items: state.chosen,
    mountEl,
    findRecipeById,
    em,
  });

  renderCurrentMenuSummary({
    container: resolveElement(elements.currentMenu, "suggestCurrentMenu"),
    getSummary,
    escapeHtml,
  });
}

export function renderNextChosen({
  state,
  elements = {},
  findRecipeById,
  em,
}) {
  const lists = {
    CURRY: resolveElement(elements.nwListCurry, "nwListCurry"),
    SALAD: resolveElement(elements.nwListSalad, "nwListSalad"),
    SWEETS: resolveElement(elements.nwListSweets, "nwListSweets"),
  };

  Object.entries(lists).forEach(([key, mountEl]) => {
    renderMenuCardsShared({
      ctx: "NEXT",
      items: state.next?.[key] || [],
      mountEl,
      catKey: key,
      findRecipeById,
      em,
    });
  });

  renderExtraCards({ state, elements });
}
