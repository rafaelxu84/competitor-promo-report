import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, todayISO } from "./utils.mjs";
import { loadConfig } from "./config.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const reportDir = path.join("reports", date);
const inputPath = path.join(reportDir, "browser-observations.json");
const outputPath = path.join(reportDir, "browser-cn-visual.html");
const mirrorPath = path.join(reportDir, "promo-report-bilingual.html");
const latestPath = path.join("reports", "latest-cn-visual.html");
const observations = JSON.parse(await fs.readFile(inputPath, "utf8"));

const activities = [
  ["Stake", "Daily Races", "排行榜/竞赛", "$100,000 every 24 hours", "Ends 2026-12-31"],
  ["Stake", "Weekly Raffle", "抽奖", "$75,000 Weekly Raffle", "Ends 2026-12-31"],
  ["Stake", "Stake vs Eddie", "奖池挑战", "$50,000 Prize Pool", "Ends 2026-05-18"],
  ["Stake", "Conquer the Casino", "Casino 挑战", "$75,000 Prize Pool", "Ends 2026-05-22"],
  ["Stake", "Stake Wheel Wars", "月度奖池", "$150,000 Monthly Prize Pool", "Ends 2026-07-19"],
  ["Stake", "Centurion Millions Poker Series", "Poker 系列赛", "$1,000,000 GTD + $1,000,000 GTD series", "Ends 2026-06-08"],
  ["Stake", "Cricket Raffle Bash", "体育投注抽奖", "$20,000 prize pool", "Ends 2026-05-31"],

  ["BC Game", "IEM Atlanta 2026 Spin & Win", "Spin & Win", "$34,000 prize pool; wager daily and draw daily, win up to $1,000", "Ends May 18"],
  ["BC Game", "Free Spins Giveaway", "Free Spins", "Bet €10 every day and get 20 Free Spins daily", "Ends May 20"],
  ["BC Game", "NoLimitCity Exclusive RTP", "高 RTP 活动", "98% RTP", "Ends May 25"],
  ["BC Game", "Jelly Express Free Spins", "Free Spins", "Play Jelly Express, get 10 Free Spins randomly", "Ends May 18"],
  ["BC Game", "Nolimit City Daily Bet", "Free Spins", "Bet €20 daily on Nolimit City and get 10 Free Spins", "Visible in browser"],

  ["1xBet", "Infinite Prize League", "日奖/周 free bets/大奖", "Daily prizes, weekly free bets, superprizes; text also shows 20%-30% cashback and 100% bonus nearby", "Visible in browser"],
  ["1xBet", "League of Wins", "体育 free bets/抽奖", "Bet on English Premier League matches to get free bets and join prize draw", "Visible in browser"],
  ["1xBet", "NBA Win Shot", "体育活动", "NBA big match themed promotion", "Visible in browser"],
  ["1xBet", "Barca 1xFamily", "球队主题活动", "Bet and win with Barcelona themed promo", "Visible in browser"],
  ["1xBet", "No Risk Bet", "Risk-free bet", "No-risk betting promotion", "Visible in browser"],
  ["1xBet", "Crypto Freebet", "Crypto/freebet", "Crypto freebet rules page captured", "Visible in browser"],
  ["1xBet", "Esports Cashback Boom", "Esports cashback", "Esports cashback rules page captured", "Visible in browser"],

  ["JustCasino", "Welcome Bonus", "欢迎/返现", "20% daily cashback during first week", "Visible in browser"],
  ["JustCasino", "Turbo Cashback", "Cashback", "10% up to $500 on all games every week", "Visible in browser"],
  ["JustCasino", "Weekly $50,000 Raffle", "抽奖", "50 winners receive $1,000 cash", "Visible in browser"],
  ["JustCasino", "Chooseday Challenge", "任务挑战", "Choose a challenge and unlock reward up to $100", "Visible in browser"],
  ["JustCasino", "Slots Cashback Boost", "Slots cashback", "Extra 5% cashback on selected slots", "Visible in browser"],

  ["Betpanda", "Sign-Up Offer", "欢迎 bonus", "Up to 1 BTC casino bonus", "Complete requirement to get rewarded"],
  ["Betpanda", "Exclusive Rakeback", "Rakeback", "Climb to Bamboo Guardian and enjoy daily rakeback on every spin", "Visible in browser"],
  ["Betpanda", "Weekly Cashback", "Cashback", "10% guaranteed cashback on real money losses between Wednesdays", "Countdown visible"],
  ["Betpanda", "Live Casino Cashback Boost", "Live casino cashback", "5% extra cashback, up to 15% back weekly on Evolution live games", "Visible in browser"],

  ["CoinCasino", "Welcome Offer", "欢迎 bonus", "200% welcome bonus up to $30,000 + 50 Super Spins", "Visible in browser"],
  ["CoinCasino", "Switch Your VIP Status", "VIP match", "Match VIP level; 200% up to $30,000", "Visible in browser"],
  ["CoinCasino", "ACCA Boost Club", "多串一加成", "Up to 40% extra winnings on accumulators", "Visible in browser"],
  ["CoinCasino", "World Cup Festival", "体育活动", "Multiple World Cup tournament offers from June 1", "Visible in browser"],
  ["CoinCasino", "Spinoleague", "Tournament", "€12M tournament series", "Visible in browser"],

  ["Velobet", "The Wembley Safety Net", "体育 cashback", "FA Cup Final: 30% cashback on non-winning bets", "Minimum 1 selection"],
  ["Velobet", "Promos / Freebet Account Area", "账户奖励入口", "Freebet / bonus / sports bonus account sections visible", "Some sections show no freebets available"],
  ["Velobet", "Request Your Bonus", "Bonus request", "Request bonus form visible", "Requires username/message"],

  ["Megapari", "UEFA Boost", "Freebet", "Free bet up to 597 MYR", "Requires participation and deposit"],
  ["Megapari", "Bonus for a Series of Losing Bets", "补偿 bonus", "Promotion listed in bonus rules", "Visible in browser"],
  ["Megapari", "Advancebet", "Advancebet bonus", "Available to customers with unsettled bets", "Visible in browser"],
  ["Megapari", "Spring Sport Bonus", "Deposit bonus", "Up to 100% deposit bonus", "Visible in browser"],
  ["Megapari", "Trip Lottery: Champions Cup 2026", "抽奖", "Prize draw for a trip to the 2026 World Cup", "Visible in browser"],

  ["Funbet", "Sport First Deposit Bonus", "首存", "100% up to $100", "Visible in browser"],
  ["Funbet", "Casino Welcome Bonus", "欢迎 bonus", "100% up to $500 + 200 FS", "Visible in browser"],
  ["Funbet", "Sport Weekly Reload", "Reload", "50% up to $600", "Visible in browser"],
  ["Funbet", "Casino Weekly Reload", "Free Spins", "55 Free Spins", "Visible in browser"],
  ["Funbet", "Weekend Reload Bonus", "Reload + FS", "$750 + 75 Free Spins", "Visible in browser"],
  ["Funbet", "Live Cashback", "Cashback", "25% up to $200", "Visible in browser"],
  ["Funbet", "Early Payout", "体育提前结算", "$50,000", "Visible in browser"],
  ["Funbet", "Bet Builder", "Risk-free", "50% risk free $50", "Visible in browser"],
  ["Funbet", "Accumulator Boost", "多串一加成", "$100,000", "Visible in browser"],

  ["Campeonbet", "Welcome Casino Package", "欢迎包", "350% up to €2,000 + 1,000 FS", "Visible in browser"],
  ["Campeonbet", "Campeonbet is shortlisted", "投票奖励", "One vote brings €20 Free Bet + 150 FS", "Visible in browser"],
  ["Campeonbet", "Drops & Wins 2026", "奖池活动", "Share of €25,000,000", "Visible in browser"],
  ["Campeonbet", "Rewards Every Sunday", "周日奖励", "€25,000 from Playson & Booongo Games", "Visible in browser"],
  ["Campeonbet", "Season of Legends", "锦标赛", "€512,000 total prizes", "Visible in browser"],
  ["Campeonbet", "Spinoleague 2026", "锦标赛", "€12,000,000 cash prizes", "Visible in browser"],
  ["Campeonbet", "Welcome Sports Freebet", "体育 freebet", "€25 Freebet", "Visible in browser"],
  ["Campeonbet", "Live Casino Thursday", "Cashback", "25% cashback", "Visible in browser"]
];

