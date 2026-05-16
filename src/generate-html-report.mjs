import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, todayISO } from "./utils.mjs";
import { loadConfig } from "./config.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const reportDir = path.join("reports", date);
const inputPath = path.join(reportDir, "promotions.json");
const outputPath = path.join(reportDir, "promo-report-bilingual.html");
const run = JSON.parse(await fs.readFile(inputPath, "utf8"));

const successfulBrands = new Set(run.promotions.map((item) => item.displayName));
const competitorRows = run.competitors.map((competitor) => {
  const candidates = run.promotions.filter((item) => item.displayName === competitor.displayName).length;
  return {
    brand: competitor.displayName,
    status: competitor.status,
    candidates,
    pages: competitor.pages.length,
    notes: competitor.notes.join("; ") || "-"
  };
});

const activities = [
  {
    brand: "bet365",
    quality: "high",
    cnSummary: "公开活动页和详情页可访问，规则文本最完整，适合做日常基准竞品。",
    enSummary: "Public promotion and detail pages are accessible, with the richest rule text among the crawled brands.",
    items: [
      {
        name: "Loyalty Club / Recompensas de Fidelidade",
        type: "Loyalty, sports credits, casino free spins",
        cn: "体育每周投注阶梯奖励：R$100-R$299.99 得 R$5；R$300-R$749.99 得 R$15；R$750-R$1,499.99 得 R$50；R$1,500+ 得 R$100。要求合格体育投注 odds >= 2.00。2026-05-04 至 2026-05-31 分周计算。奖励在每周周期结束后 24 小时内发放，需 7 天内激活。赌场侧最高 300 次免费旋转，免费旋转面值 R$0.50，无流水要求。",
        en: "Weekly sports betting tiers: R$100-R$299.99 earns R$5; R$300-R$749.99 earns R$15; R$750-R$1,499.99 earns R$50; R$1,500+ earns R$100. Eligible sports bets need odds >= 2.00. Runs in weekly windows from 2026-05-04 to 2026-05-31. Credits are issued within 24 hours after the weekly window and must be activated within 7 days. Casino rewards can reach up to 300 free spins at R$0.50 each, with no wagering requirement.",
        limits: "Eligible previous activity required; bet credits are not withdrawable; free spins expire if not accepted/used in time."
      },
      {
        name: "2 Goals Ahead Early Payout",
        type: "Sports early payout",
        cn: "足球赛前全场胜平负/指定市场中，若所选球队任意时刻领先 2 球，投注可提前结算为赢。",
        en: "For selected football markets, if the backed team goes 2 goals ahead at any point, the bet can be settled early as a winner.",
        limits: "Restrictions and T&Cs apply; exact eligibility depends on event and market."
      },
      {
        name: "Substitution+",
        type: "Player prop protection",
        cn: "若下注球员被替换下场，替补球员接管相关投注。",
        en: "If the selected player is substituted, the replacement player takes over the relevant bet.",
        limits: "Available only for selected markets and events."
      },
      {
        name: "Accumulator Boost 100%",
        type: "Accumulator boost",
        cn: "多串一收益提升活动，页面宣称可最高增加 100%/翻倍收益。",
        en: "Accumulator winnings boost, advertised as up to 100% additional winnings.",
        limits: "Minimum odds, stake restrictions, and T&Cs apply."
      },
      {
        name: "NBA / Basketball Early Payout",
        type: "Basketball early payout",
        cn: "NBA 和篮球提前结算活动，适用于指定篮球赛事和市场。",
        en: "Early payout mechanics for NBA and basketball events, subject to selected markets.",
        limits: "Restrictions and T&Cs apply."
      },
      {
        name: "Super Boost / Daily Odds Boost / Winnings Boost",
        type: "Odds boost",
        cn: "覆盖精选赛事、每日 odds boost，以及 Criar Aposta/单注收益提升。Criar Aposta 场景要求 3+ selections 且组合 odds >= 2.00。",
        en: "Covers selected event super boosts, daily odds boosts, and winnings boost for Bet Builder/singles. Bet Builder usage requires 3+ selections and combined odds >= 2.00.",
        limits: "Cash bets only for Super Boost; maximum stake and availability restrictions apply."
      },
      {
        name: "Tennis Retirement Guarantee",
        type: "Tennis injury guarantee",
        cn: "若对手因伤退赛，所选球员可按胜出处理；适用于指定 ATP/WTA/大满贯单打主赛签，单注和多注均可能适用。",
        en: "If the opponent retires due to injury, the selected player can be paid as a winner; applies to selected ATP/WTA/Grand Slam main-draw singles, with single and multiple bet handling.",
        limits: "Bet Builder is excluded; qualifying and cash-out restrictions apply; winnings may be paid as bet credits."
      }
    ]
  },
  {
    brand: "BC.Game",
    quality: "medium",
    cnSummary: "公开页面可访问且活动类型多，但 bonus 口径存在冲突，需要人工复核金额和适用性。",
    enSummary: "Public pages are accessible and promo types are broad, but bonus figures are inconsistent and need manual verification.",
    items: [
      {
        name: "Deposit / Welcome Bonus",
        type: "Deposit bonus",
        cn: "抓取到多档充值奖励：首存 180%、二存 240%、三存 300%、四存 360%。巴西介绍页同时出现 welcome 300% 和最高 R$16,500 的描述，口径需复核。",
        en: "Captured tiered deposit rewards: 180% first deposit, 240% second deposit, 300% third deposit, and 360% fourth deposit. The Brazil guide also mentions a 300% welcome bonus and up to R$16,500, so the exact offer needs reconciliation.",
        limits: "Wagering requirements and claim conditions were not fully captured in the public crawl."
      },
      {
        name: "Level Up Bonus",
        type: "Loyalty progression",
        cn: "随等级提升解锁额外奖励，强调 higher level / exclusive bonus。",
        en: "Level-based reward system that unlocks additional bonuses as players progress.",
        limits: "Detailed reward table not fully captured."
      },
      {
        name: "Quest Hub Rewards",
        type: "Daily and weekly missions",
        cn: "通过日常/每周任务获取奖励，偏向留存和活跃度任务体系。",
        en: "Daily and weekly quest system used to drive retention and activity.",
        limits: "Quest list varies by cycle and requires fresh crawl/review."
      },
      {
        name: "Lucky Spin",
        type: "Daily wheel",
        cn: "每日转盘，奖励包括 bonus cash、Player Points 和 crypto 奖励。",
        en: "Daily wheel with bonus cash, Player Points, and crypto rewards.",
        limits: "Exact odds and prize table were not visible in the public page."
      },
      {
        name: "Recharge Cashback",
        type: "Cashback",
        cn: "页面列表确认有 Recharge Cashback；详情页本轮触发人机校验，需复核比例和条件。",
        en: "Recharge Cashback is listed, but the detail page triggered a human-check during this crawl, so rate and rules need review.",
        limits: "Detail page status: captcha_or_human_check."
      },
      {
        name: "Weekly / Monthly Bonus, VIP, Coin Drop, Rain Bonus",
        type: "Recurring and VIP rewards",
        cn: "覆盖每周/每月奖励、VIP 权益、聊天 coin drop、rain bonus 等活跃奖励。",
        en: "Includes weekly/monthly bonuses, VIP rewards, chat-based coin drops, and rain bonuses.",
        limits: "Likely personalized by account activity and VIP tier."
      }
    ]
  },
  {
    brand: "KTO",
    quality: "high",
    cnSummary: "帮助中心页面清晰，适合稳定监控；部分活动文章日期较早，需要每天判断是否仍有效。",
    enSummary: "Help-center pages are clean and stable for monitoring; some article dates are old, so current validity needs daily review.",
    items: [
      {
        name: "Freebet",
        type: "Sports freebet",
        cn: "免费体育投注，不使用账户余额。中奖时仅按净赢利结算，不返还 freebet 本金。例如 R$50 freebet、odds 1.5，中奖获得 R$75 中扣除本金后的净额。",
        en: "A sports freebet that does not use account balance. If it wins, only net winnings are paid and the freebet stake is not returned. Example: a R$50 freebet at odds 1.5 pays the net amount after subtracting the stake.",
        limits: "Specific freebet limitations depend on the promotion that issued it."
      },
      {
        name: "Cashback Bonus",
        type: "Cashback",
        cn: "Cashback 直接加到 KTO 钱包；用户通过页面顶部 Cashback，再点击 Cashout 领取。",
        en: "Cashback is credited directly to the KTO wallet and can be claimed through Cashback > Cashout.",
        limits: "Cashback percentage and eligibility are not shown in the generic help article."
      },
      {
        name: "Ganho Antecipado",
        type: "Sports early payout",
        cn: "足球赛前 1x2 市场中，若投注球队领先 2 球，即使比赛未结束，盈利也会直接入账。适用于指定联赛，活动标记为 Ganho Antecipado 或 GA。单注、多注、系统投注和 Criar Aposta 均可覆盖。",
        en: "For pre-match 1x2 football bets, if the selected team opens a 2-goal lead, profit is credited before the match ends. Applies to selected leagues marked Ganho Antecipado or GA, covering singles, multiples, system bets, and Bet Builder.",
        limits: "Draw selections excluded; eligible competitions must be checked on the promo page."
      },
      {
        name: "Indique um Amigo",
        type: "Referral",
        cn: "推荐成功后，推荐人获得 R$20 Aposta Grátis + 20 次 Sweet Bonanza 免费旋转，单次 R$0.40。被推荐人需 7 天内下注至少 R$20；体育 odds >= 1.50；赌场限 slots 或 crash，真人赌场不合格。每月最多 10 个成功推荐，奖励 7 天有效。",
        en: "Successful referral gives the referrer R$20 in freebet plus 20 Sweet Bonanza free spins at R$0.40 each. The referred user must wager at least R$20 within 7 days; sports odds must be >= 1.50; casino qualification is slots or crash only, live casino excluded. Up to 10 successful referrals per month; rewards valid for 7 days.",
        limits: "Shared IP/device/address or non-official referral links are not eligible."
      },
      {
        name: "Weekly Missions with 200 Free Spins",
        type: "Missions and free spins",
        cn: "文章显示 2025-04-01 至 2025-05-04，包含每周任务、10 个任务选项、达成指定 multiplier 后即时领奖。Top prizes 包括 Tigre Sortudo 50 次、Gates of Olympus 25 次、Mines 三个 R$5 freebets。本轮按历史/待复核活动处理。",
        en: "Article shows 2025-04-01 to 2025-05-04, with weekly missions, 10 mission options, multiplier goals, and instant rewards. Top prizes include 50 spins on Tigre Sortudo, 25 spins on Gates of Olympus, and three R$5 Mines freebets. Treat as historical or needs-current-validity review.",
        limits: "Appears expired based on article dates; needs live promo-page confirmation."
      }
    ]
  }
];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Competitor Promotion Report ${escapeHtml(run.date)}</title>
  <style>
    :root {
      --bg: #f7f7f2;
      --ink: #17201b;
      --muted: #60706a;
      --line: #d9ddd3;
      --panel: #ffffff;
      --green: #0f7a5f;
      --blue: #245c9e;
      --red: #a53f3f;
      --amber: #9b6916;
      --soft-green: #e8f4ef;
      --soft-blue: #eaf1fb;
      --soft-red: #faeeee;
      --soft-amber: #fff4df;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }
    .page { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr);
      gap: 24px;
      align-items: end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 24px;
    }
    h1 { margin: 0 0 10px; font-size: 34px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 34px 0 14px; font-size: 22px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 17px; letter-spacing: 0; }
    p { margin: 0; }
    .subtitle { color: var(--muted); max-width: 760px; }
    .meta {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      display: grid;
      gap: 8px;
      font-size: 14px;
    }
    .meta b { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .stat {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .stat strong { display: block; font-size: 28px; line-height: 1; }
    .stat span { color: var(--muted); font-size: 13px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
    }
    .takeaways { display: grid; gap: 10px; }
    .takeaway {
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--soft-blue);
      border: 1px solid #cbdcf2;
    }
    .takeaway.cn { background: var(--soft-green); border-color: #c7e2d6; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 14px; }
    th { background: #eef0e9; color: #39443f; font-size: 12px; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    .status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .ok { background: var(--soft-green); color: var(--green); }
    .review { background: var(--soft-amber); color: var(--amber); }
    .blocked { background: var(--soft-red); color: var(--red); }
    .brand {
      display: grid;
      gap: 14px;
      margin-bottom: 22px;
    }
    .brand-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .brand-kicker { color: var(--muted); font-size: 13px; }
    .activity {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    .activity-top { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
    .tag { color: var(--blue); background: var(--soft-blue); border-radius: 999px; padding: 4px 8px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
    .lang {
      background: #fbfbf8;
      border: 1px solid #e6e8e0;
      border-radius: 8px;
      padding: 12px;
      min-height: 100%;
    }
    .lang b { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; text-transform: uppercase; }
    .limits { margin-top: 10px; color: var(--muted); font-size: 13px; }
    details {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    summary { cursor: pointer; font-weight: 700; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #101714;
      color: #edf5ef;
      border-radius: 8px;
      padding: 12px;
      max-height: 280px;
      overflow: auto;
      font-size: 12px;
    }
    a { color: var(--blue); }
    .footer { margin-top: 30px; color: var(--muted); font-size: 13px; }
    @media (max-width: 860px) {
      .hero, .grid-2, .cols { grid-template-columns: 1fr; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1>竞品活动情报日报<br>Competitor Promotion Intelligence Report</h1>
        <p class="subtitle">巴西市场无账号公开视角。This report is based on public, non-logged-in browser crawling for Brazil-market competitor promotion pages.</p>
      </div>
      <div class="meta">
        <div><b>Date / 日期</b>${escapeHtml(run.date)}</div>
        <div><b>Generated / 生成时间</b>${escapeHtml(run.generatedAt)}</div>
        <div><b>Mode / 模式</b>Playwright public browser crawl, no account login</div>
      </div>
    </section>

    <section class="stats">
      ${stat("12", "Brands monitored / 监控品牌")}
      ${stat(String(successfulBrands.size), "Accessible brands / 成功抓取")}
      ${stat(String(run.promotions.length), "Promotion candidates / 活动候选")}
      ${stat("9", "Needs review / 需复核品牌")}
    </section>

    <h2>Executive Summary / 执行摘要</h2>
    <section class="grid-2">
      <div class="panel takeaways">
        <h3>中文结论</h3>
        <div class="takeaway cn">bet365 是本轮公开抓取质量最高的竞品，活动详情和 T&C 最完整，可作为日报基准。</div>
        <div class="takeaway cn">BC.Game 活动力度最大，覆盖充值、任务、VIP、每周/月奖励，但 bonus 金额口径存在冲突，需要人工复核。</div>
        <div class="takeaway cn">KTO 帮助中心结构清楚，Freebet、Cashback、提前结算和推荐活动规则可稳定监控。</div>
        <div class="takeaway cn">Betano、Superbet、7Games 仍被 403 或风控拦截；Stake/AFUN/部分本地品牌需要登录或可访问域名修正。</div>
      </div>
      <div class="panel takeaways">
        <h3>English Takeaways</h3>
        <div class="takeaway">bet365 has the cleanest public crawl result, with detailed promo mechanics and T&Cs. It is the best benchmark for daily reporting.</div>
        <div class="takeaway">BC.Game shows the broadest reward mix, including deposit, mission, VIP, weekly, and monthly rewards, but bonus figures need reconciliation.</div>
        <div class="takeaway">KTO's help center is stable and clear for Freebet, Cashback, Early Payout, and Referral monitoring.</div>
        <div class="takeaway">Betano, Superbet, and 7Games are still blocked by 403/risk controls; Stake, AFUN, and some local brands need login or domain follow-up.</div>
      </div>
    </section>

    <h2>Coverage / 抓取覆盖</h2>
    <table>
      <thead><tr><th>Brand</th><th>Status</th><th>Candidates</th><th>Pages</th><th>Notes</th></tr></thead>
      <tbody>
        ${competitorRows.map(renderCompetitorRow).join("\n")}
      </tbody>
    </table>

    <h2>Promotion Details / 活动详情</h2>
    ${activities.map(renderBrand).join("\n")}

    <h2>Raw Evidence / 原始抓取证据</h2>
    <p class="subtitle" style="margin-bottom: 14px;">以下为每个成功品牌的原始候选摘要，便于追溯来源。The raw candidates below are included for traceability.</p>
    ${renderRawEvidence(run.promotions)}

    <p class="footer">Generated from ${escapeHtml(inputPath)}. Screenshots and HTML snapshots are stored under screenshots/${escapeHtml(run.date)} and snapshots/${escapeHtml(run.date)}.</p>
  </main>
</body>
</html>`;

await fs.writeFile(outputPath, html, "utf8");
console.log(outputPath);

function stat(value, label) {
  return `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderCompetitorRow(row) {
  const className = row.status === "ok" ? "ok" : row.notes.includes("403") || row.notes.includes("blocked") ? "blocked" : "review";
  const label = row.status === "ok" ? "OK / 成功" : className === "blocked" ? "Blocked / 被挡" : "Review / 需复核";
  return `<tr>
    <td>${escapeHtml(row.brand)}</td>
    <td><span class="status ${className}">${label}</span></td>
    <td>${row.candidates}</td>
    <td>${row.pages}</td>
    <td>${escapeHtml(row.notes)}</td>
  </tr>`;
}

function renderBrand(brand) {
  const candidateCount = run.promotions.filter((item) => item.displayName === brand.brand).length;
  const quality = brand.quality === "high" ? "ok" : "review";
  const qualityLabel = brand.quality === "high" ? "High confidence / 高可信" : "Needs verification / 需复核";
  return `<section class="brand">
    <div class="brand-head">
      <div>
        <h3>${escapeHtml(brand.brand)}</h3>
        <p class="brand-kicker">${escapeHtml(brand.cnSummary)}<br>${escapeHtml(brand.enSummary)}</p>
      </div>
      <span class="status ${quality}">${qualityLabel} · ${candidateCount} candidates</span>
    </div>
    ${brand.items.map(renderActivity).join("\n")}
  </section>`;
}

function renderActivity(item) {
  return `<article class="activity">
    <div class="activity-top">
      <h3>${escapeHtml(item.name)}</h3>
      <span class="tag">${escapeHtml(item.type)}</span>
    </div>
    <div class="cols">
      <div class="lang"><b>中文</b>${escapeHtml(item.cn)}</div>
      <div class="lang"><b>English</b>${escapeHtml(item.en)}</div>
    </div>
    <p class="limits"><b>Limits / 限制:</b> ${escapeHtml(item.limits)}</p>
  </article>`;
}

function renderRawEvidence(promotions) {
  const grouped = new Map();
  for (const promo of promotions) {
    if (!grouped.has(promo.displayName)) grouped.set(promo.displayName, []);
    grouped.get(promo.displayName).push(promo);
  }
  return Array.from(grouped.entries())
    .map(([brand, items]) => `<details>
      <summary>${escapeHtml(brand)} · ${items.length} raw candidates</summary>
      ${items.slice(0, 18).map((item) => `<h3>${escapeHtml(item.title.slice(0, 180))}</h3>
        <p><a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(item.sourceUrl)}</a></p>
        <pre>${escapeHtml(item.rawText.slice(0, 1800))}</pre>`).join("\n")}
    </details>`)
    .join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

