import { describe, it, beforeEach, expect, vi } from "vitest";
import { JSDOM } from "jsdom";

import {
  state,
  setData,
  incChosen,
  decChosen,
  setChosenQty,
  removeChosen,
  incNextRecipe,
  decNextRecipe,
  setNextRecipeQty,
  removeNextRecipe,
  incNextExtra,
  decNextExtra,
  setNextExtraQty,
  removeNextExtra,
} from "../../js/state/store.js";
import { bindMenuCardOpsDelegation } from "../../js/ui/card-ops.js";
import { setupNextWeekSelects, setupNextExtraSelect } from "../../js/ui/next-week-selects.js";

const mockSave = vi.fn();
const mockRender = {
  renderMenuList: vi.fn(),
  renderNextChosen: vi.fn(),
  renderTables: vi.fn(),
  renderSuggestionsTable: vi.fn(),
};

const handlers = {
  incChosen,
  decChosen,
  setChosenQty,
  removeChosen,
  incNextRecipe,
  decNextRecipe,
  setNextRecipeQty,
  removeNextRecipe,
  incNextExtra,
  decNextExtra,
  setNextExtraQty,
  removeNextExtra,
};

const mockData = {
  ingredients: [
    { id: "ing-a", name: "Ing A" },
  ],
  recipes: {
    curry: [{ id: "curry-1", title: "Curry 1", needs: { "ing-a": 2 } }],
    salad: [],
    dessert: [],
  },
};

function createDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="menuList"></div>
    <div id="nwListCurry"></div>
    <div id="nwListSalad"></div>
    <div id="nwListSweets"></div>
    <div id="nwExtraList"></div>
    <select id="nwRecCurry"></select>
    <select id="nwRecSalad"></select>
    <select id="nwRecSweets"></select>
    <select id="nwExtraSelect"></select>
  </body></html>`, { url: "http://localhost" });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
}

describe("UI integration: card ops + selects", () => {
  beforeEach(() => {
    createDom();
    mockSave.mockReset();
    Object.values(mockRender).forEach((spy) => spy.mockReset());

    state.have = {};
    state.chosen = [{ recipe: "curry-1", qty: 2 }];
    state.next = { CURRY: [], SALAD: [], SWEETS: [], extra: [] };
    setData(mockData);

    document.getElementById("menuList").innerHTML = `
      <div class="menu-card" data-ctx="THIS" data-cat="CURRY" data-id="curry-1">
        <button class="op-btn op-minus"></button>
        <button class="op-btn op-plus"></button>
        <button class="op-btn op-remove"></button>
        <input class="qty-input" type="number" value="2" />
      </div>
    `;

    bindMenuCardOpsDelegation({
      rootIds: [
        "menuList",
        "nwListCurry",
        "nwListSalad",
        "nwListSweets",
        "nwExtraList"
      ],
      handlers,
      renderers: mockRender,
    });

    setupNextWeekSelects({
      onAddRecipe: incNextRecipe,
      renderNextChosen: mockRender.renderNextChosen,
      renderTables: mockRender.renderTables,
      renderSuggestionsTable: mockRender.renderSuggestionsTable,
      save: mockSave,
    });

    setupNextExtraSelect({
      onAddExtra: incNextExtra,
      renderNextChosen: mockRender.renderNextChosen,
      renderTables: mockRender.renderTables,
      renderSuggestionsTable: mockRender.renderSuggestionsTable,
      save: mockSave,
    });
  });

  it("updates state when card buttons are used", () => {
    const minus = document.querySelector("#menuList .op-btn.op-minus");
    minus.click();
    expect(state.chosen[0].qty).toBe(1);
    expect(mockRender.renderMenuList).toHaveBeenCalled();
    expect(mockRender.renderTables).toHaveBeenCalled();
    expect(mockRender.renderSuggestionsTable).toHaveBeenCalled();
  });

  it("updates state when quantity is changed directly", () => {
    const input = document.querySelector("#menuList .qty-input");
    input.value = "5";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(state.chosen[0].qty).toBe(5);
    expect(mockRender.renderMenuList).toHaveBeenCalled();
  });

  it("handles next week select changes", () => {
    const sel = document.getElementById("nwRecCurry");
    sel.innerHTML = `<option value=""></option><option value="curry-1">curry-1</option>`;
    sel.value = "curry-1";
    sel.dispatchEvent(new Event("change", { bubbles: true }));

    expect(state.next.CURRY).toHaveLength(1);
    expect(mockRender.renderTables).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it("handles extra select changes", () => {
    const extra = document.getElementById("nwExtraSelect");
    extra.innerHTML = `<option value=""></option><option value="ing-a">Ing A</option>`;
    extra.value = "ing-a";
    extra.dispatchEvent(new Event("change", { bubbles: true }));

    expect(state.next.extra).toHaveLength(1);
    expect(mockRender.renderSuggestionsTable).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });
});
