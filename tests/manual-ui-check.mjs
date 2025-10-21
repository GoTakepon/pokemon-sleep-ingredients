import { JSDOM } from "jsdom";

import {
  state,
  setData,
} from "../js/state/store.js";

import {
  setupMenuCardOps,
  setupNextWeekSelects,
  setupNextExtraSelect,
} from "../js/ui/init.js";

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
globalThis.localStorage = {
  store: new Map(),
  getItem(key) { return this.store.get(key) ?? null; },
  setItem(key, value) { this.store.set(key, value); },
  removeItem(key) { this.store.delete(key); },
};

state.have = {};
state.chosen = [{ recipe: "curry-1", qty: 2 }];
state.next = { CURRY: [], SALAD: [], SWEETS: [], extra: [] };

setData({
  ingredients: [
    { id: "ing-a", name: "Ing A" }
  ],
  recipes: {
    curry: [{ id: "curry-1", title: "Curry 1", needs: { "ing-a": 2 } }],
    salad: [],
    dessert: [],
  },
});

const refreshLog = [];
const refresh = () => refreshLog.push(
  { chosen: structuredClone(state.chosen), next: structuredClone(state.next) }
);

document.getElementById("menuList").innerHTML = `
  <div class="menu-card" data-ctx="THIS" data-cat="CURRY" data-id="curry-1">
    <button class="op-btn op-minus"></button>
    <button class="op-btn op-plus"></button>
    <button class="op-btn op-remove"></button>
    <input class="qty-input" type="number" value="2" />
  </div>
`;

setupMenuCardOps({
  rootIds: [
    "menuList",
    "nwListCurry",
    "nwListSalad",
    "nwListSweets",
    "nwExtraList"
  ],
  renderMenuList: refresh,
  renderNextChosen: refresh,
  renderTables: refresh,
  renderSuggestionsTable: refresh,
});

setupNextWeekSelects({
  renderNextChosen: refresh,
  renderTables: refresh,
  renderSuggestionsTable: refresh,
});
setupNextExtraSelect({
  renderNextChosen: refresh,
  renderTables: refresh,
  renderSuggestionsTable: refresh,
});

document.querySelector("#menuList .op-minus").click();
document.querySelector("#menuList .qty-input").value = "5";
document.querySelector("#menuList .qty-input").dispatchEvent(new Event("change", { bubbles: true }));

document.getElementById("nwRecCurry").innerHTML = `<option value=""></option><option value="curry-1">curry-1</option>`;
document.getElementById("nwRecCurry").value = "curry-1";
document.getElementById("nwRecCurry").dispatchEvent(new Event("change", { bubbles: true }));

document.getElementById("nwExtraSelect").innerHTML = `<option value=""></option><option value="ing-a">Ing A</option>`;
document.getElementById("nwExtraSelect").value = "ing-a";
document.getElementById("nwExtraSelect").dispatchEvent(new Event("change", { bubbles: true }));

console.log("refresh calls", refreshLog.length);
console.log("chosen state", JSON.stringify(state.chosen));
console.log("next state", JSON.stringify(state.next));
