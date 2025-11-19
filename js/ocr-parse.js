// ocr-parse.js

// ------------------------------
// 基本の正規化
// ------------------------------
function toHalfwidthAscii(s) {
  // 全角英数・記号のうち、よく出るものだけ半角化（NFKC 相当の軽量版）
  return s.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

const UI_GARBAGE_PATTERNS = [
  /バッグ/,
  /どうぐ/,
  /容量/,
  /拡張/,
  /ポケモンのアメ/,
  /ゲームモード/,
  /もどる/,
  /デフォルト/,
  /長する/,
];

function stripUiGarbage(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      if (/^[=＋+\-－]+$/.test(line)) return false;
      if (/^\d+(?::\d+)?$/.test(line)) return false;
      if (UI_GARBAGE_PATTERNS.some(re => re.test(line))) return false;
      return true;
    })
    .join("\n");
}

function normalizeSpaces(s) {
  return s
    .replace(/\r?\n/g, " ")
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 表記ゆらぎを吸収する“照合用”正規化
 * - スペース・句読点・中点などを除去
 * - 長音「ー」を除去（OCRで落ちたり余計に付いたりするため）
 * - ひら/カタ混在の影響を減らす（カタカナ→ひらがな）
 */
function normalizeForMatch(s) {
  const noPunct = s
    .replace(/[ \u3000\u00A0・･\u30FB\.\,\-–—_]/g, "")
    .replace(/ー/g, "");
  // カタカナ → ひらがな
  return noPunct.replace(/[\u30A1-\u30F6]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

// ------------------------------
// 入力本文の正規化
// ------------------------------
function normalizeText(raw) {
  if (!raw) return "";
  let s = stripUiGarbage(raw);
  // よくある「×」「✕」「X」「ｘ」などを全部 x に寄せる
  s = s
    .replace(/[×✕✖✗ＸｘＸ]/g, "x")
    .replace(/(?:\bX\b)/g, "x"); // 単独の大文字 X も x とみなす（保険）
  s = toHalfwidthAscii(s);
  s = normalizeSpaces(s);
  return s;
}

// ------------------------------
// OCR → { id: count } 変換本体
// ------------------------------
/**
 * ingredients: [{ id: 'spring_onion', name: 'ふといながねぎ' }, ...]
 * という前提（name_ja を使っているデータなら name へ流し込んで渡してください）
 */
export function parseOcrText(ocrRaw, ingredients) {
  const text = normalizeText(ocrRaw);

  // 1) 数量を順番に抜く（x の直後に 1～3桁）
  //    "x 12" などの空白や、"x12," のような後続記号も許容
  const counts = [];
  const reCount = /x\s*(\d{1,3})(?!\d)/gi;
  let m;
  while ((m = reCount.exec(text))) {
    counts.push(parseInt(m[1], 10));
  }

  // 2) 数量表記をいったん除去して、名前マッチ用の本文を作る
  const textNoCounts = text.replace(/x\s*\d{1,3}(?!\d)/gi, "");
  const textForMatch = normalizeForMatch(textNoCounts);

  // 3) 食材名の出現順を抽出（最も早く現れるものを貪欲に1つずつ拾う）
  const entries = (ingredients || []).map(ing => {
    const name = ing.name ?? ing.name_ja ?? "";
    return {
      id: ing.id,
      name,
      key: normalizeForMatch(name),
    };
  });

  let cursor = 0;
  const orderedNames = []; // {id, name, start, end}
  while (cursor < textForMatch.length) {
    let best = null; // 最短位置、同位置なら長いキー優先
    for (const e of entries) {
      if (!e.key) continue;
      const pos = textForMatch.indexOf(e.key, cursor);
      if (pos === -1) continue;
      if (!best || pos < best.start || (pos === best.start && e.key.length > best.key.length)) {
        best = { id: e.id, name: e.name, key: e.key, start: pos, end: pos + e.key.length };
      }
    }
    if (!best) break;
    orderedNames.push(best);
    cursor = best.end; // マッチ末尾から次へ
  }

  // 4) 数量と名前を順番に突き合わせ（短い方に合わせる）
  const n = Math.min(counts.length, orderedNames.length);
  const result = {};
  const duplicatesIgnored = [];
  for (let i = 0; i < n; i++) {
    const id = orderedNames[i].id;
    if (Object.prototype.hasOwnProperty.call(result, id)) {
      duplicatesIgnored.push({ id, previous: result[id], skipped: counts[i] });
      continue;
    }
    result[id] = counts[i];
  }

  // 5) デバッグ情報を返す（従来互換＋少し詳細）
  const debug = {
    countsExtracted: counts,
    namesExtracted: orderedNames.map(o => ({ id: o.id, name: o.name })),
    leftoverCounts: counts.slice(n),
    leftoverNames: orderedNames.slice(n).map(o => o.name),
    rawNormalized: text,          // 数量抽出に使った本文
    matchNormalized: textForMatch, // 名前照合に使った本文
    duplicatesIgnored,
  };

  return { result, debug };
}

// ------------------------------
// 失敗時フォールバック（必要なら呼び出し側で利用）
// - 通常パスで names が 0 件の場合、句点・改行で区切って
//   文ごとに再検索する軽い手当て。戻り値の形は parseOcrText と同じ。
// ------------------------------
export function parseOcrTextWithFallback(ocrRaw, ingredients) {
  const r1 = parseOcrText(ocrRaw, ingredients);
  if (Object.keys(r1.result).length > 0) return r1;

  // 文っぽい区切りで分割して合算
  const pieces = String(ocrRaw || "").split(/[。\n\r]/g).filter(Boolean);
  const merged = {};
  const debugs = [];
  for (const p of pieces) {
    const { result, debug } = parseOcrText(p, ingredients);
    for (const [k, v] of Object.entries(result)) {
      merged[k] = (merged[k] || 0) + v;
    }
    debugs.push(debug);
  }
  return {
    result: merged,
    debug: { parts: debugs }
  };
}
