import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { loadConfig } from "./config.mjs";
import {
  detectFields,
  ensureDir,
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

const reportDir = path.join("reports", date);
const snapshotDir = path.join("snapshots", date);
await Promise.all([ensureDir(reportDir), ensureDir(snapshotDir)]);

const competitors = brandsFilter
  ? config.competitors.filter((competitor) => brandsFilter.has(competitor.brand))
  : config.competitors;

const run = {
  generatedAt: new Date().toISOString(),
  date,
  mode: "public_fetch",
  competitors: [],
  promotions: []
};

for (const competitor of competitors) {
  console.log(`\n== ${competitor.displayName} ==`);
  const brandResult = {
    brand: competitor.brand,
    displayName: competitor.displayName,
    market: competitor.market,
    status: "ok",
    pages: [],
    notes: []
  };

  for (const pageConfig of competitor.pages) {
    if (pageConfig.requiresAuth) {
      brandResult.status = "needs_review";
      brandResult.notes.push(`${pageConfig.name}: auth page skipped in public_fetch mode`);
      brandResult.pages.push({
        name: pageConfig.name,
        url: pageConfig.url,
        status: "auth_skipped",
        promotionsFound: 0,
        snapshot: null,
        error: "Use npm run login and npm run crawl for logged-in browser crawling"
      });
      console.log(`skip auth page: ${pageConfig.name}`);
      continue;
    }

    const result = await fetchPage({ competitor, pageConfig, defaults: config.defaults, snapshotDir, date });
    brandResult.pages.push(result.pageResult);
    run.promotions.push(...result.promotions);
    if (result.pageResult.status !== "ok") {
      brandResult.status = "needs_review";
      brandResult.notes.push(`${pageConfig.name}: ${result.pageResult.status}`);
    }
    console.log(`${pageConfig.name}: ${result.pageResult.status}, ${result.promotions.length} candidates`);
  }

  run.competitors.push(brandResult);
}

run.promotions = dedupePromotions(run.promotions);
await writeJson(path.join(reportDir, "promotions.json"), run);
await fs.writeFile(path.join(reportDir, "promo-report.md"), renderMarkdown(run), "utf8");

console.log(`\nWrote ${path.join(reportDir, "promo-report.md")}`);
console.log(`Wrote ${path.join(reportDir, "promotions.json")}`);

async function fetchPage({ competitor, pageConfig, defaults, snapshotDir, date }) {
  const slug = slugify(`${competitor.brand}-${pageConfig.name}`);
  const snapshot = path.join(snapshotDir, `${slug}.html`);
  const pageResult = {
    name: pageConfig.name,
    url: pageConfig.url,
    status: "ok",
    promotionsFound: 0,
    snapshot,
    error: null
  };

  try {
    const response = await fetch(pageConfig.url, {
      redirect: "follow",
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.6",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(defaults.timeoutMs)
    });

    const html = await response.text();
    await fs.writeFile(snapshot, html, "utf8");

    if (!response.ok) pageResult.status = `http_${response.status}`;
    const text = htmlToText(html);
    const blocked = detectBlocked(text, html, defaults.blockedTextPatterns);
    if (blocked) pageResult.status = blocked;

    const sections = splitIntoPromotionSections(text, defaults.genericPromoKeywords);
    const promotions = sections.map((section) => {
      const fields = detectFields(section.text);
      return {
        id: hash(`${competitor.brand}|${pageConfig.url}|${fields.title}|${section.text.slice(0, 500)}`),
        date,
        brand: competitor.brand,
        displayName: competitor.displayName,
        market: competitor.market,
        title: fields.title,
        sourceUrl: pageConfig.url,
        pageName: pageConfig.name,
        pageUrl: pageConfig.url,
        pageStatus: pageResult.status,
        confidence: section.score >= 4 ? "medium_high_public_fetch" : "medium_public_fetch",
        extractedFields: fields,
        rawText: truncate(section.text, 5000),
        snapshot
      };
    });

    pageResult.promotionsFound = promotions.length;
    return { pageResult, promotions };
  } catch (error) {
    pageResult.status = "error";
    pageResult.error = error.message;
    return { pageResult, promotions: [] };
  }
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

function htmlToText(html) {
  return normalizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
      .replace(/<\/(h[1-6]|p|li|section|article|div|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  );
}

function splitIntoPromotionSections(text, keywords) {
  const paragraphs = normalizeText(text).split(/\n{1,}|\s{4,}/).map((item) => item.trim()).filter(Boolean);
  const windows = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const chunk = paragraphs.slice(index, index + 8).join("\n");
    const score = scoreTextForPromotion(chunk, keywords);
    if (score >= 2 && chunk.length > 80) {
      windows.push({ text: chunk, score });
      index += 5;
    }
  }

  if (windows.length === 0) {
    const score = scoreTextForPromotion(text, keywords);
    if (score > 0) windows.push({ text, score });
  }

  return windows.sort((a, b) => b.score - a.score).slice(0, 25);
}

function dedupePromotions(promotions) {
  const seen = new Set();
  const result = [];
  for (const promotion of promotions) {
    const key = `${promotion.brand}|${promotion.title.toLowerCase()}|${promotion.rawText.slice(0, 160).toLowerCase()}`;
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
  lines.push(`Mode: ${run.mode}`);
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
    for (const promotion of promotions) {
      lines.push(`#### ${escapeMd(promotion.title)}`);
      lines.push("");
      lines.push(`- Source: ${promotion.sourceUrl}`);
      lines.push(`- Page status: ${promotion.pageStatus}`);
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

