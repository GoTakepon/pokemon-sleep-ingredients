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
  const textForMatch = normalizeForMatch(text);

  // 1) Find all counts in textForMatch
  const counts = [];
  const reCount = /x(\d{1,3})(?!\d)/gi;
  let m;
  while ((m = reCount.exec(textForMatch))) {
    counts.push({ val: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length, used: false });
  }

  // 2) Expand aliases to ensure robust name matching
  const entries = (ingredients || []).map(ing => {
    const aliases = (ing.aliases || []).filter(a => typeof a === 'string');
    const primary = ing.name || ing.name_ja || "";
    if (primary && !aliases.includes(primary)) aliases.push(primary);
    return {
      id: ing.id,
      name: primary,
      keys: aliases.map(a => normalizeForMatch(a)).filter(a => a.length > 0)
    };
  });

  // 3) Find all ingredient names in the text
  let cursor = 0;
  const orderedNames = [];
  while (cursor < textForMatch.length) {
    let best = null;
    for (const e of entries) {
      for (const k of e.keys) {
        const pos = textForMatch.indexOf(k, cursor);
        if (pos === -1) continue;
        if (!best || pos < best.start || (pos === best.start && k.length > best.key.length)) {
          best = { id: e.id, name: e.name, key: k, start: pos, end: pos + k.length };
        }
      }
    }
    if (!best) break;
    orderedNames.push(best);
    cursor = best.end;
  }

  // 4) Sequential matching
  const result = {};
  const duplicatesIgnored = [];
  const n = Math.min(counts.length, orderedNames.length);

  for (let i = 0; i < n; i++) {
    const id = orderedNames[i].id;
    if (Object.prototype.hasOwnProperty.call(result, id)) {
      duplicatesIgnored.push({ id, previous: result[id], skipped: counts[i].val });
      continue;
    }
    result[id] = counts[i].val;
  }

  // 5) Debug package
  const debug = {
    countsExtracted: counts.map(c => c.val),
    namesExtracted: orderedNames.map(o => ({ id: o.id, name: o.name })),
    rawNormalized: text,
    matchNormalized: textForMatch,
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
