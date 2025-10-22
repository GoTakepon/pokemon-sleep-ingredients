import { describe, it, beforeEach, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { setupIngredientsFilter } from "../js/ui/ingredients-filter.js";

const createDom = ({ thisChecked = true, nextChecked = true } = {}) => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <label><input type="checkbox" id="chkThisWeek" ${thisChecked ? 'checked' : ''}></label>
    <label><input type="checkbox" id="chkNextWeek" ${nextChecked ? 'checked' : ''}></label>
  </body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
};

describe("setupIngredientsFilter", () => {
  let mockState;

  beforeEach(() => {
    mockState = {};
    createDom();
  });

  it("initializes state.tableFilter based on checkbox state", () => {
    const renderTables = vi.fn();
    setupIngredientsFilter({ stateRef: mockState, renderTables });
    expect(mockState.tableFilter.this).toBe(true);
    expect(mockState.tableFilter.next).toBe(true);
  });

  it("updates filters and triggers render on change", () => {
    const renderTables = vi.fn();
    setupIngredientsFilter({ stateRef: mockState, renderTables });

    const chkThis = document.getElementById("chkThisWeek");
    chkThis.checked = false;
    chkThis.dispatchEvent(new Event("change", { bubbles: true }));
    expect(mockState.tableFilter.this).toBe(false);

    const chkNext = document.getElementById("chkNextWeek");
    chkNext.checked = false;
    chkNext.dispatchEvent(new Event("change", { bubbles: true }));
    expect(mockState.tableFilter.next).toBe(false);
    expect(renderTables).toHaveBeenCalledTimes(2);
  });
});
