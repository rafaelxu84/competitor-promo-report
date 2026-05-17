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
const bilingualPath = path.join(reportDir, "promo-report-bilingual.html");
const latestPath = path.join("reports", "latest-cn-visual.html");
const observations = JSON.parse(await fs.readFile(inputPath, "utf8"));

const previousKeys = await loadPreviousActivityKeys(date);
const hasPreviousBaseline = previousKeys.size > 0;
const detailData = await loadPromotionDetails();
const parsed = observations.results.map((item) => {
  const listingRows = parseBrand(item);
  const detailRows = rowsFromDetails(detailData.get(item.brand) || []);
  return {
    ...item,
    rows: mergeActivityRows(listingRows, detailRows)
  };
});
for (const item of parsed) {
  for (const row of item.rows) {
    row.activityKey = activityKey(item.brand, row);
    row.isNew = hasPreviousBaseline && !previousKeys.has(row.activityKey);
  }
}
const detailStats = enrichRowsWithDetails(parsed, detailData);

const totalRows = parsed.reduce((sum, item) => sum + item.rows.length, 0);

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
      ${kpi(String(detailStats.matched), "详情页匹配")}
      ${kpi(String(parsed.filter((item) => item.status === "ok").length), "浏览器可访问")}
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
await fs.writeFile(bilingualPath, html, "utf8");
await fs.writeFile(latestPath, html, "utf8");
await writeActivityIndex(parsed);
await generateStaticSite(parsed, totalRows);
console.log(outputPath);
console.log(mirrorPath);
console.log(bilingualPath);
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
  await fs.writeFile(path.join("reports", "latest-site.html"), redirectHtml(path.join(date, "site", "index.html")), "utf8");
}

function renderSiteIndex(items, rowCount) {
  const capturedScreenshots = items.reduce((sum, item) => sum + item.rows.filter((row) => row.detailScreenshot).length, 0);
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
        <b>截图 Shots</b>${capturedScreenshots}
      </div>
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
  const detailCount = item.rows.filter((row) => row.detailStatus === "ok").length;
  return `<a class="brand-card" href="brands/${slug(item.brand)}.html">
    <img src="${escapeHtml(shot)}" alt="${escapeHtml(item.brand)} screenshot">
    <div>
      <h2>${escapeHtml(item.brand)}</h2>
      <p>${item.rows.length} 条活动 / ${item.rows.length} activities</p>
      <p>${detailCount} 条详情页已匹配 / ${detailCount} detail pages matched</p>
      <p>${renderStatusLabel(item)}${item.error ? `（${escapeHtml(String(item.error).slice(0, 180))}）` : ""}</p>
      <span>打开品牌详情 / Open brand page</span>
    </div>
  </a>`;
}

