import { describe, it, beforeEach, expect } from "vitest";
import { JSDOM } from "jsdom";

import {
  renderTables,
  renderSuggestionsTable,
} from "../js/render/tables.js";

function createDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <table id="usedTable"></table>
    <table id="otherTable"></table>
    <table id="recommendTable"></table>
  </body></html>`, { url: "http://localhost" });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
}

function createState() {
  return {
    have: { ing1: 1, ing2: 5, ing3: 0, ing4: 7 },
    chosen: [{ recipe: "thisRecipe", qty: 1 }],
    next: {
      CURRY: [{ recipe: "nextRecipe", qty: 1 }],
      SALAD: [],
      SWEETS: [],
      extra: [{ ingId: "ing3", qty: 2.5 }],
    },
    data: {
      ingredients: [
        { id: "ing1", name: "Apples", emoji: "🍎" },
        { id: "ing2", name: "Beans", emoji: "🌱" },
        { id: "ing3", name: "Carrots", emoji: "🥕" },
        { id: "ing4", name: "Dill", emoji: "" },
      ],
      recipes: {
        curry: [
          { id: "thisRecipe", title: "This Recipe", needs: { ing1: 2, ing2: 1.5 } },
          { id: "nextRecipe", title: "Next Recipe", needs: { ing1: 1, ing2: 3 } },
          { id: "nextExtraRecipe", title: "Extra Recipe", needs: { ing3: 1 } },
        ],
        salad: [],
        dessert: [],
      },
    },
    tableFilter: { this: true, next: true },
    nextVersion: 0,
    gatherRates: {
      ing1: [2, 1, 0],
      ing2: [0, 0, 0],
      ing3: [1, 0, 0],
      ing4: [0, 0, 0],
    },
    gatherPokemonCount: 2,
  };
}

function createFindRecipeById(state) {
  const index = new Map();
  Object.values(state.data.recipes || {}).forEach((list) => {
    (list || []).forEach((recipe) => {
      index.set(recipe.id, recipe);
    });
  });
  return (id) => index.get(id) || null;
}

describe("renderTables", () => {
  beforeEach(() => {
    createDom();
  });

  it("renders week usage classes and preserves decimal totals", () => {
    const state = createState();
    const findRecipeById = createFindRecipeById(state);

    renderTables({ state, findRecipeById });

    const usedRows = Array.from(document.querySelectorAll("#usedTable tbody tr"));
    const ing1Row = usedRows.find((row) => row.textContent.includes("Apples"));
    const ing2Row = usedRows.find((row) => row.textContent.includes("Beans"));
    const ing3Row = usedRows.find((row) => row.textContent.includes("Carrots"));

    expect(usedRows).toHaveLength(3);
    expect(ing1Row?.classList.contains("wk-both")).toBe(true);
    expect(ing2Row?.classList.contains("wk-both")).toBe(true);
    expect(ing3Row?.classList.contains("wk-next")).toBe(true);

    const targetCell = ing2Row?.querySelectorAll("td")[2];
    expect(targetCell?.textContent).toBe("4.5");

    const shortageCell = ing1Row?.querySelectorAll("td")[4];
    expect(shortageCell?.textContent).not.toBeUndefined();

    const otherRow = document.querySelector("#otherTable tbody tr");
    expect(otherRow?.textContent).toContain("Dill");
    expect(otherRow?.classList.contains("wk-this")).toBe(false);
    expect(otherRow?.classList.contains("wk-next")).toBe(false);
  });
});

describe("renderSuggestionsTable", () => {
  beforeEach(() => {
    createDom();
  });

  it("decorates need pods based on this/next week usage", () => {
    const state = createState();
    const findRecipeById = createFindRecipeById(state);
    const catSelect = document.createElement("select");
    const curryOption = document.createElement("option");
    curryOption.value = "curry";
    curryOption.selected = true;
    catSelect.appendChild(curryOption);
    const els = { cat: catSelect };

    const em = (id) => {
      const ing = state.data.ingredients.find((i) => i.id === id);
      return ing?.emoji || "";
    };

    renderSuggestionsTable({
      state,
      els,
      findRecipeById,
      em,
    });

    const pods = Array.from(document.querySelectorAll("#recommendTable .need-pod"));
    expect(pods.some((pod) => pod.classList.contains("is-both"))).toBe(true);
    expect(pods.some((pod) => pod.classList.contains("is-next"))).toBe(true);
  });
});