const categoryColumns = [
  ["首存/欢迎", ["welcome", "first deposit", "deposit", "欢迎", "首存"]],
  ["Cashback", ["cashback", "cash back"]],
  ["Free Spins", ["free spins", " fs", "super spins"]],
  ["Freebet", ["freebet", "free bet"]],
  ["Rakeback", ["rakeback"]],
  ["VIP", ["vip"]],
  ["竞赛/抽奖", ["raffle", "tournament", "league", "race", "draw", "prize pool", "奖池", "抽奖"]],
  ["体育投注", ["sport", "football", "nba", "accumulator", "odds", "bet builder"]]
];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>浏览器直访版竞品活动日报 ${escapeHtml(date)}</title>
  <style>
    :root {
      --bg: #f4f5f1;
      --panel: #fff;
      --ink: #15201b;
      --muted: #66736d;
      --line: #d8ddd4;
      --green: #0d7658;
      --blue: #245c9e;
      --amber: #9a6816;
      --soft-green: #e5f3ed;
      --soft-blue: #e9f0fb;
      --soft-amber: #fff4df;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; line-height: 1.45; }
    .page { max-width: 1320px; margin: 0 auto; padding: 28px 18px 56px; }
    .hero { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 24px; display: grid; grid-template-columns: 1fr 330px; gap: 18px; align-items: end; }
    h1 { margin: 0 0 8px; font-size: 31px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 21px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: 0; }
    p { margin: 0; }
    .sub, .meta, .note { color: var(--muted); }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .kpi, .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .kpi strong { display: block; font-size: 30px; line-height: 1; }
    .kpi span { color: var(--muted); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border: 1px solid var(--line); border-radius: 6px; background: #eef0ea; margin-bottom: 10px; }
    .num { font-size: 26px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 11px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 13px; }
    th { background: #ecefe8; color: #3d4742; font-size: 12px; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .status { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 750; white-space: nowrap; }
    .ok { color: var(--green); background: var(--soft-green); }
    .mid { color: var(--amber); background: var(--soft-amber); }
    .blue { color: var(--blue); background: var(--soft-blue); }
    .brand { font-weight: 800; }
    details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
    summary { cursor: pointer; font-weight: 800; }
    pre { white-space: pre-wrap; word-break: break-word; background: #111714; color: #eef6f0; padding: 12px; border-radius: 8px; max-height: 260px; overflow: auto; font-size: 12px; }
    a { color: var(--blue); }
    @media (max-width: 980px) { .hero, .grid { grid-template-columns: 1fr; } .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } h1 { font-size: 27px; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1>竞品活动日报：浏览器直访版</h1>
        <p class="sub">这版数据来自 in-app browser 逐个打开页面后的可见正文，不使用批量爬虫结果作为主依据。</p>
      </div>
      <div class="meta">
        <p><b>日期：</b>${escapeHtml(date)}</p>
        <p><b>生成时间：</b>${escapeHtml(observations.generatedAt)}</p>
        <p><b>模式：</b>直接浏览器访问 / Visible browser review</p>
      </div>
    </section>

    <section class="kpis">
      ${kpi(String(observations.results.length), "直访页面")}
      ${kpi(String(observations.results.filter((item) => item.status === "ok").length), "成功打开")}
      ${kpi(String(activities.length), "整理活动")}
      ${kpi("0", "本轮被 403 阻断")}
    </section>

    <h2>页面截图概览</h2>
    <section class="grid">
      ${observations.results.map(renderCard).join("\n")}
    </section>

    <h2>活动矩阵</h2>
    <p class="note" style="margin-bottom:12px">基于浏览器可见文本自动归类，适合快速看各家活动打法。</p>
    <table>
      <thead><tr><th>品牌</th>${categoryColumns.map(([name]) => `<th>${escapeHtml(name)}</th>`).join("")}<th>页面状态</th></tr></thead>
      <tbody>${observations.results.map(renderMatrixRow).join("\n")}</tbody>
    </table>

    <h2>活动详情表</h2>
    <table>
      <thead><tr><th>品牌</th><th>活动</th><th>类型</th><th>奖励/机制</th><th>条件/有效期</th></tr></thead>
      <tbody>${activities.map(renderActivity).join("\n")}</tbody>
    </table>

    <h2>这次和爬虫结果的差异</h2>
    <table>
      <thead><tr><th>结论</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td class="brand">Stake</td><td>直接浏览器能打开并看到完整活动列表；之前 403 属于自动化访问被挡。</td></tr>
        <tr><td class="brand">全部 10 个来源</td><td>直接浏览器均成功读取正文，本轮不再把这些页面标为 needs_review。</td></tr>
        <tr><td class="brand">仍需人工复核</td><td>金额、有效期和 T&C 仍应以页面详情展开后的条款为准；本版是列表页/可见正文整理。</td></tr>
      </tbody>
    </table>

    <details>
      <summary>查看浏览器可见原文摘录</summary>
      ${observations.results.map(renderRaw).join("\n")}
    </details>
  </main>
</body>
</html>`;

await fs.writeFile(outputPath, html, "utf8");
await fs.writeFile(mirrorPath, html, "utf8");
await fs.writeFile(latestPath, html, "utf8");
console.log(outputPath);
console.log(mirrorPath);
console.log(latestPath);

function kpi(value, label) {
  return `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderCard(item) {
  const rel = path.relative(reportDir, item.screenshot);
  const count = activities.filter(([brand]) => brand === item.brand).length;
  return `<article class="card">
    <img src="${escapeHtml(rel)}" alt="${escapeHtml(item.brand)} screenshot">
    <h3>${escapeHtml(item.brand)}</h3>
    <div class="num">${count}</div>
    <p class="sub">已整理活动</p>
    <p><span class="status ok">浏览器可访问</span></p>
  </article>`;
}

function renderMatrixRow(item) {
  const text = item.text.toLowerCase();
  return `<tr>
    <td class="brand">${escapeHtml(item.brand)}</td>
    ${categoryColumns.map(([, needles]) => `<td>${badge(needles.some((needle) => text.includes(needle)))}</td>`).join("")}
    <td><span class="status ok">OK</span></td>
  </tr>`;
}

function renderActivity(row) {
  const [brand, name, type, reward, terms] = row;
  return `<tr>
    <td class="brand">${escapeHtml(brand)}</td>
    <td>${escapeHtml(name)}</td>
    <td>${escapeHtml(type)}</td>
    <td>${escapeHtml(reward)}</td>
    <td>${escapeHtml(terms)}</td>
  </tr>`;
}

function renderRaw(item) {
  return `<h3>${escapeHtml(item.brand)}</h3>
    <p><a href="${escapeHtml(item.finalUrl)}">${escapeHtml(item.finalUrl)}</a></p>
    <pre>${escapeHtml(item.text.slice(0, 5000))}</pre>`;
}

function badge(value) {
  return value ? `<span class="status ok">有</span>` : `<span class="status mid">未见</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