function renderBrandPage(item) {
  const shot = path.join("..", "..", "browser-screenshots", path.basename(item.screenshot));
  const detailScreens = item.rows.filter((row) => row.detailScreenshot).length;
  const statusLine = `${renderStatusLabel(item)}${item.error ? `（${escapeHtml(String(item.error).slice(0, 220))}）` : ""}`;
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
        <p class="sub">本页优先使用活动详情页截图与可见内容，输出要求、Trigger、Reward、Who、When、Summary、核心目的和数据预期。</p>
        <p class="sub">${statusLine}</p>
      </div>
      <div class="meta">
        <b>活动 Activities</b>${item.rows.length}<br>
        <b>详情 Details</b>${item.rows.filter((row) => row.detailStatus === "ok").length}<br>
        <b>详情截图 Shots</b>${detailScreens}<br>
        <b>状态 Status</b>${escapeHtml(String(item.status || "needs_review"))}
      </div>
    </section>

    <section class="visual">
      <img src="${escapeHtml(shot)}" alt="${escapeHtml(item.brand)} screenshot">
    </section>

    <section class="activity-list">
      ${
        item.rows.length
          ? item.rows.map((row, index) => renderActivityCard(row, index)).join("\n")
          : `<div class="activity-card detail-missing"><h2>未解析到活动 / No activities parsed</h2><p class="sub">列表页可能为 JS 渲染、需要登录或本次抓取失败。请参考截图并标记“列表页兜底 / Listing fallback”或“详情页正文有限 / Limited detail”。</p></div>`
      }
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
  const analysis = row.analysis || buildActivityAnalysis(row);
  return `<article class="activity-card ${detailClass}">
    <div class="activity-head">
      <span class="index">${index + 1}</span>
      <div>
        <h2>${escapeHtml(row.title)} ${row.isNew ? '<span class="new-badge">今日新增 / New Today</span>' : ""}</h2>
        <p>${escapeHtml(type)} · ${detailBadge(row)}</p>
      </div>
    </div>
${row.detailScreenshot ? `<a class="detail-shot-link" href="${escapeHtml(row.detailScreenshot)}"><img class="detail-shot" src="${escapeHtml(row.detailScreenshot)}" alt="${escapeHtml(row.title)} detail screenshot"></a>` : ""}
    <dl>
      <div><dt>要求 / Requirements</dt><dd>${field(analysis.requirement)}</dd></div>
      <div><dt>触发条件 / Trigger</dt><dd>${field(analysis.trigger)}</dd></div>
      <div><dt>奖励方式 / Reward</dt><dd>${field(analysis.reward)}</dd></div>
      <div><dt>目标用户 / Who</dt><dd>${field(analysis.who)}</dd></div>
      <div><dt>时间 / When</dt><dd>${field(analysis.when)}</dd></div>
      <div><dt>Summary / 总结</dt><dd>${field(analysis.summary)}</dd></div>
      <div><dt>核心目的 / Objective</dt><dd>${field(analysis.objective)}</dd></div>
      <div><dt>数据预期 / Expected Data</dt><dd>${field(analysis.dataExpectation)}</dd></div>
      <div><dt>详情页来源 / Detail Source</dt><dd>${row.detailUrl ? `<a href="${escapeHtml(row.detailUrl)}">${escapeHtml(row.detailUrl)}</a>` : '<span class="missing-text">未匹配详情页 / No detail page matched</span>'}</dd></div>
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
    .status { display:inline-flex; align-items:center; border-radius:999px; padding:3px 8px; font-size:12px; font-weight:800; white-space:nowrap; }
    .ok { color:var(--green); background:#e5f3ed; }
    .mid { color:var(--amber); background:#fff4df; }
    .blue { color:var(--blue); background:#e9f0fb; }
    .low { color:var(--red); background:#faeeee; }
    .meta { background:#f8faf7; border:1px solid var(--line); border-radius:8px; padding:14px; }
    .meta b { display:inline-block; min-width:92px; color:var(--ink); }
    .brand-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .brand-card { display:grid; grid-template-columns:220px minmax(0,1fr); gap:14px; padding:14px; color:var(--ink); text-decoration:none; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .brand-card img, .visual img { width:100%; border:1px solid var(--line); border-radius:8px; background:#edf0ea; object-fit:cover; }
    .brand-card img { aspect-ratio:16/10; }
    .brand-card span { display:inline-flex; margin-top:10px; color:var(--blue); font-weight:700; }
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
    .detail-shot-link { display:block; margin:8px 0 12px; }
    .detail-shot { width:100%; max-height:360px; object-fit:cover; object-position:top; border:1px solid var(--line); border-radius:8px; background:#edf0ea; }
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
    @media (max-width:900px) { .hero, .brand-grid, .brand-card, .activity-list { grid-template-columns:1fr; } h1 { font-size:27px; } dl div { grid-template-columns:1fr; } }
  </style>`;
}

function renderStatusLabel(item) {
  const status = String(item?.status || "needs_review");
  if (status === "ok") return '<span class="status ok">可访问 / OK</span>';
  if (status === "limited") return '<span class="status mid">正文有限 / Limited detail</span>';
  if (status.startsWith("http_")) return `<span class="status low">HTTP ${escapeHtml(status.slice(5))}</span>`;
  if (status === "blocked" || status === "captcha_or_human_check" || status === "js_required_or_blocked") {
    return '<span class="status low">受限 / Blocked</span>';
  }
  if (status === "error") return '<span class="status low">抓取失败 / Error</span>';
  return '<span class="status blue">需复核 / Needs review</span>';
}

