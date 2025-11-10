// tools/scrape-recipes.js
// レシピ一覧を wiki から取得し、data/recipes.json を生成。
// 「計（合計食材数）」と「エナジー」も併せて出力します。

import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const WIKI_URL =
  "https://wikiwiki.jp/poke_sleep/%E6%96%99%E7%90%86/%E3%83%AC%E3%82%B7%E3%83%94%E3%81%AE%E4%B8%80%E8%A6%A7";

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, "data");
const TOOLS_DIR = path.join(ROOT, "tools");
const OUT_JSON = path.join(DATA_DIR, "recipes.json");
const DEBUG_HTML = path.join(TOOLS_DIR, "_debug_rendered.html");
const ING_JSON = path.join(DATA_DIR, "ingredients.json");

// 料理カテゴリ（タブ順に対応）
const CATS = [
  { key: "curry", label: "カレー／シチュー" },
  { key: "salad", label: "サラダ" },
  { key: "dessert", label: "ドリンク／デザート" },
];

function loadIngredientsMap() {
  const raw = JSON.parse(fs.readFileSync(ING_JSON, "utf-8"));
  // 名前（日本語）→ id のマップを作成
  const byName = new Map();
  for (const ing of raw) {
    // JSONの構造に合わせて、nameJp / name / id など適宜調整してください
    const jp = ing.nameJp || ing.name_jp || ing.name; // 保険
    if (jp) byName.set(jp.trim(), ing.id);
  }
  return byName;
}

const FORCE_REFRESH = process.argv.includes("--refresh") || process.argv.includes("-r");

async function ensureHtml() {
  if (!FORCE_REFRESH && fs.existsSync(DEBUG_HTML)) {
    return fs.readFileSync(DEBUG_HTML, "utf-8");
  }
  console.log("Fetching:", WIKI_URL);
  const res = await fetch(WIKI_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const html = await res.text();
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  fs.writeFileSync(DEBUG_HTML, html);
  console.log("Saved:", DEBUG_HTML);
  return html;
}

// 食材セルから「{ name: count }」の配列を作る
function parseNeedsCell($, td) {
  // セル内テキストをまとめて取得し、食材名と数量を抽出する
  const normalized = $(td).text().replace(/\s+/g, " ").trim();

  // 「アイテム名 ×数」の並びをすべて抜き出す
  // NOTE: 名称に空白が含まれるため、貪欲に取り、直後の × 数字 を捕捉
  const re = /([^\s×]+(?:\s*[^\s×]+)*)\s*×\s*(\d+)/g;
  const pairs = [];
  let m;
  while ((m = re.exec(normalized))) {
    const name = m[1].trim();
    const count = parseInt(m[2], 10);
    if (name && Number.isFinite(count)) pairs.push({ name, count });
  }
  return pairs;
}

// 料理行から {title, needs, total, energy} を得る
function parseRow($, tr, ingMap) {
  const tds = $(tr).find("td");
  if (tds.length < 6) return null;

  const title = $(tds.eq(2)).text().replace(/\s+/g, " ").trim();
  if (!title) return null;

  const needsPairs = parseNeedsCell($, tds.eq(3));
  const needs = {};
  let total = 0;

  for (const { name, count } of needsPairs) {
    total += count;
    const id = ingMap.get(name);
    if (!id) {
      // マッピングできない食材名はスキップ（必要ならログ）
      // console.warn("Unmapped ingredient:", name);
      continue;
    }
    needs[id] = (needs[id] || 0) + count;
  }

  // 「計」列（単純合計）。表に値がある場合はそちらを優先、なければ計算値 total
  const colTotal = parseInt($(tds.eq(4)).text().replace(/[^\d]/g, ""), 10);
  const totalOut = Number.isFinite(colTotal) ? colTotal : total;

  // 「エナジー」列
  const energy = parseInt($(tds.eq(5)).text().replace(/[^\d]/g, ""), 10) || 0;

  return { title, needs, total: totalOut, energy };
}

// テーブルをカテゴリごとに読む
function parseTables($, ingMap) {
  const result = { curry: [], salad: [], dessert: [] };

  // 新しい DOM では一覧テーブルが wikiwiki-tablesorter-wrapper 内に配置されている
  const tables = $(".wikiwiki-tablesorter-wrapper table")
    .toArray()
    .filter((tbl) => {
      const headers = $(tbl)
        .find("th")
        .map((_, th) => $(th).text().trim())
        .get()
        .join(" ");
      return headers.includes("料理名") && headers.includes("食材");
    });

  if (!tables.length)
    throw new Error("No recipe tables found. ページ構造が変わった可能性があります。");

  tables.forEach((tbl, i) => {
    const cat = CATS[i]?.key;
    if (!cat) return; // 想定外のテーブルは無視

    $(tbl)
      .find("tbody tr")
      .each((_, tr) => {
        const rec = parseRow($, tr, ingMap);
        if (!rec) return;
        // idはタイトルから生成（英字・数字・ハイフン）
        const id = rec.title
          .normalize("NFKC")
          .replace(/[^\w一-龠ぁ-んァ-ヶ]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();
        result[cat].push({ id, ...rec });
      });
  });

  return result;
}

async function main() {
  const html = await ensureHtml();
  const $ = cheerio.load(html, { decodeEntities: false });

  const ingMap = loadIngredientsMap();
  const json = parseTables($, ingMap);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));
  console.log("✅ recipes.json updated:", OUT_JSON);

  // 集計ログ
  const cnt =
    json.curry.length + json.salad.length + json.dessert.length;
  console.log(
    `Recipes -> curry: ${json.curry.length}  salad: ${json.salad.length}  dessert: ${json.dessert.length}  total: ${cnt}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
