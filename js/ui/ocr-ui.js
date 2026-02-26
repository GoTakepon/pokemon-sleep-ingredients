import { parseOcrText } from "../ocr-parse.js";
import { replaceChosen } from "../state/store.js";

export function setupOcrUI({
  elements,
  state,
  saveState,
  refreshViews,
  showToast,
}) {
  const {
    ocrInput,
    parseBtn,
    clearDataBtn,
  } = elements;

  if (parseBtn) {
    parseBtn.addEventListener("click", () => {
      const raw = (ocrInput?.value || "").trim();
      if (!raw) {
        return showToast("OCRテキストを入力してください。", "error");
      }
      
      try {
        const { result, debug } = parseOcrText(raw, state.data.ingredients);
        console.log("OCR debug:", debug);
        
        if (!result || Object.keys(result).length === 0) {
           showToast("食材が検出されませんでした。", "error");
           return;
        }

        state.have = result || {};
        saveState();
        refreshViews();
        showToast("OCR解析が完了しました。", "success");
      } catch (e) {
        console.error(e);
        showToast("OCR解析中にエラーが発生しました。", "error");
      }
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", () => {
      if (!confirm("食材バッグ情報をリセットしますか？")) return;
      
      state.have = {};
      replaceChosen([]);
      if (ocrInput) ocrInput.value = "";
      
      saveState();
      refreshViews();
      showToast("バッグ情報をリセットしました。", "success");
    });
  }
}
