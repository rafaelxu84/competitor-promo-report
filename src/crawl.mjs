import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { loadConfig } from "./config.mjs";
import {
  authPathFor,
  detectFields,
  ensureDir,
  fileExists,
  normalizeText,
  parseArgs,
  scoreTextForPromotion,
  slugify,
  todayISO,
  truncate,
  writeJson
} from "./utils.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const brandsFilter = args.brand ? new Set(String(args.brand).split(",").map((item) => item.trim())) : null;
const headed = Boolean(args.headed);
const maxDetailPagesPerBrand = Number(args.maxDetails || 20);

const reportDir = path.join("reports", date);
const snapshotDir = path.join("snapshots", date);
const screenshotDir = path.join("screenshots", date);
await Promise.all([ensureDir(reportDir), ensureDir(snapshotDir), ensureDir(screenshotDir)]);

const competitors = brandsFilter
  ? config.competitors.filter((competitor) => brandsFilter.has(competitor.brand))
  : config.competitors;

const browser = await chromium.launch({ headless: !headed });
const run = {
  generatedAt: new Date().toISOString(),
  date,
  competitors: [],
  promotions: []
};

for (const competitor of competitors) {
  console.log(`\n== ${competitor.displayName} ==`);
  const authFile = authPathFor(competitor.brand);
  const hasAuth = await fileExists(authFile);
  const brandResult = {
    brand: competitor.brand,
    displayName: competitor.displayName,
    market: competitor.market,
    status: "ok",
    pages: [],
    notes: []
  };

  const contextOptions = {
    locale: config.defaults.locale,
    timezoneId: config.defaults.timezone,
    viewport: config.defaults.viewport,
    userAgent: config.defaults.userAgent,
    extraHTTPHeaders: {
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    colorScheme: "light"
  };

  if (hasAuth) contextOptions.storageState = authFile;

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const detailQueue = [];

  for (const pageConfig of competitor.pages) {
    if (pageConfig.requiresAuth && !hasAuth) {
      const pageResult = {
        name: pageConfig.name,
        url: pageConfig.url,
        status: "auth_missing",
        promotionsFound: 0,
        screenshot: null,
        snapshot: null,
        error: `Run npm run login -- --brand=${competitor.brand}`
      };
      brandResult.pages.push(pageResult);
      brandResult.status = brandResult.status === "ok" ? "needs_review" : brandResult.status;
      brandResult.notes.push(`${pageConfig.name}: missing saved login session`);
      console.log(`skip auth page: ${pageConfig.name}`);
      continue;
    }

    const pageResult = await crawlPage({
      page,
      competitor,
      pageConfig,
      defaults: config.defaults,
      snapshotDir,
      screenshotDir,
      date
    });
    brandResult.pages.push(pageResult.pageResult);
    run.promotions.push(...pageResult.promotions);
    detailQueue.push(...pageResult.detailLinks);
    if (pageResult.pageResult.status !== "ok") {
      brandResult.status = "needs_review";
      brandResult.notes.push(`${pageConfig.name}: ${pageResult.pageResult.status}`);
    }
    console.log(`${pageConfig.name}: ${pageResult.pageResult.status}, ${pageResult.promotions.length} candidates`);
  }

  const uniqueDetailLinks = dedupeLinks(detailQueue).slice(0, maxDetailPagesPerBrand);
  for (const link of uniqueDetailLinks) {
    const pageResult = await crawlPage({
      page,
      competitor,
      pageConfig: {
        name: `Detail: ${link.label || link.url}`,
        url: link.url,
        requiresAuth: link.requiresAuth
      },
      defaults: config.defaults,
      snapshotDir,
      screenshotDir,
      date,
      isDetail: true
    });
    brandResult.pages.push(pageResult.pageResult);
    run.promotions.push(...pageResult.promotions);
    console.log(`detail: ${pageResult.pageResult.status}, ${link.url}`);
  }

  await context.close();
  run.competitors.push(brandResult);
}

await browser.close();

run.promotions = dedupePromotions(run.promotions);
await writeJson(path.join(reportDir, "promotions.json"), run);
await fs.writeFile(path.join(reportDir, "promo-report.md"), renderMarkdown(run), "utf8");

console.log(`\nWrote ${path.join(reportDir, "promo-report.md")}`);
console.log(`Wrote ${path.join(reportDir, "promotions.json")}`);

async function crawlPage({
  page,
  competitor,
  pageConfig,
  defaults,
  snapshotDir,
  screenshotDir,
  date,
  isDetail = false
}) {
  const slug = slugify(`${competitor.brand}-${pageConfig.name}`);
  const pageResult = {
    name: pageConfig.name,
    url: pageConfig.url,
    status: "ok",
    promotionsFound: 0,
    screenshot: path.join(screenshotDir, `${slug}.png`),
    snapshot: path.join(snapshotDir, `${slug}.html`),
    error: null
  };

  try {
    const response = await page.goto(pageConfig.url, {
      waitUntil: "domcontentloaded",
      timeout: defaults.timeoutMs
    });

    await page.waitForTimeout(defaults.waitAfterLoadMs);
    await dismissObviousPopups(page);
    await expandDetails(page, competitor.selectors?.expandButtons || []);
    await page.waitForTimeout(750);

    const html = await page.content();
    const text = normalizeText(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
    await fs.writeFile(pageResult.snapshot, html, "utf8");
    await page.screenshot({ path: pageResult.screenshot, fullPage: true }).catch(() => {});

    const blockedReason = detectBlocked(text, html, defaults.blockedTextPatterns);
    if (blockedReason) {
      pageResult.status = blockedReason;
    }

    if (response && response.status() >= 400) {
      pageResult.status = `http_${response.status()}`;
    }

    const extracted = await extractPromotions(page, {
      competitor,
      pageConfig,
      keywords: defaults.genericPromoKeywords,
      isDetail
    });

    pageResult.promotionsFound = extracted.promotions.length;
    return {
      pageResult,
      promotions: extracted.promotions.map((promotion) => ({
        ...promotion,
        date,
        brand: competitor.brand,
        displayName: competitor.displayName,
        market: competitor.market,
        pageName: pageConfig.name,
        pageUrl: pageConfig.url,
        pageStatus: pageResult.status,
        screenshot: pageResult.screenshot,
        snapshot: pageResult.snapshot
      })),
      detailLinks: extracted.detailLinks.map((link) => ({
        ...link,
        requiresAuth: pageConfig.requiresAuth
      }))
    };
  } catch (error) {
    pageResult.status = "error";
    pageResult.error = error.message;
    await page.screenshot({ path: pageResult.screenshot, fullPage: true }).catch(() => {});
    return { pageResult, promotions: [], detailLinks: [] };
  }
}

async function dismissObviousPopups(page) {
  const selectors = [
    "button:has-text('Aceitar')",
    "button:has-text('Accept')",
    "button:has-text('Concordo')",
    "button:has-text('OK')",
    "button:has-text('Fechar')",
    "button[aria-label='close']",
    "button[aria-label='Close']"
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
      await loc.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

async function expandDetails(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = Math.min(await loc.count().catch(() => 0), 20);
    for (let index = 0; index < count; index += 1) {
      const item = loc.nth(index);
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        await item.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(250);
      }
    }
  }
}

async function extractPromotions(page, { competitor, pageConfig, keywords, isDetail }) {
  const selector = competitor.selectors?.promoCard || "article, main section, [class*='promo'], [class*='bonus']";
  const removeSelectors = competitor.selectors?.remove || ["nav", "footer", "script", "style"];

  const payload = await page.evaluate(
    ({ selector, removeSelectors, keywords }) => {
      const clone = document.body.cloneNode(true);
      for (const removeSelector of removeSelectors) {
        clone.querySelectorAll(removeSelector).forEach((node) => node.remove());
      }

      const nodes = Array.from(clone.querySelectorAll(selector));
      const cards = nodes
        .map((node) => {
          const anchor = node.matches("a") ? node : node.querySelector("a[href]");
          const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
          return {
            text,
            href: anchor ? anchor.href : null
          };
        })
        .filter((item) => item.text.length > 24);

      const allLinks = Array.from(clone.querySelectorAll("a[href]"))
        .map((anchor) => ({
          label: (anchor.innerText || anchor.textContent || "").replace(/\s+/g, " ").trim(),
          url: anchor.href
        }))
        .filter((link) => {
          const joined = `${link.label} ${link.url}`.toLowerCase();
          return keywords.some((keyword) => joined.includes(keyword.toLowerCase()));
        });

      const mainText = (clone.innerText || clone.textContent || "").trim();
      return { cards, allLinks, mainText };
    },
    { selector, removeSelectors, keywords }
  );

  let cards = payload.cards
    .map((card) => ({
      ...card,
      text: normalizeText(card.text),
      score: scoreTextForPromotion(card.text, keywords)
    }))
    .filter((card) => card.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, isDetail ? 1 : 40);

  if (cards.length === 0 && payload.mainText) {
    const score = scoreTextForPromotion(payload.mainText, keywords);
    if (score > 0 || isDetail) {
      cards = [{ text: normalizeText(payload.mainText), href: pageConfig.url, score }];
    }
  }

  const promotions = cards.map((card) => {
    const fields = detectFields(card.text);
    return {
      id: hash(`${competitor.brand}|${pageConfig.url}|${fields.title}|${card.text.slice(0, 500)}`),
      title: fields.title,
      sourceUrl: card.href || pageConfig.url,
      confidence: confidenceFor(card.score, pageConfig, isDetail),
      extractedFields: fields,
      rawText: truncate(card.text, isDetail ? 6000 : 2500)
    };
  });

  return {
    promotions,
    detailLinks: payload.allLinks
      .filter((link) => isProbablyDetailLink(link.url, page.url()))
      .slice(0, 80)
  };
}

function detectBlocked(text, html, patterns) {
  const haystack = `${text}\n${html}`.toLowerCase();
  for (const pattern of patterns) {
    if (haystack.includes(pattern.toLowerCase())) {
      if (pattern.includes("javascript")) return "js_required_or_blocked";
      if (pattern.includes("captcha") || pattern.includes("humano")) return "captcha_or_human_check";
      if (pattern.includes("access denied") || pattern.includes("cloudflare")) return "blocked";
      return "needs_review";
    }
  }
  return null;
}

function confidenceFor(score, pageConfig, isDetail) {
  if (pageConfig.requiresAuth && isDetail) return "high_logged_in_detail";
  if (pageConfig.requiresAuth) return "medium_logged_in";
  if (isDetail && score >= 3) return "high_public_detail";
  if (score >= 4) return "medium_high_public";
  return "medium_public";
}

function isProbablyDetailLink(url, baseUrl) {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return false;
    if (parsed.hash && parsed.pathname === base.pathname) return false;
    return /promo|promoc|bonus|bônus|cashback|freebet|rodadas|giros|offer|oferta|torneio|missao|missão/i.test(
      `${parsed.pathname} ${parsed.search}`
    );
  } catch {
    return false;
  }
}

function dedupeLinks(links) {
  const seen = new Set();
  const result = [];
  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    result.push(link);
  }
  return result;
}

