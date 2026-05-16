import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, todayISO } from "./utils.mjs";
import { loadConfig } from "./config.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const reportDir = path.join("reports", date);
const inputPath = path.join(reportDir, "browser-observations.json");
const outputPath = path.join(reportDir, "browser-detailed-cn.html");
const mirrorPath = path.join(reportDir, "browser-cn-visual.html");
const currentBrowserPath = path.join("reports", "2026-05-14", "promo-report-bilingual.html");
const latestPath = path.join("reports", "latest-cn-visual.html");
const observations = JSON.parse(await fs.readFile(inputPath, "utf8"));

const previousKeys = await loadPreviousActivityKeys(date);
const hasPreviousBaseline = previousKeys.size > 0;
const detailData = await loadPromotionDetails();
const parsed = observations.results.map((item) => ({
  ...item,
  rows: parseBrand(item)
}));
for (const item of parsed) {
  for (const row of item.rows) {
    row.activityKey = activityKey(item.brand, row);
    row.isNew = hasPreviousBaseline && !previousKeys.has(row.activityKey);
  }
}
const detailStats = enrichRowsWithDetails(parsed, detailData);

const totalRows = parsed.reduce((sum, item) => sum + item.rows.length, 0);
const newRows = parsed.reduce((sum, item) => sum + item.rows.filter((row) => row.isNew).length, 0);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>竞品活动明细表 ${escapeHtml(date)}</title>
  <style>
    :root {
      --bg: #f5f6f2;
      --panel: #fff;
      --ink: #15201b;
      --muted: #66736d;
      --line: #d8ddd4;
      --green: #0d7658;
      --blue: #245c9e;
      --amber: #9a6816;
      --red: #a54040;
      --soft-green: #e5f3ed;
      --soft-blue: #e9f0fb;
      --soft-amber: #fff4df;
      --soft-red: #faeeee;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; line-height: 1.45; }
    .page { max-width: 1440px; margin: 0 auto; padding: 28px 18px 56px; }
    .hero { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 24px; display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 18px; align-items: end; }
    h1 { margin: 0 0 8px; font-size: 31px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 30px 0 12px; font-size: 22px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0; }
    .sub, .meta, .note { color: var(--muted); }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .kpi, .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .kpi strong { display: block; font-size: 30px; line-height: 1; }
    .kpi span { color: var(--muted); font-size: 13px; }
    .toc { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .toc a { display: block; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px; color: var(--ink); text-decoration: none; }
    .toc strong { display: block; }
    .toc span { color: var(--muted); font-size: 13px; }
    .brand-head { display: grid; grid-template-columns: 1fr 220px; gap: 16px; align-items: center; margin-bottom: 10px; }
    .shot { width: 220px; aspect-ratio: 16 / 10; object-fit: cover; border: 1px solid var(--line); border-radius: 8px; background: #edf0ea; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 11px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
    th { background: #ecefe8; color: #3d4742; font-size: 12px; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .brand-name { font-weight: 800; }
    .status { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 750; white-space: nowrap; }
    .ok { color: var(--green); background: var(--soft-green); }
    .mid { color: var(--amber); background: var(--soft-amber); }
    .blue { color: var(--blue); background: var(--soft-blue); }
    .missing { color: var(--muted); background: #eef0ea; }
    .low { color: var(--red); background: var(--soft-red); }
    .small { max-width: 260px; }
    details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
    summary { cursor: pointer; font-weight: 800; }
    pre { white-space: pre-wrap; word-break: break-word; background: #111714; color: #eef6f0; padding: 12px; border-radius: 8px; max-height: 260px; overflow: auto; font-size: 12px; }
    a { color: var(--blue); }
    @media (max-width: 1100px) {
      .hero, .brand-head { grid-template-columns: 1fr; }
      .toc { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .shot { width: 100%; max-width: 360px; }
      h1 { font-size: 27px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1>竞品活动明细表：按品牌拆分</h1>
        <p class="sub">基于 in-app browser 直接访问页面后的可见正文整理。字段包括标题、奖励、参与要求、开始时间、结束时间和备注。页面未显示的信息会明确标注，不做猜测。</p>
      </div>
      <div class="meta">
        <p><b>日期：</b>${escapeHtml(date)}</p>
        <p><b>生成时间：</b>${escapeHtml(observations.generatedAt)}</p>
        <p><b>采集方式：</b>直接浏览器访问，不使用批量爬虫状态作为依据</p>
      </div>
    </section>

    <section class="kpis">
      ${kpi(String(parsed.length), "品牌")}
      ${kpi(String(totalRows), "活动条目")}
      ${kpi(String(newRows), "今日新增")}
      ${kpi(String(detailStats.matched), "详情页匹配")}
      ${kpi(String(parsed.filter((item) => item.status === "ok").length), "浏览器可访问")}
    </section>

    <section class="new-summary">
      <h2>今日新增活动</h2>
      ${renderNewSummary(parsed, hasPreviousBaseline)}
    </section>

    <h2>品牌导航</h2>
    <section class="toc">
      ${parsed.map((item) => `<a href="#${slug(item.brand)}"><strong>${escapeHtml(item.brand)}</strong><span>${item.rows.length} 条活动</span></a>`).join("\n")}
    </section>

    ${parsed.map(renderBrandSection).join("\n")}

    <details>
      <summary>查看原始浏览器正文摘录</summary>
      ${parsed.map((item) => `<h3>${escapeHtml(item.brand)}</h3><pre>${escapeHtml(item.text.slice(0, 6000))}</pre>`).join("\n")}
    </details>
  </main>
</body>
</html>`;

await fs.writeFile(outputPath, html, "utf8");
await fs.writeFile(mirrorPath, html, "utf8");
await fs.writeFile(currentBrowserPath, html, "utf8");
await fs.writeFile(latestPath, html, "utf8");
await writeActivityIndex(parsed);
await generateStaticSite(parsed, totalRows);
console.log(outputPath);
console.log(mirrorPath);
console.log(currentBrowserPath);
console.log(latestPath);
console.log(path.join(reportDir, "site", "index.html"));

async function generateStaticSite(items, rowCount) {
  const siteDir = path.join(reportDir, "site");
  const brandDir = path.join(siteDir, "brands");
  await fs.mkdir(brandDir, { recursive: true });

  for (const item of items) {
    await fs.writeFile(
      path.join(brandDir, `${slug(item.brand)}.html`),
      renderBrandPage(item),
      "utf8"
    );
  }

  await fs.writeFile(path.join(siteDir, "index.html"), renderSiteIndex(items, rowCount), "utf8");
  await fs.writeFile(path.join("reports", "latest-site.html"), redirectHtml(path.join("2026-05-16", "site", "index.html")), "utf8");
}

function renderSiteIndex(items, rowCount) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>竞品活动站点 ${escapeHtml(date)}</title>
  ${siteStyles()}
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Daily Promotion Intelligence</p>
        <h1>竞品活动站点</h1>
        <p class="sub">每个品牌一个入口。进入品牌页后可查看页面截图、活动列表，以及标题、奖励、要求、开始/结束时间等中英文字段。</p>
      </div>
      <div class="meta">
        <b>日期 Date</b>${escapeHtml(date)}<br>
        <b>品牌 Brands</b>${items.length}<br>
        <b>活动 Activities</b>${rowCount}<br>
        <b>详情 Details</b>${items.reduce((sum, item) => sum + item.rows.filter((row) => row.detailStatus === "ok").length, 0)}<br>
        <b>今日新增 New</b>${items.reduce((sum, item) => sum + item.rows.filter((row) => row.isNew).length, 0)}
      </div>
    </section>

    <section class="new-summary site-new">
      <h2>今日新增活动 / New Today</h2>
      ${renderNewSummary(items, hasPreviousBaseline)}
    </section>

    <section class="brand-grid">
      ${items.map(renderBrandCard).join("\n")}
    </section>
  </main>
</body>
</html>`;
}

function renderBrandCard(item) {
  const shot = path.join("..", "browser-screenshots", path.basename(item.screenshot));
  const newCount = item.rows.filter((row) => row.isNew).length;
  const detailCount = item.rows.filter((row) => row.detailStatus === "ok").length;
  return `<a class="brand-card" href="brands/${slug(item.brand)}.html">
    <img src="${escapeHtml(shot)}" alt="${escapeHtml(item.brand)} screenshot">
    <div>
      <h2>${escapeHtml(item.brand)}</h2>
      <p>${item.rows.length} 条活动 / ${item.rows.length} activities</p>
      <p>${detailCount} 条详情页已匹配 / ${detailCount} detail pages matched</p>
      ${newCount ? `<p><span class="new-badge">今日新增 ${newCount}</span></p>` : ""}
      <span>打开品牌详情 / Open brand page</span>
    </div>
  </a>`;
}

function renderBrandPage(item) {
  const shot = path.join("..", "..", "browser-screenshots", path.basename(item.screenshot));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(item.brand)} 活动详情</title>
  ${siteStyles()}
</head>
<body>
  <main class="page">
    <nav class="topnav"><a href="../index.html">返回品牌入口 / Back to brands</a></nav>
    <section class="hero brand-hero">
      <div>
        <p class="eyebrow">Brand Promotion Page</p>
        <h1>${escapeHtml(item.brand)}</h1>
        <p class="sub">来源 Source：<a href="${escapeHtml(item.finalUrl)}">${escapeHtml(item.finalUrl)}</a></p>
        <p class="sub">本页优先使用活动详情页内容；详情页未开放或未匹配时使用列表页兜底。</p>
      </div>
      <div class="meta">
        <b>活动 Activities</b>${item.rows.length}<br>
        <b>今日新增 New</b>${item.rows.filter((row) => row.isNew).length}<br>
        <b>详情 Details</b>${item.rows.filter((row) => row.detailStatus === "ok").length}<br>
        <b>状态 Status</b>浏览器可访问 / Browser accessible
      </div>
    </section>

    <section class="visual">
      <img src="${escapeHtml(shot)}" alt="${escapeHtml(item.brand)} screenshot">
    </section>

    <section class="activity-list">
      ${item.rows.map((row, index) => renderActivityCard(row, index)).join("\n")}
    </section>

    <details class="raw">
      <summary>查看原始页面文字 / Raw visible text</summary>
      <pre>${escapeHtml(item.text.slice(0, 10000))}</pre>
    </details>
  </main>
</body>
</html>`;
}

function renderActivityCard(row, index) {
  const type = inferBilingualType(`${row.title} ${row.reward} ${row.requirement} ${row.note}`);
  const detailClass = row.detailStatus === "ok" ? "detail-ok" : row.detailStatus === "limited" ? "detail-limited" : "detail-missing";
  return `<article class="activity-card ${detailClass}">
    <div class="activity-head">
      <span class="index">${index + 1}</span>
      <div>
        <h2>${escapeHtml(row.title)} ${row.isNew ? '<span class="new-badge">今日新增 / New Today</span>' : ""}</h2>
        <p>${escapeHtml(type)} · ${detailBadge(row)}</p>
      </div>
    </div>
    <dl>
      <div><dt>奖励 / Reward</dt><dd>${field(row.reward)}</dd></div>
      <div><dt>详情页奖励 / Detail Reward</dt><dd>${field(row.detailReward || "")}</dd></div>
      <div><dt>参与要求 / Requirements</dt><dd>${field(row.detailRequirement || row.requirement)}</dd></div>
      <div><dt>开始时间 / Start Time</dt><dd>${field(row.start)}</dd></div>
      <div><dt>结束时间 / End Time</dt><dd>${field(row.end)}</dd></div>
      <div><dt>详情页关键日期 / Detail Dates</dt><dd>${field(row.detailDates || "")}</dd></div>
      <div><dt>详情页来源 / Detail Source</dt><dd>${row.detailUrl ? `<a href="${escapeHtml(row.detailUrl)}">${escapeHtml(row.detailUrl)}</a>` : '<span class="missing-text">未匹配详情页 / No detail page matched</span>'}</dd></div>
      <div><dt>备注 / Notes</dt><dd>${escapeHtml(row.note || "列表页可见 / Visible on listing page")}</dd></div>
    </dl>
${row.detailExcerpt ? `<details class="detail-excerpt"><summary>详情页原文摘要 / Detail excerpt</summary><pre>${escapeHtml(row.detailExcerpt)}</pre></details>` : ""}
  </article>`;
}

function field(value) {
  if (!value || value === "列表页未显示") return `<span class="missing-text">列表页未显示 / Not shown on listing page</span>`;
  return escapeHtml(value);
}

function detailBadge(row) {
  if (row.detailStatus === "ok") return '<span class="detail-pill ok-pill">详情页已采集 / Detail captured</span>';
  if (row.detailStatus === "limited") return '<span class="detail-pill limited-pill">详情页正文有限 / Limited detail</span>';
  return '<span class="detail-pill fallback-pill">列表页兜底 / Listing fallback</span>';
}

function inferBilingualType(text) {
  const lower = text.toLowerCase();
  if (lower.includes("cashback") || lower.includes("cash back")) return "返现 / Cashback";
  if (lower.includes("free spin") || lower.includes(" fs")) return "免费旋转 / Free Spins";
  if (lower.includes("free bet") || lower.includes("freebet")) return "免费投注 / Free Bet";
  if (lower.includes("deposit") || lower.includes("welcome") || lower.includes("reload")) return "充值或欢迎奖励 / Deposit or Welcome Bonus";
  if (lower.includes("raffle") || lower.includes("tournament") || lower.includes("prize") || lower.includes("league")) return "竞赛或抽奖 / Tournament or Raffle";
  if (lower.includes("vip") || lower.includes("rakeback") || lower.includes("loyalty")) return "VIP 或忠诚度 / VIP or Loyalty";
  if (lower.includes("odds") || lower.includes("football") || lower.includes("bet builder") || lower.includes("accumulator")) return "体育投注 / Sports Betting";
  return "综合活动 / General Promotion";
}

function redirectHtml(target) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escapeHtml(target)}"><title>Latest report</title></head><body><a href="${escapeHtml(target)}">Open latest report</a></body></html>`;
}

function siteStyles() {
  return `<style>
    :root { --bg:#f5f6f2; --panel:#fff; --ink:#15201b; --muted:#66736d; --line:#d8ddd4; --green:#0d7658; --blue:#245c9e; --amber:#9a6816; --red:#a54040; --soft:#eef4f0; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; line-height:1.45; }
    .page { max-width:1280px; margin:0 auto; padding:28px 18px 56px; }
    .hero { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:24px; display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:18px; align-items:end; margin-bottom:18px; }
    .brand-hero { margin-bottom:16px; }
    .eyebrow { margin:0 0 8px; color:var(--green); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
    h1 { margin:0 0 8px; font-size:32px; line-height:1.12; letter-spacing:0; }
    h2 { margin:0 0 6px; font-size:18px; letter-spacing:0; }
    p { margin:0; }
    .sub, .meta { color:var(--muted); }
    .meta { background:#f8faf7; border:1px solid var(--line); border-radius:8px; padding:14px; }
    .meta b { display:inline-block; min-width:92px; color:var(--ink); }
    .brand-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .brand-card { display:grid; grid-template-columns:220px minmax(0,1fr); gap:14px; padding:14px; color:var(--ink); text-decoration:none; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .brand-card img, .visual img { width:100%; border:1px solid var(--line); border-radius:8px; background:#edf0ea; object-fit:cover; }
    .brand-card img { aspect-ratio:16/10; }
    .brand-card span { display:inline-flex; margin-top:10px; color:var(--blue); font-weight:700; }
    .new-summary { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:18px; }
    .new-summary h2 { margin:0 0 10px; font-size:20px; }
    .new-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .new-item { border:1px solid var(--line); border-radius:8px; padding:10px; background:#fbfcfa; }
    .new-item strong { display:block; }
    .new-badge { display:inline-flex; align-items:center; border-radius:999px; background:#fff4df; color:#9a6816; padding:3px 8px; font-size:12px; font-weight:800; margin-left:6px; vertical-align:middle; }
    .topnav { margin-bottom:12px; }
    .topnav a { color:var(--blue); font-weight:700; text-decoration:none; }
    .visual { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:16px; }
    .visual img { max-height:520px; object-fit:contain; }
    .activity-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .activity-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .activity-card.detail-ok { border-left:4px solid var(--green); }
    .activity-card.detail-limited { border-left:4px solid var(--amber); }
    .activity-card.detail-missing { border-left:4px solid #a8b1ac; }
    .activity-head { display:grid; grid-template-columns:36px minmax(0,1fr); gap:10px; align-items:start; margin-bottom:12px; }
    .index { display:inline-grid; place-items:center; width:30px; height:30px; border-radius:999px; background:var(--soft); color:var(--green); font-weight:800; }
    dl { display:grid; gap:8px; margin:0; }
    dl div { display:grid; grid-template-columns:150px minmax(0,1fr); gap:10px; border-top:1px solid var(--line); padding-top:8px; }
    dt { color:var(--muted); font-size:12px; font-weight:800; }
    dd { margin:0; font-size:13px; }
    .missing-text { color:var(--muted); }
    .detail-pill { display:inline-flex; align-items:center; border-radius:999px; padding:3px 8px; font-size:12px; font-weight:800; }
    .ok-pill { background:#e5f3ed; color:var(--green); }
    .limited-pill { background:#fff4df; color:var(--amber); }
    .fallback-pill { background:#eef0ea; color:var(--muted); }
    .detail-excerpt { margin-top:12px; border-top:1px solid var(--line); padding-top:10px; }
    .detail-excerpt summary { cursor:pointer; color:var(--blue); font-weight:800; }
    .raw { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; margin-top:16px; }
    pre { white-space:pre-wrap; word-break:break-word; background:#111714; color:#eef6f0; padding:12px; border-radius:8px; max-height:320px; overflow:auto; font-size:12px; }
    a { color:var(--blue); }
    @media (max-width:900px) { .hero, .brand-grid, .brand-card, .activity-list, .new-list { grid-template-columns:1fr; } h1 { font-size:27px; } dl div { grid-template-columns:1fr; } }
  </style>`;
}

function renderBrandSection(item) {
  const screenshot = path.relative(reportDir, item.screenshot);
  const newCount = item.rows.filter((row) => row.isNew).length;
  return `<section id="${slug(item.brand)}">
    <h2>${escapeHtml(item.brand)}</h2>
    <div class="brand-head">
      <div>
        <p class="note">来源：<a href="${escapeHtml(item.finalUrl)}">${escapeHtml(item.finalUrl)}</a></p>
        <p class="note">本页识别到 ${item.rows.length} 条活动；今日新增 ${newCount} 条；状态：<span class="status ok">浏览器可访问</span></p>
      </div>
      <img class="shot" src="${escapeHtml(screenshot)}" alt="${escapeHtml(item.brand)} 页面截图">
    </div>
    <table>
      <thead><tr><th>#</th><th>标题</th><th>奖励</th><th>参与要求</th><th>开始时间</th><th>结束时间</th><th>备注</th></tr></thead>
      <tbody>${item.rows.map((row, index) => renderRow(row, index)).join("\n")}</tbody>
    </table>
  </section>`;
}

function renderRow(row, index) {
  return `<tr>
    <td>${index + 1}</td>
    <td class="brand-name">${escapeHtml(row.title)} ${row.isNew ? '<span class="status mid">今日新增 / New Today</span>' : ""}</td>
    <td class="small">${cell(row.reward)}</td>
    <td class="small">${cell(row.requirement)}</td>
    <td>${cell(row.start)}</td>
    <td>${cell(row.end)}</td>
    <td class="small">${escapeHtml(row.detailStatusLabel || row.note || "列表页可见")}</td>
  </tr>`;
}

function cell(value) {
  if (!value || value === "列表页未显示") return `<span class="status missing">列表页未显示</span>`;
  return escapeHtml(value);
}

function kpi(value, label) {
  return `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderNewSummary(items, hasBaseline) {
  if (!hasBaseline) {
    return `<p class="note">当前报告是新增判断的基线版本。下一次日报会基于这份活动索引标记“今日新增”。</p>`;
  }
  const rows = [];
  for (const item of items) {
    for (const row of item.rows) {
      if (row.isNew) rows.push({ brand: item.brand, row });
    }
  }
  if (!rows.length) return `<p class="note">本轮未发现相对上一份历史报告的新增活动。</p>`;
  return `<div class="new-list">${rows.map(({ brand, row }) => `<div class="new-item"><strong>${escapeHtml(brand)} · ${escapeHtml(row.title)}</strong><span>${escapeHtml(row.reward || "奖励待确认")}</span></div>`).join("\n")}</div>`;
}

function parseBrand(item) {
  const lines = item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  switch (item.brand) {
    case "Stake":
      return parseStake(lines);
    case "BC Game":
      return parseEndsCards(lines, { startIndex: 5 });
    case "1xBet":
      return parseMarkerCards(lines, "BONUS OFFER DETAILS");
    case "JustCasino":
      return parseActionCards(lines, ["More Info"]);
    case "Betpanda":
      return parseBetpanda(lines);
    case "CoinCasino":
      return parseActionCards(lines, ["Read More"]);
    case "Velobet":
      return parseVelobet(lines);
    case "Megapari":
      return parseMarkerCards(lines, "FIND OUT MORE");
    case "Funbet":
      return parseFunbet(lines);
    case "Campeonbet":
      return parseActionCards(lines, ["Learn more"]);
    default:
      return parseGeneric(lines);
  }
}

async function loadPreviousActivityKeys(currentDate) {
  const entries = await fs.readdir("reports", { withFileTypes: true }).catch(() => []);
  const dated = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < currentDate)
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const candidate of dated) {
    const indexPath = path.join("reports", candidate, "activity-index.json");
    try {
      const data = JSON.parse(await fs.readFile(indexPath, "utf8"));
      return new Set((data.activities || []).map((item) => item.key));
    } catch {
      // Continue looking for the nearest historical index.
    }
  }
  return new Set();
}

async function writeActivityIndex(items) {
  const activities = [];
  for (const item of items) {
    for (const row of item.rows) {
      activities.push({
        key: row.activityKey,
        brand: item.brand,
        title: row.title,
        reward: row.reward,
        requirement: row.requirement,
        start: row.start,
        end: row.end,
        isNew: row.isNew
      });
    }
  }
  await fs.writeFile(
    path.join(reportDir, "activity-index.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), date, activities }, null, 2),
    "utf8"
  );
}

async function loadPromotionDetails() {
  const files = [
    path.join(reportDir, "browser-promo-details-live.json"),
    path.join(reportDir, "browser-promo-details.json")
  ];
  const byBrand = new Map();
  for (const file of files) {
    let payload;
    try {
      payload = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      continue;
    }
    for (const result of payload.results || []) {
      const details = byBrand.get(result.brand) || [];
      for (const detail of result.details || []) {
        if (!detail || detail.status === "error") continue;
        if (looksLikeBrowserError(detail)) continue;
        const existingIndex = details.findIndex((item) => item.url === detail.url);
        if (existingIndex >= 0) details[existingIndex] = detail;
        else details.push(detail);
      }
      byBrand.set(result.brand, details);
    }
  }
  return byBrand;
}

function enrichRowsWithDetails(items, detailByBrand) {
  const stats = { matched: 0, limited: 0, fallback: 0 };
  for (const item of items) {
    const details = detailByBrand.get(item.brand) || [];
    const used = new Set();
    for (const row of item.rows) {
      const detail = bestDetailForRow(row, details, used);
      if (!detail) {
        row.detailStatus = "fallback";
        row.detailStatusLabel = "列表页兜底 / Listing fallback";
        stats.fallback += 1;
        continue;
      }
      used.add(detail.url);
      const fields = detail.fields || {};
      row.detailStatus = detail.status === "ok" ? "ok" : "limited";
      row.detailStatusLabel = detail.status === "ok" ? "详情页已采集 / Detail captured" : "详情页正文有限 / Limited detail";
      row.detailUrl = detail.finalUrl || detail.url;
      row.detailTitle = clean(fields.title || detail.linkText || "");
      row.detailReward = clean(fields.reward || extractReward(`${detail.linkText || ""} ${detail.text || ""}`));
      row.detailRequirement = clean(fields.requirement || extractRequirement(`${detail.linkText || ""} ${detail.text || ""}`));
      row.detailDates = clean(Array.isArray(fields.dates) ? fields.dates.slice(0, 5).join("; ") : "");
      row.detailExcerpt = clean(fields.excerpt || detail.text || "").slice(0, 2600);
      if ((!row.reward || row.reward === "列表页未显示") && row.detailReward) row.reward = row.detailReward;
      if ((!row.requirement || row.requirement === "列表页未显示") && row.detailRequirement) row.requirement = row.detailRequirement;
      if ((!row.end || row.end === "列表页未显示") && row.detailDates) row.end = row.detailDates;
      if (row.detailStatus === "ok") stats.matched += 1;
      else stats.limited += 1;
    }
  }
  return stats;
}

function bestDetailForRow(row, details, used) {
  const rowKey = normalizeMatch(row.title);
  if (!rowKey) return null;
  let best = null;
  let bestScore = 0;
  for (const detail of details) {
    if (used.has(detail.url)) continue;
    const fields = detail.fields || {};
    const candidates = [
      fields.title,
      detail.linkText,
      detail.pageTitle,
      detail.url && detail.url.split("/").pop()
    ].map(normalizeMatch).filter(Boolean);
    let score = 0;
    for (const candidate of candidates) {
      score = Math.max(score, matchScore(rowKey, candidate));
    }
    if (score > bestScore) {
      best = detail;
      bestScore = score;
    }
  }
  return bestScore >= 46 ? best : null;
}

function matchScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 82;
  const aTokens = new Set(a.split("-").filter((token) => token.length > 2));
  const bTokens = new Set(b.split("-").filter((token) => token.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return Math.round((overlap / Math.max(aTokens.size, bTokens.size)) * 100);
}

function normalizeMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/bonus offer details|find out more|read more|learn more|select/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !["the", "and", "with", "your", "for", "from", "our"].includes(token))
    .join("-");
}

function looksLikeBrowserError(detail) {
  const text = `${detail.error || ""} ${detail.text || ""} ${detail.fields?.title || ""}`;
  return /blocked browser navigation|this site can.?t be reached|err_connection|took too long to respond/i.test(text);
}

function activityKey(brand, row) {
  return `${normalizeKey(brand)}::${normalizeKey(row.title)}::${normalizeKey(row.reward)}`;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(listing page not shown|not shown|列表页未显示)\b/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 180);
}

function parseStake(lines) {
  const rows = [];
  for (let i = 10; i < lines.length - 3; i += 1) {
    if (lines[i + 2] === "Ends at") {
      rows.push(baseRow(lines[i], lines[i + 1], "", "", lines[i + 3]));
      i += 3;
    }
  }
  return rows;
}

function parseEndsCards(lines, { startIndex = 0 } = {}) {
  const rows = [];
  for (let i = startIndex; i < lines.length - 1; i += 1) {
    if (lines[i] === "Ends" || lines[i] === "Ends at" || lines[i] === "Ends in") {
      const end = lines[i] === "Ends in" ? `倒计时：${lines[i + 1] || ""}` : lines[i + 1] || "";
      const prev = lines.slice(Math.max(startIndex, i - 4), i).filter((line) => !isCategory(line));
      const title = prev[prev.length - 2] || prev[0] || "未命名活动";
      const reward = extractReward(prev.join(" ")) || prev[prev.length - 3] || "";
      const req = prev[prev.length - 1] || "";
      rows.push(baseRow(title, reward, req, "", end));
    }
  }
  return dedupeRows(rows);
}

function parseMarkerCards(lines, marker) {
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] !== marker) continue;
    const prev = lines.slice(Math.max(0, i - 3), i).filter((line) => !isNav(line));
    if (!prev.length) continue;
    const title = prev.length >= 2 ? prev[prev.length - 2] : prev[0];
    const desc = prev.length >= 2 ? prev[prev.length - 1] : "";
    rows.push(baseRow(title, extractReward(`${title} ${desc}`) || desc, extractRequirement(`${title} ${desc}`), "", extractEnd(`${title} ${desc}`), desc));
  }
  return dedupeRows(rows);
}

function parseActionCards(lines, markers) {
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!markers.includes(lines[i])) continue;
    const start = findCardStart(lines, i);
    const chunk = lines.slice(start, i).filter((line) => !isNav(line) && !/^join now!?$/i.test(line) && !/^bet now$/i.test(line) && !/^play now$/i.test(line) && !/^deposit now$/i.test(line) && !/^switch now$/i.test(line));
    if (!chunk.length) continue;
    const title = chooseTitle(chunk);
    const text = chunk.join(" ");
    rows.push(baseRow(title, extractReward(text), extractRequirement(text), extractStart(text), extractEnd(text), chunk.filter((line) => line !== title).join(" ")));
  }
  return dedupeRows(rows);
}

function parseBetpanda(lines) {
  const titles = [
    "Sign-Up Offer",
    "Exclusive Rakeback",
    "Weekly Cashback",
    "Live Casino Cashback Boost",
    "Weekly Raffle",
    "Get Rewarded For Your Play",
    "Get a Weekly Free Bet",
    "Earn Points On Your Winning Bets",
    "Unlock Bigger Wins",
    "Build Your Perfect Bet",
    "Lock your Profits"
  ];
  const rows = [];
  for (const title of titles) {
    const idx = lines.indexOf(title);
    if (idx >= 0) {
      const desc = lines[idx + 1] || "";
      rows.push(baseRow(title, extractReward(`${title} ${desc}`) || desc, extractRequirement(`${title} ${desc}`), "", title === "Weekly Cashback" ? "倒计时显示在页面顶部" : "", desc));
    }
  }
  return rows;
}

function parseVelobet(lines) {
  const rows = [];
  let chunk = [];
  for (const line of lines.slice(23)) {
    if (/^(Read More|Register)$/i.test(line)) {
      if (chunk.length) rows.push(rowFromChunk(chunk));
      chunk = [];
      continue;
    }
    if (/^(BET NOW|Terms & Conditions|TERMS & CONDITIONS)$/i.test(line)) continue;
    chunk.push(line);
  }
  if (chunk.length) rows.push(rowFromChunk(chunk));
  return dedupeRows(rows).slice(0, 30);
}

function parseFunbet(lines) {
  const rows = [];
  for (let i = 7; i < lines.length - 1; i += 1) {
    if (lines[i + 1] === "GET BONUS" || lines[i + 1] === "PLAY NOW" || lines[i + 1] === "SHOP NOW" || lines[i + 1] === "GET STARTED" || lines[i + 1] === "COLLECT NOW") {
      const category = isCategory(lines[i - 1]) ? lines[i - 1] : "";
      rows.push(baseRow(lines[i], extractReward(lines[i]), extractRequirement(lines[i]), "", "", category));
    }
  }
  return dedupeRows(rows);
}

function parseGeneric(lines) {
  return lines
    .filter((line) => line.length > 8 && !isNav(line))
    .slice(0, 30)
    .map((line) => baseRow(line, extractReward(line), extractRequirement(line), extractStart(line), extractEnd(line)));
}

function rowFromChunk(chunk) {
  const text = chunk.join(" ");
  const title = chooseTitle(chunk);
  return baseRow(title, extractReward(text), extractRequirement(text), extractStart(text), extractEnd(text), chunk.filter((line) => line !== title).slice(0, 8).join(" "));
}

function baseRow(title, reward = "", requirement = "", start = "", end = "", note = "") {
  return {
    title: clean(title),
    reward: clean(reward) || "列表页未显示",
    requirement: clean(requirement) || "列表页未显示",
    start: clean(start) || "列表页未显示",
    end: clean(end) || "列表页未显示",
    note: clean(note)
  };
}

function chooseTitle(chunk) {
  const filtered = chunk.filter((line) => !isCategory(line) && !/^\d+$/.test(line) && !/^[$€£]?\d/.test(line));
  return filtered[0] || chunk[0] || "未命名活动";
}

function findCardStart(lines, markerIndex) {
  for (let i = markerIndex - 1; i >= 0; i -= 1) {
    if (/^(More Info|Read More|Learn more|GET BONUS|FIND OUT MORE)$/i.test(lines[i])) return i + 1;
  }
  return Math.max(0, markerIndex - 5);
}

function extractReward(text) {
  const matches = [...String(text).matchAll(/(?:up to\s*)?(?:[$€£]|R\$)\s?[\d,.]+|(?:up to\s*)?\d+(?:[,.]\d+)?\s?(?:BTC|MYR|FS|Free Spins|free spins|freespins|FB|Coins|promo points)|\d+% ?(?:bonus|cashback|rakeback|extra|reload|boost|refund)?|€[\d,.]+|\\$[\d,.]+/gi)].map((m) => m[0].trim());
  return [...new Set(matches)].slice(0, 5).join("; ");
}

function extractRequirement(text) {
  const matches = [...String(text).matchAll(/(?:minimum|min\\.?|bet|wager|deposit|odds|selection|qualif|requirement|complete|place|play|losses|cashback).{0,120}/gi)].map((m) => m[0].trim());
  return [...new Set(matches)].slice(0, 3).join("; ");
}

function extractStart(text) {
  const m = String(text).match(/(?:start(?:s)?|from|date of bet)[: ]+.{0,60}/i);
  return m ? m[0] : "";
}

function extractEnd(text) {
  const m = String(text).match(/(?:ends?|until|expires?|valid until)[: ]+.{0,60}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2}(?:,?\\s*\\d{4})?|\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}/i);
  return m ? m[0] : "";
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.title.toLowerCase();
    if (!row.title || seen.has(key) || isNav(row.title)) return false;
    seen.add(key);
    return true;
  });
}

function isCategory(line) {
  return /^(All|Casino|Sport|Sports|Slots|Live|Prize Drops|Welcome Offer|Community|Poker|Esports|Special|Specials|WELCOME|PROMOTION RULES|MINIMUM QUALIFICATION|CASHBACK OFFER|BET CONDITIONS|EXCLUSIVE|SLOTS|Archived)$/i.test(line);
}

function isNav(line) {
  return /^(login|log in|register|sign up|promotions|all promotions|all|casino|sport|sports|live|menu|close|language|english|find out more|bonus offer details|read more|more info|learn more|get bonus|join now!?|show more|previous|next)$/i.test(line);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
