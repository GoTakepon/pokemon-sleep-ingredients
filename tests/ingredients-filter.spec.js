import { describe, it, beforeEach, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import { setupIngredientsFilter } from "../js/ui/ingredients-filter.js";

const createDom = ({ thisChecked = true, nextChecked = true } = {}) => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <label><input type="checkbox" id="chkThisWeek" ${thisChecked ? 'checked' : ''}></label>
    <label><input type="checkbox" id="chkNextWeek" ${nextChecked ? 'checked' : ''}></label>
  </body></html>`, { url: "https://example.org" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.localStorage = dom.window.localStorage;
};

describe("setupIngredientsFilter", () => {
  let mockState;

  beforeEach(() => {
    mockState = {};
    createDom();
    window.localStorage.clear();
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
      storage: window.localStorage,
    });
    expect(mockState.tableFilter.this).toBe(true);
    expect(mockState.tableFilter.next).toBe(true);
    expect(document.getElementById("chkThisWeek").checked).toBe(true);
    expect(document.getElementById("chkNextWeek").checked).toBe(true);
    expect(renderTablesSpy).not.toHaveBeenCalled();
    expect(renderSuggestionsSpy).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem("tableFilter"))).toEqual({ this: true, next: true });
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
      storage: window.localStorage,
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
    expect(JSON.parse(window.localStorage.getItem("tableFilter"))).toEqual({ this: false, next: false });
  });

  it("restores persisted filter values on init", () => {
    window.localStorage.setItem("tableFilter", JSON.stringify({ this: false, next: true }));
    mockState.tableFilter = { this: true, next: false };

    setupIngredientsFilter({
      stateRef: mockState,
      renderTables: () => {},
      storage: window.localStorage,
    });

    expect(mockState.tableFilter.this).toBe(false);
    expect(mockState.tableFilter.next).toBe(true);
    expect(document.getElementById("chkThisWeek").checked).toBe(false);
    expect(document.getElementById("chkNextWeek").checked).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("tableFilter"))).toEqual({ this: false, next: true });
  });
});
