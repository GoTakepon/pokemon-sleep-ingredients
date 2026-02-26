// js/render/proposals.js
// 料理提案結果のレンダリングロジック (Card + Detailed Table Layout)

export function renderProposalResults(results, container) {
  if (!container) return;

  if (!results || !results.length) {
    container.innerHTML = `<p class="muted">計算結果がありません。</p>`;
    return;
  }

  const html = results.map(({ slot, combo }) => {
    if (!combo) {
      return `
        <div class="proposal-card proposal-card-empty">
          <div class="proposal-header">
            <span>食材ポケモン枠 ${slot}</span>
          </div>
          <div class="muted">条件に合う組み合わせが見つかりませんでした</div>
        </div>
      `;
    }

    const {
      recipes,
      totalEnergy,
      totalIngredientHours,
      totalHours,
      slotCount,
      energyPerSlot,
    } = combo;

    // Build table rows
    let tableRows = "";
    recipes.forEach((r, idx) => {
      const ingHours = r.ingredientHoursRequired || 0;
      const totHours = r.hoursRequired || 0;
      const otherHours = Math.max(0, totHours - ingHours);

      tableRows += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="proposal-recipe-cell">${r.title}</td>
          <td class="num">${ingHours.toFixed(1)}</td>
          <td class="num">${otherHours.toFixed(1)}</td>
          <td class="num">${totHours.toFixed(1)}</td>
          <td class="num">${Math.floor(r.finalEnergy).toLocaleString()}</td>
        </tr>
      `;
    });

    // Total row
    const totalOtherHours = Math.max(0, totalHours - totalIngredientHours);
    tableRows += `
      <tfoot>
        <tr>
          <td colspan="2" class="center">合計</td>
          <td class="num">${totalIngredientHours.toFixed(1)}</td>
          <td class="num">${totalOtherHours.toFixed(1)}</td>
          <td class="num">${totalHours.toFixed(1)}</td>
          <td class="num">${Math.floor(totalEnergy).toLocaleString()}</td>
        </tr>
      </tfoot>
    `;

    // Summary stats
    // Line 1: 想定枠: X枠  稼働枠数 (食材枠合計 ÷ 24h): X.XX
    // Line 2: 食材枠合計 (参考): XX.X  1枠あたりエナジー: XX,XXX
    const formattedSlotCount = slotCount ? slotCount.toFixed(2) : "-";
    const formattedPerSlot = energyPerSlot ? Math.floor(energyPerSlot).toLocaleString() : "-";

    return `
      <div class="proposal-card">
        <div class="proposal-header">
          <span class="proposal-title">食材ポケモン枠 ${slot}</span>
          <button class="btn btn-sm btn-primary proposal-apply-btn" data-index="${slot}">
            今週の料理に反映
          </button>
        </div>

        <div class="table-wrapper" style="margin-top: 12px;">
          <table class="table proposal-table">
            <thead>
              <tr>
                <th>順番</th>
                <th>料理名</th>
                <th>食材枠<br>(h)</th>
                <th>その他枠<br>(h)</th>
                <th>合計<br>(h)</th>
                <th>エナジー</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="proposal-summary">
          <div>
            <strong>想定枠: ${slot}枠</strong>
            <span style="margin-left: 12px;">稼働枠数 (食材枠合計 ÷ 24h): <strong>${formattedSlotCount}</strong></span>
          </div>
          <div>
            <span>食材枠合計 (参考): <strong>${totalIngredientHours.toFixed(1)}</strong></span>
            <span style="margin-left: 12px;">1枠あたりエナジー: <strong>${formattedPerSlot}</strong></span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="proposal-list">${html}</div>`;
}
