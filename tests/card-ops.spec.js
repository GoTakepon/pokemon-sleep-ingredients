import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import { bindMenuCardOpsDelegation } from "../js/ui/card-ops.js";

let handlers;
let renderers;

const createDom = () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="menuList">
      <div class="menu-card" data-ctx="THIS" data-cat="CURRY" data-id="this-1">
        <button class="op-btn op-minus"></button>
        <button class="op-btn op-plus"></button>
        <button class="op-btn op-remove"></button>
        <input class="qty-input" type="number" value="1" />
      </div>
    </div>
    <div id="nwListCurry">
      <div class="menu-card" data-ctx="NEXT" data-cat="CURRY" data-id="next-1">
        <button class="op-btn op-minus"></button>
        <button class="op-btn op-plus"></button>
        <button class="op-btn op-remove"></button>
        <input class="qty-input" type="number" value="2" />
      </div>
    </div>
    <div id="nwExtraList">
      <div class="menu-card" data-ctx="NEXT" data-cat="extra" data-id="extra-1">
        <button class="op-btn op-minus"></button>
        <button class="op-btn op-plus"></button>
        <button class="op-btn op-remove"></button>
        <input class="qty-input" type="number" value="3" />
      </div>
    </div>
  </body></html>`);

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
};

beforeEach(() => {
  createDom();

  handlers = {
    incChosen: vi.fn(),
    decChosen: vi.fn(),
    setChosenQty: vi.fn(),
    removeChosen: vi.fn(),
    incNextRecipe: vi.fn(),
    decNextRecipe: vi.fn(),
    setNextRecipeQty: vi.fn(),
    removeNextRecipe: vi.fn(),
    incNextExtra: vi.fn(),
    decNextExtra: vi.fn(),
    setNextExtraQty: vi.fn(),
    removeNextExtra: vi.fn(),
  };

  renderers = {
    renderMenuList: vi.fn(),
    renderNextChosen: vi.fn(),
    renderTables: vi.fn(),
    renderSuggestionsTable: vi.fn(),
  };

  bindMenuCardOpsDelegation({
    rootIds: ["menuList", "nwListCurry", "nwExtraList"],
    handlers,
    renderers,
  });
});

describe("bindMenuCardOpsDelegation", () => {
  it("handles THIS card button clicks", () => {
    const minus = document.querySelector("#menuList .op-btn.op-minus");
    minus.click();
    expect(handlers.decChosen).toHaveBeenCalledWith("this-1");
    expect(renderers.renderMenuList).toHaveBeenCalled();
    expect(renderers.renderTables).toHaveBeenCalled();
    expect(renderers.renderSuggestionsTable).toHaveBeenCalled();

    renderers.renderMenuList.mockClear();
    renderers.renderTables.mockClear();
    renderers.renderSuggestionsTable.mockClear();
    handlers.incChosen.mockClear();

    const plus = document.querySelector("#menuList .op-btn.op-plus");
    plus.click();
    expect(handlers.incChosen).toHaveBeenCalledWith("this-1");
    expect(renderers.renderMenuList).toHaveBeenCalled();
  });

  it("handles NEXT category card button clicks", () => {
    const plus = document.querySelector("#nwListCurry .op-btn.op-plus");
    plus.click();
    expect(handlers.incNextRecipe).toHaveBeenCalledWith("CURRY", "next-1");
    expect(renderers.renderNextChosen).toHaveBeenCalled();
    expect(renderers.renderTables).toHaveBeenCalled();
  });

  it("handles EXTRA card removal", () => {
    const remove = document.querySelector("#nwExtraList .op-btn.op-remove");
    remove.click();
    expect(handlers.removeNextExtra).toHaveBeenCalledWith("extra-1");
  });

  it("handles quantity change for THIS card", () => {
    const input = document.querySelector("#menuList .qty-input");
    input.value = "4";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handlers.setChosenQty).toHaveBeenCalledWith("this-1", 4);
    expect(renderers.renderMenuList).toHaveBeenCalled();
  });

  it("handles quantity change for EXTRA card", () => {
    const input = document.querySelector("#nwExtraList .qty-input");
    input.value = "7";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handlers.setNextExtraQty).toHaveBeenCalledWith("extra-1", 7);
    expect(renderers.renderNextChosen).toHaveBeenCalled();
  });
});
