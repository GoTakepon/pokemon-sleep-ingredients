import { describe, it, beforeEach, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  setupNextWeekSelects,
  setupNextExtraSelect,
} from "../js/ui/next-week-selects.js";

const createDom = () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <select id="nwRecCurry"></select>
    <select id="nwRecSalad"></select>
    <select id="nwRecSweets"></select>
    <select id="nwExtraSelect"></select>
  </body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
};

describe("setupNextWeekSelects", () => {
  beforeEach(createDom);

  it("attaches change handlers and invokes callbacks", () => {
    const curry = document.getElementById("nwRecCurry");
    curry.innerHTML = `<option value=""></option><option value="r1">r1</option>`;

    const onAddRecipe = vi.fn();
    const renderNextChosen = vi.fn();
    const renderTables = vi.fn();
    const renderSuggestionsTable = vi.fn();
    const save = vi.fn();

    setupNextWeekSelects({
      onAddRecipe,
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
      save,
    });

    curry.value = "r1";
    curry.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onAddRecipe).toHaveBeenCalledWith("CURRY", "r1");
    expect(renderNextChosen).toHaveBeenCalled();
    expect(renderTables).toHaveBeenCalled();
    expect(renderSuggestionsTable).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(curry.value).toBe("");
  });
});

describe("setupNextExtraSelect", () => {
  beforeEach(createDom);

  it("handles extra select changes", () => {
    const extra = document.getElementById("nwExtraSelect");
    extra.innerHTML = `<option value=""></option><option value="ing1">Ing 1</option>`;

    const onAddExtra = vi.fn();
    const renderNextChosen = vi.fn();
    const renderTables = vi.fn();
    const renderSuggestionsTable = vi.fn();
    const save = vi.fn();

    setupNextExtraSelect({
      onAddExtra,
      renderNextChosen,
      renderTables,
      renderSuggestionsTable,
      save,
    });

    extra.value = "ing1";
    extra.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onAddExtra).toHaveBeenCalledWith("ing1");
    expect(renderNextChosen).toHaveBeenCalled();
    expect(renderTables).toHaveBeenCalled();
    expect(renderSuggestionsTable).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(extra.value).toBe("");
  });
});