function dedupePromotions(promotions) {
  const seen = new Set();
  const result = [];
  for (const promotion of promotions) {
    const key = `${promotion.brand}|${promotion.title.toLowerCase()}|${promotion.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(promotion);
  }
  return result;
}

function hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function renderMarkdown(run) {
  const lines = [];
  lines.push(`# Competitor Promotion Daily Report - ${run.date}`);
  lines.push("");
  lines.push(`Generated at: ${run.generatedAt}`);
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push("| Brand | Status | Pages | Notes |");
  lines.push("|---|---|---:|---|");
  for (const competitor of run.competitors) {
    lines.push(
      `| ${escapeMd(competitor.displayName)} | ${competitor.status} | ${competitor.pages.length} | ${escapeMd(
        competitor.notes.join("; ") || "-"
      )} |`
    );
  }
  lines.push("");
  lines.push("## Promotions");
  lines.push("");

  const byBrand = groupBy(run.promotions, (promotion) => promotion.displayName);
  for (const [displayName, promotions] of byBrand) {
    lines.push(`### ${displayName}`);
    lines.push("");
    if (!promotions.length) {
      lines.push("No promotion candidates extracted.");
      lines.push("");
      continue;
    }

    for (const promotion of promotions) {
      lines.push(`#### ${escapeMd(promotion.title)}`);
      lines.push("");
      lines.push(`- Source: ${promotion.sourceUrl}`);
      lines.push(`- Page: ${escapeMd(promotion.pageName)} (${promotion.pageStatus})`);
      lines.push(`- Confidence: ${promotion.confidence}`);
      if (promotion.extractedFields.rewardHints.length) {
        lines.push(`- Reward hints: ${escapeMd(promotion.extractedFields.rewardHints.join("; "))}`);
      }
      if (promotion.extractedFields.requirementHints.length) {
        lines.push(`- Requirement hints: ${escapeMd(promotion.extractedFields.requirementHints.join("; "))}`);
      }
      if (promotion.extractedFields.validityHints.length) {
        lines.push(`- Validity hints: ${escapeMd(promotion.extractedFields.validityHints.join("; "))}`);
      }
      if (promotion.extractedFields.rolloverHints.length) {
        lines.push(`- Rollover hints: ${escapeMd(promotion.extractedFields.rolloverHints.join("; "))}`);
      }
      lines.push("");
      lines.push("```text");
      lines.push(promotion.rawText);
      lines.push("```");
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function groupBy(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function escapeMd(input) {
  return String(input || "").replace(/\|/g, "\\|");
}
