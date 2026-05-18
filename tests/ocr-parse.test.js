import { describe, it, expect } from "vitest";
import { parseOcrText } from "../js/ocr-parse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load actual ingredients for accurate testing
const ingredients = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../public/data/ingredients.json"), "utf-8")
);

describe("parseOcrText", () => {
    it("should parse the user-provided sample accurately", () => {
        const sample = fs.readFileSync(
            path.join(__dirname, "fixtures/ocr-sample.txt"),
            "utf-8"
        );

        const { result, debug } = parseOcrText(sample, ingredients);

        console.log("Extracted result:", result);
        console.log("Missing/Excess items?", debug);

        // The user verified the correct mappings:
        expect(result["spring_onion"]).toBe(19); // x19 belongs to ふといながねぎ
        expect(result["mushroom"]).toBe(4);      // x4 belongs to あじわいキノコ
        expect(result["egg"]).toBe(80);          // x80 belongs to とくせんエッグ
        // x80 あじわいキノコ ? Wait, the line is "x80 \n あじわいキノコとくせんエッグ \n x1 \n とくせんリンゴ"
        // Let's just output it first to see how it performs
    });

    it("should parse Cyrillic x and massively fused lines via Sequence Alignment", () => {
        const sample = fs.readFileSync(
            path.join(__dirname, "fixtures/ocr-sample-cyrillic.txt"),
            "utf-8"
        );
        const { result, debug } = parseOcrText(sample, ingredients);
        
        expect(result["spring_onion"]).toBe(6);  // x6 ふといながねぎ (Cyrillic б)
        expect(result["egg"]).toBe(43);          // x43 とくせんエッグ
        expect(result["potato"]).toBe(60);       // x60 ほっこりポテト
        expect(result["apple"]).toBe(20);        // x20 とくせんリンゴ
        expect(result["herb"]).toBe(90);         // x90 げきからハーブ
        expect(result["mame_meat"]).toBe(2);     // x2 マメミート
        expect(result["moo_milk"]).toBe(133);    // x133 モーモーミルク
        expect(result["sweet_honey"]).toBe(3);   // x3 あまいミツ
        expect(result["pure_oil"]).toBe(93);     // x93 ピュアなオイル
        expect(result["relax_cacao"]).toBe(16);  // x16 リラックスカカオ
        expect(result["wakaku_soy"]).toBe(66);   // x66 ワカクサ大豆
        expect(result["wakaku_corn"]).toBe(92);  // x92 ワカクサコーン
        expect(result["heavy_pumpkin"]).toBe(2); // x2 ずっしりカボチャ
        expect(result["glossy_avocado"]).toBe(82); // x82 つやつやアボカド
    });
});
