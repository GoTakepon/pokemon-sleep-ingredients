// service-worker.js

// ★ キャッシュ名を更新して強制入れ替え（update-version.js が自動更新）
const CACHE_NAME = "psleep-cache-20251030-1122";

// ★ データ用のバージョン（update-version.js が自動更新）
const VERSION = "20251030-1122";

// 静的アセット（?v は update-version.js で更新される）
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/main.js?v=20251030-1122",
  "./js/ocr-parse.js?v=20251030-1122",
  "./js/state/store.js?v=20251030-1122",
  "./js/state/apply.js?v=20251028-2241",
  "./js/render/menu.js?v=20251028-2241",
  "./js/render/tables.js?v=20251030-1122",
  "./js/ui/card-ops.js?v=20251028-2241",
  "./js/ui/next-week-selects.js?v=20251028-2241",
  "./js/ui/ingredients-filter.js?v=20251028-2241",
  "./js/ui/init.js?v=20251030-1122",
  "./js/ui/gather-init.js?v=20251028-2241",
  "./js/ui/stock-init.js?v=20251028-2241",
  "./js/ui/energy-controls.js?v=20251028-2241",
  "./js/logic/energy.js?v=20251028-2241",
  "./js/logic/gather.js?v=20251028-2241",
  "./js/logic/proposals.js?v=20251028-2241",
  "./js/logic/stock-plan.js?v=20251028-2241",
  "./js/logic/next-week.js?v=20251028-2241",
  "./js/logic/weekly-totals.js?v=20251028-2241",
  "./js/data/recipe-level-bonus.js?v=20251028-2241",
  "./assets/css/base.css?v=20251030-1122",
  "./assets/css/custom.css?v=20251030-1122",
  "./assets/css/section-ocr.css?v=20251030-1122",
  "./assets/css/section-goal.css?v=20251030-1122",
  "./assets/css/section-ingrediants.css?v=20251030-1122",
  "./assets/css/section-recommend.css?v=20251030-1122",
  "./assets/css/theme-yadon.css?v=20251030-1122",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

// ★ データURLは「クエリなしの正規パス」に統一（ここに ?v は書かない）
const DATA_CANONICAL = [
  "./data/ingredients.json",
  "./data/recipes.json",
];

// install: 静的 + データ(クエリあり/なし) をまとめてキャッシュ
self.addEventListener("install", (event) => {
  self.skipWaiting(); // 即時適用のため
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const dataWithQuery = DATA_CANONICAL.map(p => `${p}?v=${VERSION}`);
    try {
      await cache.addAll([
        ...STATIC_ASSETS,
        ...DATA_CANONICAL, // クエリなし
        ...dataWithQuery,  // クエリあり（main.js の fetch と一致）
      ]);
      console.log("[SW] precached:", { STATIC_ASSETS, DATA_CANONICAL, dataWithQuery });
    } catch (e) {
      console.error("[SW] cache.addAll failed:", e);
    }
  })());
});

// activate: 古いキャッシュ掃除
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))
    );
    await self.clients.claim();
    console.log("[SW] activated:", CACHE_NAME);
  })());
});

// fetch: データ系は "?v" 無視でマッチ（ignoreSearch）
//        それ以外もキャッシュ優先 + ランタイム保存
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // データファイル判定：パス名だけで判定（?v が違ってもOK）
  const isData = DATA_CANONICAL.some((p) => url.pathname.endsWith(p.replace("./", "/")));

  if (isData) {
    event.respondWith((async () => {
      // 1) ?v を無視して探す（←ここが重要）
      let res = await caches.match(req, { ignoreSearch: true });
      if (res) return res;

      // 2) オンラインなら取得して両方キャッシュ（?v付き/なし）
      try {
        res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone()); // そのまま（?v付き）を保存
        // クエリなしキーでも引けるように正規URLでも保存
        const canonical = new Request(url.origin + url.pathname, { credentials: "include" });
        cache.put(canonical, res.clone());
        return res;
      } catch (e) {
        // 3) 完全オフラインでキャッシュもない場合はシンプルな 503
        return new Response(JSON.stringify({ error: "offline", path: url.pathname }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    })());
    return;
  }

  // その他: キャッシュ優先（無ければ取得して保存）
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fetched = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fetched.clone());
      return fetched;
    } catch (e) {
      // HTMLナビゲーションは index.html を返して最低限の画面を保つ
      if (req.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return new Response("Offline", { status: 503 });
    }
  })());
});
