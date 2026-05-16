import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, todayISO } from "./utils.mjs";
import { loadConfig } from "./config.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const reportDir = path.join("reports", date);
const inputPath = path.join(reportDir, "promotions.json");
const outputPath = path.join(reportDir, "promo-report-cn-visual.html");
const mirrorPath = path.join(reportDir, "promo-report-bilingual.html");
const run = JSON.parse(await fs.readFile(inputPath, "utf8"));

const successfulBrands = run.competitors.filter((item) => item.status === "ok");
const needsReviewRows = run.competitors
  .filter((item) => item.status !== "ok")
  .map((competitor) => {
    const statuses = competitor.pages.map((page) => page.status);
    return {
      brand: competitor.displayName,
      reason: explainStatuses(statuses, competitor.notes),
      action: nextAction(statuses),
      detail: competitor.notes.join("; ") || competitor.pages.map((page) => `${page.name}: ${page.status}`).join("; ")
    };
  });

const brandSummaries = run.competitors.map((competitor) => {
  const promos = run.promotions.filter((promo) => promo.displayName === competitor.displayName);
  const categories = inferCategories(promos);
  return {
    brand: competitor.displayName,
    status: competitor.status,
    candidates: promos.length,
    pages: competitor.pages.length,
    categories,
    notes: competitor.notes.join("; ") || "-"
  };
});

