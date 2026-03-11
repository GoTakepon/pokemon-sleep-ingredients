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
});