function renderBrandSection(item) {
  const screenshot = path.relative(reportDir, item.screenshot);
  const statusLabel = `${renderStatusLabel(item)}${item.error ? `（${escapeHtml(String(item.error).slice(0, 220))}）` : ""}`;
  return `<section id="${slug(item.brand)}">
    <h2>${escapeHtml(item.brand)}</h2>
    <div class="brand-head">
      <div>
        <p class="note">来源：<a href="${escapeHtml(item.finalUrl)}">${escapeHtml(item.finalUrl)}</a></p>
        <p class="note">本页识别到 ${item.rows.length} 条在线活动；状态：${statusLabel}</p>
      </div>
      <img class="shot" src="${escapeHtml(screenshot)}" alt="${escapeHtml(item.brand)} 页面截图">
    </div>
    <table>
      <thead><tr><th>#</th><th>标题</th><th>奖励</th><th>参与要求</th><th>开始时间</th><th>结束时间</th><th>备注</th></tr></thead>
      <tbody>${item.rows.length ? item.rows.map((row, index) => renderRow(row, index)).join("\n") : `<tr><td colspan="7"><span class="status missing">列表页未解析到活动；请以截图人工复核</span></td></tr>`}</tbody>
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
    path.join(reportDir, "browser-promo-details.json"),
    path.join(reportDir, "browser-promo-details-live.json")
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
        if (existingIndex >= 0) details[existingIndex] = { ...details[existingIndex], ...detail };
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
      if (row.detailUrl || row.detailScreenshot) {
        row.detailStatus = row.detailStatus || "ok";
        row.detailStatusLabel =
          row.detailStatus === "ok" ? "详情页已采集 / Detail captured" : "详情页正文有限 / Limited detail";
        row.detailUrl = row.detailUrl || row.sourceUrl || "";
        row.detailScreenshot = row.detailScreenshot ? normalizeScreenshotPath(row.detailScreenshot) : "";
        row.analysis = buildActivityAnalysis(row);
        if (row.detailStatus === "ok") stats.matched += 1;
        else stats.limited += 1;
        continue;
      }
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
      row.detailScreenshot = normalizeScreenshotPath(detail.screenshot);
      row.analysis = buildActivityAnalysis(row);
      if ((!row.reward || row.reward === "列表页未显示") && row.detailReward) row.reward = row.detailReward;
      if ((!row.requirement || row.requirement === "列表页未显示") && row.detailRequirement) row.requirement = row.detailRequirement;
      if ((!row.end || row.end === "列表页未显示") && row.detailDates) row.end = row.detailDates;
      if (row.detailStatus === "ok") stats.matched += 1;
      else stats.limited += 1;
    }
  }
  return stats;
}

function rowsFromDetails(details) {
  const rows = [];
  for (const detail of details || []) {
    if (!detail || looksLikeBrowserError(detail)) continue;
    const fields = detail.fields || {};
    const title = clean(detail.linkText || detail.pageTitle || fields.title || "").slice(0, 140);
    if (!title) continue;
    const reward = clean(fields.reward || extractReward(`${detail.linkText || ""} ${detail.text || ""}`));
    const requirement = clean(fields.requirement || extractRequirement(`${detail.linkText || ""} ${detail.text || ""}`));
    const dates = clean(Array.isArray(fields.dates) ? fields.dates.slice(0, 4).join("; ") : "");
    const row = baseRow(title, reward, requirement, "", dates, "详情页兜底 / Detail fallback");
    row.sourceUrl = detail.finalUrl || detail.url;
    row.detailUrl = detail.finalUrl || detail.url;
    row.detailTitle = title;
    row.detailReward = reward;
    row.detailRequirement = requirement;
    row.detailDates = dates;
    row.detailExcerpt = clean(fields.excerpt || detail.text || "").slice(0, 2600);
    row.detailScreenshot = normalizeScreenshotPath(detail.screenshot);
    row.detailStatus = detail.status === "ok" ? "ok" : "limited";
    row.detailStatusLabel = detail.status === "ok" ? "详情页已采集 / Detail captured" : "详情页正文有限 / Limited detail";
    row.analysis = buildActivityAnalysis(row);
    rows.push(row);
  }

  return rows;
}

function mergeActivityRows(listingRows, detailRows) {
  const merged = [];
  const seen = new Set();

  for (const row of detailRows) {
    const key = rowIdentity(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  for (const row of listingRows) {
    const key = rowIdentity(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}

function rowIdentity(row) {
  const urlKey = normalizeKey(row.detailUrl || row.sourceUrl || "");
  if (urlKey) return urlKey;
  const titleKey = normalizeMatch(row.detailTitle || row.title);
  if (titleKey) return titleKey;
  return normalizeKey(`${row.title} ${row.reward} ${row.requirement}`);
}

function buildActivityAnalysis(row) {
  const source = clean([
    row.title,
    row.reward,
    row.requirement,
    row.detailReward,
    row.detailRequirement,
    row.detailDates,
    row.detailExcerpt,
    row.note
  ].filter(Boolean).join(" "));
  const type = inferBilingualType(source);
  const reward = clean(row.detailReward || row.reward || extractReward(source)) || "活动页未明确奖励；需查看详情页截图或条款确认";
  const requirement = clean(row.detailRequirement || row.requirement || extractRequirement(source)) || inferRequirement(source, type);
  const trigger = inferTrigger(source, type);
  const who = inferAudience(source, type);
  const when = conciseWhen(row, source);
  const objective = inferObjective(source, type);
  return {
    requirement,
    trigger,
    reward,
    who,
    when,
    summary: buildSummary(row, trigger, reward, requirement, who),
    objective,
    dataExpectation: inferDataExpectation(source, type, objective)
  };
}

function inferRequirement(text, type) {
  const lower = text.toLowerCase();
  if (lower.includes("deposit") || lower.includes("welcome")) return "完成指定充值或首充后参与，具体最低金额以详情页条款为准";
  if (lower.includes("wager") || lower.includes("bet")) return "完成指定投注或流水任务后参与，投注品类和最低金额以活动页为准";
  if (lower.includes("free spin") || lower.includes("fs")) return "按活动指定游戏、每日任务或充值条件领取免费旋转";
  if (lower.includes("cashback")) return "产生符合条件的亏损、投注额或游戏行为后按比例返还";
  if (lower.includes("raffle") || lower.includes("tournament") || lower.includes("race")) return "通过投注、游戏排名、抽奖票或积分累计进入排名/抽奖";
  return `${type}，具体门槛需以详情页截图和条款为准`;
}

function inferTrigger(text, type) {
  const lower = text.toLowerCase();
  if (lower.includes("opt in") || lower.includes("opt-in") || lower.includes("join")) return "点击参与/报名后，完成活动指定行为触发奖励";
  if (lower.includes("first deposit") || lower.includes("welcome")) return "新用户注册并完成首充触发";
  if (lower.includes("deposit")) return "用户完成指定充值触发";
  if (lower.includes("wager")) return "用户达到指定投注额或流水触发";
  if (lower.includes("place bet") || lower.includes("bet on") || lower.includes("odds")) return "用户在指定赛事/玩法下注触发";
  if (lower.includes("free spin") || lower.includes("fs")) return "用户进入指定老虎机/游戏或完成每日任务触发";
  if (lower.includes("cashback")) return "用户发生符合条件的亏损或投注行为后按周期触发返现";
  if (lower.includes("vote")) return "用户完成投票/外部互动后触发奖励";
  if (lower.includes("subscribe") || lower.includes("telegram")) return "用户完成订阅、关注或社群动作后触发";
  if (type.includes("竞赛") || type.includes("Raffle")) return "用户通过投注或游戏行为累计积分/票券/排名触发";
  return "完成活动页指定动作后触发";
}

function inferAudience(text, type) {
  const lower = text.toLowerCase();
  const audiences = [];
  if (lower.includes("new") || lower.includes("welcome") || lower.includes("first deposit")) audiences.push("新注册/首充用户");
  if (lower.includes("vip") || lower.includes("loyalty") || lower.includes("rakeback")) audiences.push("VIP 或高价值活跃用户");
  if (lower.includes("casino") || lower.includes("slot") || lower.includes("free spin") || lower.includes("fs")) audiences.push("Casino/Slots 用户");
  if (lower.includes("sport") || lower.includes("football") || lower.includes("nba") || lower.includes("bet on") || lower.includes("odds")) audiences.push("体育投注用户");
  if (lower.includes("crypto")) audiences.push("加密货币充值用户");
  if (lower.includes("esport") || lower.includes("dota") || lower.includes("counter-strike")) audiences.push("电竞投注用户");
  if (lower.includes("poker")) audiences.push("扑克用户");
  if (!audiences.length) audiences.push(type.replace(" / ", " 用户 / "));
  return [...new Set(audiences)].slice(0, 3).join("；");
}

function conciseWhen(row, text) {
  const candidates = [row.end, row.detailDates, row.start]
    .filter((value) => value && value !== "列表页未显示")
    .map((value) => clean(value));
  if (candidates.length) return candidates[0].split(";").slice(0, 2).join("; ");
  const lower = text.toLowerCase();
  if (lower.includes("every monday")) return "每周一";
  if (lower.includes("every tuesday")) return "每周二";
  if (lower.includes("every wednesday")) return "每周三";
  if (lower.includes("every thursday")) return "每周四";
  if (lower.includes("every friday")) return "每周五";
  if (lower.includes("every sunday")) return "每周日";
  if (lower.includes("weekly")) return "每周周期";
  if (lower.includes("daily") || lower.includes("every day")) return "每日周期";
  return "活动页未明确；以页面实时倒计时或条款为准";
}

function buildSummary(row, trigger, reward, requirement, who) {
  return `${clean(row.title)} 面向${who}，通过“${trigger}”推动用户完成关键行为；奖励为 ${reward}。主要参与要求：${requirement}。`;
}

function inferObjective(text, type) {
  const lower = text.toLowerCase();
  if (lower.includes("welcome") || lower.includes("first deposit") || lower.includes("sign-up")) return "拉新与首充转化";
  if (lower.includes("deposit") || lower.includes("reload")) return "提升充值频次和充值金额";
  if (lower.includes("cashback") || lower.includes("rakeback")) return "提升留存、降低流失感知并延长生命周期";
  if (lower.includes("free spin") || lower.includes("fs")) return "引导 Casino/Slots 试玩与日活";
  if (lower.includes("tournament") || lower.includes("race") || lower.includes("league") || lower.includes("raffle")) return "提升投注/游戏频次，制造排行榜竞争和连续参与";
  if (lower.includes("odds") || lower.includes("free bet") || lower.includes("football") || lower.includes("nba")) return "提升体育投注投注额和赛事活跃";
  if (lower.includes("vip") || lower.includes("loyalty")) return "维护高价值用户并提升复玩";
  return `${type}的转化与活跃提升`;
}

function inferDataExpectation(text, type, objective) {
  const lower = text.toLowerCase();
  const metrics = [];
  if (/welcome|first deposit|sign-up/.test(lower)) metrics.push("注册到首充转化率、首存金额、首周留存上升");
  if (/deposit|reload/.test(lower)) metrics.push("充值次数、充值金额、Bonus claim rate 上升");
  if (/wager|bet|odds|free bet|sport|football|nba/.test(lower)) metrics.push("投注额、投注单量、有效投注用户数上升");
  if (/casino|slot|free spin|fs/.test(lower)) metrics.push("Casino DAU、游戏启动次数、免费旋转转付费率上升");
  if (/cashback|rakeback|vip|loyalty/.test(lower)) metrics.push("复玩率、留存率、VIP 活跃和净收入稳定性提升");
  if (/tournament|race|raffle|league|prize/.test(lower)) metrics.push("连续参与天数、排名页访问、任务完成率上升");
  if (!metrics.length) metrics.push("活动点击率、参与率、奖励领取率和后续投注/充值转化提升");
  return `${objective}；预期观察：${[...new Set(metrics)].slice(0, 3).join("；")}。`;
}

function normalizeScreenshotPath(value) {
  if (!value) return "";
  const normalized = String(value).replace(/\\/g, "/");
  const marker = `/reports/${date}/`;
  const index = normalized.indexOf(marker);
  if (index >= 0) return `../../${normalized.slice(index + marker.length)}`;
  if (normalized.startsWith(`reports/${date}/`)) return `../../${normalized.slice(`reports/${date}/`.length)}`;
  if (normalized.startsWith("detail-screenshots/")) return `../../${normalized}`;
  return normalized;
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