const activityRows = summarizeActivities(run.promotions);
const matrixRows = buildMatrixRows(brandSummaries, run.promotions);
const topCards = brandSummaries
  .slice()
  .sort((a, b) => b.candidates - a.candidates)
  .slice(0, 4);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>竞品活动日报 ${escapeHtml(run.date)}</title>
  <style>
    :root {
      --bg: #f5f6f2;
      --ink: #16201b;
      --muted: #68746f;
      --line: #d8ddd5;
      --panel: #ffffff;
      --green: #0f7b5c;
      --blue: #255d9d;
      --red: #a54040;
      --amber: #9b6a16;
      --soft-green: #e5f3ed;
      --soft-blue: #e9f0fb;
      --soft-red: #faeeee;
      --soft-amber: #fff4df;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.45;
    }
    .page { max-width: 1280px; margin: 0 auto; padding: 28px 18px 56px; }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 18px;
      align-items: stretch;
      margin-bottom: 18px;
    }
    .hero, .panel, .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .hero { padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 21px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0; }
    .sub { color: var(--muted); }
    .meta { padding: 18px; display: grid; gap: 12px; }
    .meta b { color: var(--muted); display: block; font-size: 12px; margin-bottom: 2px; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .kpi { padding: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .kpi strong { display: block; font-size: 30px; line-height: 1; }
    .kpi span { color: var(--muted); font-size: 13px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .brand-card { padding: 16px; min-height: 132px; }
    .brand-card .num { font-size: 28px; font-weight: 800; }
    .brand-card.ok { border-color: #b9dccd; background: var(--soft-green); }
    .brand-card.warn { border-color: #edd6a4; background: var(--soft-amber); }
    .brand-card.block { border-color: #edc6c6; background: var(--soft-red); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      padding: 10px 11px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      font-size: 13px;
    }
    th { background: #ecefe8; color: #3d4742; font-size: 12px; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .status {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }
    .s-ok { color: var(--green); background: var(--soft-green); }
    .s-mid { color: var(--amber); background: var(--soft-amber); }
    .s-low { color: var(--red); background: var(--soft-red); }
    .s-blue { color: var(--blue); background: var(--soft-blue); }
    .section-note { margin-bottom: 12px; color: var(--muted); }
    .legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 12px; }
    .pill {
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      display: inline-flex;
      margin: 0 4px 4px 0;
    }
    .brand-title { font-weight: 800; }
    .compact { max-width: 360px; }
    details {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 12px;
    }
    summary { cursor: pointer; font-weight: 800; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #111714;
      color: #eef6f0;
      padding: 12px;
      border-radius: 8px;
      max-height: 240px;
      overflow: auto;
      font-size: 12px;
    }
    a { color: var(--blue); }
    .footer { color: var(--muted); font-size: 12px; margin-top: 22px; }
    @media (max-width: 1080px) {
      .top, .grid-4 { grid-template-columns: 1fr; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      h1 { font-size: 27px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div class="hero">
        <h1>竞品活动日报</h1>
        <p class="sub">中文版可视化报告。基于你提供的 10 个活动来源，使用 Playwright 真实浏览器抓取公开页面，不包含登录后个性化 offer。</p>
      </div>
      <div class="meta panel">
        <div><b>报告日期</b>${escapeHtml(run.date)}</div>
        <div><b>生成时间</b>${escapeHtml(run.generatedAt)}</div>
        <div><b>数据源</b><a href="promotions.json">promotions.json</a>、截图和 HTML 快照</div>
      </div>
    </section>

    <section class="kpis">
      ${kpi(String(run.competitors.length), "监控品牌")}
      ${kpi(String(successfulBrands.length), "成功抓取品牌")}
      ${kpi(String(run.promotions.length), "原始活动候选")}
      ${kpi(String(needsReviewRows.length), "需复核品牌")}
    </section>

    <h2>一眼看懂</h2>
    <section class="grid-4">
      ${topCards.map(renderTopCard).join("\n")}
    </section>

    <h2>活动矩阵</h2>
    <p class="section-note">矩阵由抓取文本关键词自动判断，用于快速扫描；最终活动详情请以下方“活动详情表”和原始证据为准。</p>
    <table>
      <thead>
        <tr><th>品牌</th><th>候选数</th><th>首存/充值</th><th>Freebet</th><th>Cashback</th><th>Free Spins</th><th>VIP/忠诚度</th><th>任务/竞赛</th><th>Rakeback</th><th>状态</th></tr>
      </thead>
      <tbody>${matrixRows.map(renderMatrixRow).join("\n")}</tbody>
    </table>

    <h2>活动详情表</h2>
    <div class="legend">
      <span class="pill">高：详情页/规则页明确</span>
      <span class="pill">中：公开页确认但规则不完整</span>
      <span class="pill">低：标题化、重复或被截断，需人工复核</span>
    </div>
    <table>
      <thead>
        <tr><th>品牌</th><th>活动</th><th>类型</th><th>奖励线索</th><th>门槛/有效期线索</th><th>来源</th><th>可信度</th></tr>
      </thead>
      <tbody>${activityRows.map(renderActivityRow).join("\n")}</tbody>
    </table>

    <h2>Needs Review 是什么情况</h2>
    <p class="section-note">Needs review 指“本轮没有拿到完整公开活动信息”，不是判断该品牌没有活动。</p>
    <table>
      <thead><tr><th>品牌</th><th>原因</th><th>下一步</th><th>原始状态</th></tr></thead>
      <tbody>${needsReviewRows.map(renderNeedsReviewRow).join("\n")}</tbody>
    </table>

    <h2>抓取覆盖状态</h2>
    <table>
      <thead><tr><th>品牌</th><th>状态</th><th>活动候选数</th><th>页面数</th><th>备注</th></tr></thead>
      <tbody>${brandSummaries.map(renderCoverageRow).join("\n")}</tbody>
    </table>

    <details>
      <summary>查看原始候选摘要</summary>
      ${renderRaw(run.promotions)}
    </details>

    <p class="footer">生成文件：${escapeHtml(outputPath)}。原始 HTML/截图保存在 snapshots/${escapeHtml(run.date)} 和 screenshots/${escapeHtml(run.date)}。</p>
  </main>
</body>
</html>`;

await fs.writeFile(outputPath, html, "utf8");
await fs.writeFile(mirrorPath, html, "utf8");
console.log(outputPath);
console.log(mirrorPath);

function kpi(value, label) {
  return `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderTopCard(row) {
  const cls = row.status === "ok" ? "ok" : row.notes.includes("403") || row.notes.toLowerCase().includes("blocked") ? "block" : "warn";
  const categoryText = row.categories.length ? row.categories.join("、") : "未识别";
  return `<div class="card brand-card ${cls}">
    <h3>${escapeHtml(row.brand)}</h3>
    <div class="num">${row.candidates}</div>
    <p>${escapeHtml(row.status === "ok" ? "已抓到活动候选" : "需复核")}</p>
    <p class="sub">${escapeHtml(categoryText)}</p>
  </div>`;
}

function renderMatrixRow(row) {
  return `<tr>
    <td class="brand-title">${escapeHtml(row.brand)}</td>
    <td>${row.candidates}</td>
    <td>${badge(row.deposit)}</td>
    <td>${badge(row.freebet)}</td>
    <td>${badge(row.cashback)}</td>
    <td>${badge(row.freeSpins)}</td>
    <td>${badge(row.vip)}</td>
    <td>${badge(row.contest)}</td>
    <td>${badge(row.rakeback)}</td>
    <td>${statusBadge(row.status, row.notes)}</td>
  </tr>`;
}

function renderActivityRow(row) {
  const cls = row.confidence === "高" ? "s-ok" : row.confidence === "中" ? "s-mid" : "s-low";
  return `<tr>
    <td class="brand-title">${escapeHtml(row.brand)}</td>
    <td>${escapeHtml(row.title)}</td>
    <td>${escapeHtml(row.category)}</td>
    <td class="compact">${escapeHtml(row.rewards || "-")}</td>
    <td class="compact">${escapeHtml(row.requirements || "-")}</td>
    <td><a href="${escapeHtml(row.sourceUrl)}">打开</a></td>
    <td><span class="status ${cls}">${escapeHtml(row.confidence)}</span></td>
  </tr>`;
}

function renderNeedsReviewRow(row) {
  return `<tr>
    <td class="brand-title">${escapeHtml(row.brand)}</td>
    <td>${escapeHtml(row.reason)}</td>
    <td>${escapeHtml(row.action)}</td>
    <td>${escapeHtml(row.detail)}</td>
  </tr>`;
}

function renderCoverageRow(row) {
  return `<tr>
    <td class="brand-title">${escapeHtml(row.brand)}</td>
    <td>${statusBadge(row.status, row.notes)}</td>
    <td>${row.candidates}</td>
    <td>${row.pages}</td>
    <td>${escapeHtml(row.notes)}</td>
  </tr>`;
}

function badge(value) {
  const cls = value === "有" ? "s-ok" : value === "可能" ? "s-mid" : "s-low";
  return `<span class="status ${cls}">${escapeHtml(value)}</span>`;
}

function statusBadge(status, notes = "") {
  if (status === "ok") return `<span class="status s-ok">成功</span>`;
  if (notes.includes("403") || notes.toLowerCase().includes("blocked")) return `<span class="status s-low">被挡</span>`;
  return `<span class="status s-mid">需复核</span>`;
}

function buildMatrixRows(summaries, promotions) {
  return summaries.map((summary) => {
    const text = promotions
      .filter((promo) => promo.displayName === summary.brand)
      .map((promo) => `${promo.title} ${promo.rawText}`)
      .join(" ")
      .toLowerCase();
    return {
      brand: summary.brand,
      status: summary.status,
      notes: summary.notes,
      candidates: summary.candidates,
      deposit: hasAny(text, ["deposit", "welcome", "reload"]) ? "有" : summary.candidates ? "未明" : "未知",
      freebet: hasAny(text, ["freebet", "free bet"]) ? "有" : summary.candidates ? "未明" : "未知",
      cashback: hasAny(text, ["cashback", "cash back"]) ? "有" : summary.candidates ? "未明" : "未知",
      freeSpins: hasAny(text, ["free spins", "freespins", "spins"]) ? "有" : summary.candidates ? "未明" : "未知",
      vip: hasAny(text, ["vip", "loyalty", "level"]) ? "有" : summary.candidates ? "未明" : "未知",
      contest: hasAny(text, ["race", "raffle", "tournament", "quest", "mission", "leaderboard"]) ? "有" : summary.candidates ? "未明" : "未知",
      rakeback: hasAny(text, ["rakeback", "rake back"]) ? "有" : summary.candidates ? "未明" : "未知"
    };
  });
}

function summarizeActivities(promotions) {
  const seen = new Set();
  return promotions
    .filter((promo) => promo.rawText && promo.rawText.length > 20)
    .sort((a, b) => confidenceScore(b) - confidenceScore(a))
    .map((promo) => {
      const title = cleanTitle(promo.title);
      const key = `${promo.displayName}|${title.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const fields = promo.extractedFields || {};
      const requirements = [
        ...(fields.requirementHints || []),
        ...(fields.validityHints || []),
        ...(fields.rolloverHints || [])
      ].slice(0, 4);
      return {
        brand: promo.displayName,
        title,
        category: inferCategory(`${title} ${promo.rawText}`),
        rewards: (fields.rewardHints || []).slice(0, 5).join("; "),
        requirements: requirements.join("; "),
        sourceUrl: promo.sourceUrl || promo.pageUrl,
        confidence: confidenceLabel(promo)
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

function inferCategories(promos) {
  const text = promos.map((promo) => `${promo.title} ${promo.rawText}`).join(" ").toLowerCase();
  const categories = [];
  if (hasAny(text, ["deposit", "welcome", "reload"])) categories.push("充值/欢迎");
  if (hasAny(text, ["cashback", "cash back", "rakeback"])) categories.push("返现/Rakeback");
  if (hasAny(text, ["free spins", "freespins", "freebet", "free bet"])) categories.push("免费奖励");
  if (hasAny(text, ["vip", "loyalty", "level"])) categories.push("VIP/忠诚度");
  if (hasAny(text, ["race", "raffle", "tournament", "quest", "mission", "leaderboard"])) categories.push("任务/竞赛");
  return categories.slice(0, 4);
}

function inferCategory(text) {
  const lower = text.toLowerCase();
  if (hasAny(lower, ["deposit", "welcome", "reload"])) return "充值/欢迎";
  if (hasAny(lower, ["cashback", "cash back"])) return "Cashback";
  if (hasAny(lower, ["rakeback", "rake back"])) return "Rakeback";
  if (hasAny(lower, ["free spins", "freespins", "spin"])) return "Free Spins";
  if (hasAny(lower, ["freebet", "free bet"])) return "Freebet";
  if (hasAny(lower, ["vip", "loyalty", "level"])) return "VIP/忠诚度";
  if (hasAny(lower, ["race", "raffle", "tournament", "quest", "mission", "leaderboard"])) return "任务/竞赛";
  return "综合活动";
}

function confidenceLabel(promo) {
  if (String(promo.confidence || "").includes("detail")) return "高";
  if ((promo.extractedFields?.rewardHints || []).length || (promo.extractedFields?.requirementHints || []).length) return "中";
  return "低";
}

function confidenceScore(promo) {
  const fields = promo.extractedFields || {};
  return (String(promo.confidence || "").includes("detail") ? 10 : 0)
    + (fields.rewardHints || []).length * 2
    + (fields.requirementHints || []).length
    + (fields.validityHints || []).length;
}

function explainStatuses(statuses, notes) {
  if (statuses.includes("http_403")) return "网站返回 403，公开爬虫/自动化访问被风控拦截。";
  if (statuses.includes("captcha_or_human_check")) return "页面触发人机校验。";
  if (statuses.includes("js_required_or_blocked")) return "页面要求 JS 或被反爬脚本阻断。";
  if (statuses.includes("auth_missing")) return "页面需要登录态，目前没有账号 session。";
  if (statuses.includes("error")) {
    const joined = notes.join(" ").toLowerCase();
    if (joined.includes("err_name_not_resolved")) return "域名无法解析，可能是域名变更、地区访问或 DNS 问题。";
    if (joined.includes("timeout")) return "页面加载超时，可能是地区、反爬或网络问题。";
    if (joined.includes("ssl") || joined.includes("cert")) return "SSL/证书或连接失败。";
    return "页面访问失败，需要换入口或人工打开确认。";
  }
  return "未拿到完整活动数据，需要人工复核。";
}

function nextAction(statuses) {
  if (statuses.includes("http_403")) return "用普通浏览器打开验证；必要时加入备用镜像域名或官方帮助中心。";
  if (statuses.includes("captcha_or_human_check")) return "人工确认一次页面，记录是否为持续风控。";
  if (statuses.includes("auth_missing")) return "等账号可用后保存登录态；当前只能监控公开页。";
  if (statuses.includes("error")) return "补充备用 URL，或用手动浏览器视角复核。";
  return "保留在日报中观察下一轮抓取。";
}

function cleanTitle(title) {
  return String(title || "未命名活动")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function renderRaw(promotions) {
  const byBrand = new Map();
  for (const promo of promotions) {
    if (!byBrand.has(promo.displayName)) byBrand.set(promo.displayName, []);
    byBrand.get(promo.displayName).push(promo);
  }
  return Array.from(byBrand.entries()).map(([brand, items]) => `
    <h3>${escapeHtml(brand)} · ${items.length} 条</h3>
    ${items.slice(0, 12).map((item) => `<pre>${escapeHtml(`${item.title}\n${item.sourceUrl}\n\n${item.rawText.slice(0, 1200)}`)}</pre>`).join("")}
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
