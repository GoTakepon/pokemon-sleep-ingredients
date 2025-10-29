// update-version.js
// 目的: index.html と service-worker.js のバージョンを一括更新
import fs from "fs";
import path from "path";

const VER = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}${mm}${dd}-${hh}${mi}`; // 例: 20251009-1742
})();

const bumpQuery = (s, file) => {
  // file に一致する href/src の ?v= を VER に置換 or 付与
  // 例: ./assets/style.css → ./assets/style.css?v=20251009-1742
  const re = new RegExp(`(${file.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})(\\?v=[^"'>\\s]*)?`, "g");
  return s.replace(re, `$1?v=${VER}`);
};

const read = p => fs.readFileSync(p, "utf-8");
const write = (p, txt) => fs.writeFileSync(p, txt);

// 1) index.html を更新（CSS と main.js の ?v を揃える）
{
  const p = path.resolve("index.html");
  let html = read(p);

  html = bumpQuery(html, "./assets/css/base.css");
  html = bumpQuery(html, "./assets/css/section-ocr.css");
  html = bumpQuery(html, "./assets/css/section-goal.css");
  html = bumpQuery(html, "./assets/css/section-ingrediants.css");
  html = bumpQuery(html, "./assets/css/section-recommend.css");
  html = bumpQuery(html, "./assets/css/custom.css");
  html = bumpQuery(html, "./assets/css/theme-yadon.css");
  html = bumpQuery(html, "./js/main.js");
  html = bumpQuery(html, "./data/ingredients.json");
  html = bumpQuery(html, "./data/recipes.json");

  write(p, html);
  console.log("✅ index.html: bumped ?v=", VER);
}

// 2) service-worker.js を更新
{
  const p = path.resolve("service-worker.js");
  let sw = read(p);

  // CACHE_NAMEを置換
  sw = sw.replace(
    /const\s+CACHE_NAME\s*=\s*["'`](.*?)["'`];/,
    `const CACHE_NAME = "psleep-cache-${VER}";`
  );

  // const VERSION = "..." を置換
  sw = sw.replace(
    /const\s+VERSION\s*=\s*["'`](.*?)["'`];/,
    `const VERSION = "${VER}";`
  );

  // PRECACHE 内の対象ファイルに ?v を揃える（CSS/JS）
  sw = bumpQuery(sw, "./assets/css/base.css");
  sw = bumpQuery(sw, "./assets/css/section-ocr.css");
  sw = bumpQuery(sw, "./assets/css/section-goal.css");
  sw = bumpQuery(sw, "./assets/css/section-ingrediants.css");
  sw = bumpQuery(sw, "./assets/css/section-recommend.css");
  sw = bumpQuery(sw, "./assets/css/custom.css");
  sw = bumpQuery(sw, "./assets/css/theme-yadon.css");
  sw = bumpQuery(sw, "./js/main.js");
  sw = bumpQuery(sw, "./js/ocr-parse.js"); // 使っていれば
  sw = bumpQuery(sw, "./js/render/tables.js");
  sw = bumpQuery(sw, "./js/state/store.js");
  sw = bumpQuery(sw, "./js/ui/init.js");
 // sw = bumpQuery(sw, "./data/ingredients.json");
 // sw = bumpQuery(sw, "./data/recipes.json");

  // main.js のバージョン文字列置換
  let js = fs.readFileSync("./js/main.js", "utf8");
 // js = bumpQuery(js, "./data/ingredients.json");
 // js = bumpQuery(js, "./data/recipes.json");

  // 🔸ここを追加
  js = js.replace(/const APP_VERSION = ['"].*?['"];/, `const APP_VERSION = '${VER}';`);

  fs.writeFileSync("./js/main.js", js);

  write(p, sw);
  console.log("✅ service-worker.js: CACHE_NAME=psleep-cache-" + VER, " & ?v updated");
}

console.log("🎉 Done. Version =", VER);
