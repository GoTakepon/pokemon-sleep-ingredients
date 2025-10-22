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
    const renderTablesSpy = vi.fn();
    const renderSuggestionsSpy = vi.fn();
    setupIngredientsFilter({
      stateRef: mockState,
      renderTables: () => {
        renderTablesSpy();
        renderSuggestionsSpy();
      },
    });
    expect(mockState.tableFilter.this).toBe(true);
    expect(mockState.tableFilter.next).toBe(true);
    expect(renderTablesSpy).not.toHaveBeenCalled();
    expect(renderSuggestionsSpy).not.toHaveBeenCalled();
  });

  it("updates filters and triggers render on change", () => {
    const renderTablesSpy = vi.fn();
    const renderSuggestionsSpy = vi.fn();
    setupIngredientsFilter({
      stateRef: mockState,
      renderTables: () => {
        renderTablesSpy();
        renderSuggestionsSpy();
      },
    });

    const chkThis = document.getElementById("chkThisWeek");
    chkThis.checked = false;
    chkThis.dispatchEvent(new Event("change", { bubbles: true }));
    expect(mockState.tableFilter.this).toBe(false);
    expect(renderTablesSpy).toHaveBeenCalledTimes(1);
    expect(renderSuggestionsSpy).toHaveBeenCalledTimes(1);

    const chkNext = document.getElementById("chkNextWeek");
    chkNext.checked = false;
    chkNext.dispatchEvent(new Event("change", { bubbles: true }));
    expect(mockState.tableFilter.next).toBe(false);
    expect(renderTablesSpy).toHaveBeenCalledTimes(2);
    expect(renderSuggestionsSpy).toHaveBeenCalledTimes(2);
  });
});
