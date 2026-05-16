import fs from "node:fs/promises";
import path from "node:path";

const reportsDir = "reports";
const entries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
const datedReports = [];

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
  const detailed = path.join(reportsDir, entry.name, "browser-detailed-cn.html");
  const visual = path.join(reportsDir, entry.name, "browser-cn-visual.html");
  const fallback = path.join(reportsDir, entry.name, "promo-report-bilingual.html");
  const file = await firstExisting([detailed, visual, fallback]);
  if (file) datedReports.push({ date: entry.name, file });
}

datedReports.sort((a, b) => b.date.localeCompare(a.date));

const latest = datedReports[0]?.file || "latest-cn-visual.html";
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>竞品活动日报</title>
  <style>
    :root {
      --bg:#f5f6f2; --panel:#fff; --ink:#15201b; --muted:#66736d;
      --line:#d8ddd4; --green:#0d7658; --blue:#245c9e;
    }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    .page { max-width:1040px; margin:0 auto; padding:40px 18px; }
    .hero, .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .hero { padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:32px; letter-spacing:0; }
    h2 { margin:0 0 12px; font-size:20px; letter-spacing:0; }
    p { margin:0; color:var(--muted); line-height:1.5; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    a.btn { display:inline-flex; text-decoration:none; color:#fff; background:var(--green); border-radius:8px; padding:10px 14px; font-weight:700; }
    a.btn.secondary { background:var(--blue); }
    .panel { padding:18px; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); font-size:14px; }
    th { color:#3d4742; font-size:12px; text-transform:uppercase; }
    tr:last-child td { border-bottom:0; }
    a { color:var(--blue); }
    code { background:#eef0ea; border-radius:6px; padding:2px 6px; }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>竞品活动日报</h1>
      <p>本地日报网页入口。每日 agent 更新后，会把最新版同步到 <code>latest-cn-visual.html</code>。</p>
      <div class="actions">
        <a class="btn" href="${escapeHtml(path.relative(reportsDir, latest))}">打开最新报告</a>
        <a class="btn secondary" href="latest-cn-visual.html">固定 latest 链接</a>
      </div>
    </section>
    <section class="panel">
      <h2>历史报告</h2>
      <table>
        <thead><tr><th>日期</th><th>报告</th></tr></thead>
        <tbody>
          ${datedReports.map((item) => `<tr><td>${escapeHtml(item.date)}</td><td><a href="${escapeHtml(path.relative(reportsDir, item.file))}">打开报告</a></td></tr>`).join("\n")}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;

await fs.writeFile(path.join(reportsDir, "index.html"), html, "utf8");
console.log(path.join(reportsDir, "index.html"));

async function firstExisting(files) {
  for (const file of files) {
    try {
      await fs.access(file);
      return file;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
