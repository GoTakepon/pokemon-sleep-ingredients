const buildDateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  dateStyle: "short",
  timeStyle: "medium",
});

function formatBuild({ id, commit }) {
  const date = `${buildDateFormat.format(new Date(id))} JST`;
  return commit ? `${date} (${commit})` : date;
}

export function setupVersionUI(build) {
  const version = document.getElementById("appVersion");
  const button = document.getElementById("checkVersionBtn");
  const status = document.getElementById("versionStatus");

  version.textContent = build ? formatBuild(build) : "開発版";
  if (!build) return;

  button.hidden = false;
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "確認中…";

    try {
      const url = new URL("./version.json", window.location.href);
      url.searchParams.set("check", Date.now());
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the published build");

      const latest = await response.json();
      if (typeof latest?.id !== "string" || !Number.isFinite(Date.parse(latest.id))) {
        throw new Error("Invalid published build");
      }

      status.textContent = latest.id === build.id
        ? "最新版を表示中です。"
        : `新しいバージョン ${formatBuild(latest)} が公開されています。アプリを開き直して再確認してください。`;
    } catch {
      status.textContent = "最新版を確認できませんでした。通信状況を確認して再試行してください。";
    } finally {
      button.disabled = false;
    }
  });
}
