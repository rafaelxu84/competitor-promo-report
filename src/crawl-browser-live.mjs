import path from "node:path";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { loadConfig } from "./config.mjs";
import {
  detectFields,
  ensureDir,
  normalizeText,
  parseArgs,
  slugify,
  todayISO,
  truncate,
  writeJson
} from "./utils.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const brandsFilter = args.brand ? new Set(String(args.brand).split(",").map((item) => item.trim())) : null;
const headed = args.headed === true || args.headed === "true" || args.headed === "1";
const maxDetailPagesPerBrand = Number(args.maxDetails || 30);

const reportDir = path.join("reports", date);
const listingShotDir = path.join(reportDir, "browser-screenshots");
const detailShotRoot = path.join(reportDir, "detail-screenshots");

await Promise.all([ensureDir(reportDir), ensureDir(listingShotDir), ensureDir(detailShotRoot)]);

const competitors = brandsFilter
  ? config.competitors.filter((competitor) => brandsFilter.has(competitor.brand))
  : config.competitors;

let browser = null;
let browserLaunchError = null;
try {
  const launchOptions = {
    headless: !headed,
    args: ["--disable-crashpad", "--disable-crash-reporter", "--no-crash-upload"]
  };
  if (args.channel) launchOptions.channel = String(args.channel);
  browser = await chromium.launch(launchOptions);
} catch (error) {
  browserLaunchError = error;
}

const observations = {
  generatedAt: new Date().toISOString(),
  date,
  results: []
};

const promoDetails = {
  generatedAt: new Date().toISOString(),
  date,
  results: []
};

for (const competitor of competitors) {
  const brandName = competitor.displayName;
  const brandSlug = slugify(brandName);

  const context = browser
    ? await browser.newContext({
        locale: config.defaults.locale,
        timezoneId: config.defaults.timezone,
        viewport: config.defaults.viewport,
        userAgent: config.defaults.userAgent,
        extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" },
        colorScheme: "light"
      })
    : null;

  const page = context ? await context.newPage() : null;
  const detailCandidates = [];

  for (const pageConfig of competitor.pages || []) {
    const pageName = pageConfig.name || "Promotions";
    const slug = slugify(`${brandSlug}-${pageName}`);
    const screenshotPath = path.join(listingShotDir, `${slug}.png`);

    const visited = page
      ? await visitAndCapture({
          page,
          competitor,
          url: pageConfig.url,
          screenshotPath,
          defaults: config.defaults,
          kind: "listing"
        })
      : await captureViaHttp({
          competitor,
          url: pageConfig.url,
          screenshotPath,
          kind: "listing",
          browserLaunchError
        });

    const finalListingShot = visited.screenshotPath || screenshotPath;
    observations.results.push({
      brand: brandName,
      pageName,
      url: pageConfig.url,
      finalUrl: visited.finalUrl,
      status: visited.status,
      error: visited.error || null,
      pageTitle: visited.pageTitle,
      screenshot: finalListingShot,
      text: visited.text
    });

    for (const link of visited.detailLinks) {
      detailCandidates.push({ ...link, listingUrl: pageConfig.url });
    }
  }

  const deduped = dedupeLinks(detailCandidates).slice(0, maxDetailPagesPerBrand);
  const details = [];
  const brandDetailDir = path.join(detailShotRoot, brandSlug);
  await ensureDir(brandDetailDir);

  for (const candidate of deduped) {
    const detailSlug = slugify(`${brandSlug}-${candidate.linkText || ""}-${candidate.url}`);
    const detailScreenshot = path.join(brandDetailDir, `${detailSlug}.png`);

    const visited = page
      ? await visitAndCapture({
          page,
          competitor,
          url: candidate.url,
          screenshotPath: detailScreenshot,
          defaults: config.defaults,
          kind: "detail"
        })
      : await captureViaHttp({
          competitor,
          url: candidate.url,
          screenshotPath: detailScreenshot,
          kind: "detail",
          browserLaunchError
        });

    const finalDetailShot = visited.screenshotPath || detailScreenshot;
    const detected = detectFields(visited.text || "");
    details.push({
      url: candidate.url,
      listingUrl: candidate.listingUrl,
      finalUrl: visited.finalUrl,
      pageTitle: visited.pageTitle,
      linkText: candidate.linkText,
      status: visited.status === "ok" && (visited.text || "").length < 220 ? "limited" : visited.status,
      error: visited.error,
      screenshot: path.join(reportDir, "detail-screenshots", brandSlug, path.basename(finalDetailShot)),
      text: truncate(visited.text || "", 6500),
      fields: {
        title: detected.title,
        reward: detected.rewardHints.join("; "),
        requirement: detected.requirementHints.join("; "),
        dates: detected.validityHints,
        excerpt: truncate(visited.text || "", 2200)
      }
    });
  }

  promoDetails.results.push({
    brand: brandName,
    brandSlug,
    pages: (competitor.pages || []).map((item) => ({ name: item.name, url: item.url })),
    details
  });

  if (context) await context.close();
}

if (browser) await browser.close();

await writeJson(path.join(reportDir, "browser-observations.json"), observations);
await writeJson(path.join(reportDir, "browser-promo-details-live.json"), promoDetails);

console.log(path.join(reportDir, "browser-observations.json"));
console.log(path.join(reportDir, "browser-promo-details-live.json"));

async function visitAndCapture({ page, competitor, url, screenshotPath, defaults, kind }) {
  const output = {
    finalUrl: url,
    status: "ok",
    pageTitle: "",
    text: "",
    detailLinks: [],
    error: null
  };

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: defaults.timeoutMs });
    await page.waitForTimeout(defaults.waitAfterLoadMs);
    await dismissObviousPopups(page);
    await expandDetails(page, competitor.selectors?.expandButtons || []);
    await page.waitForTimeout(750);

    output.finalUrl = page.url();
    output.pageTitle = await page.title().catch(() => "");

    const extracted = await extractVisible({
      page,
      removeSelectors: competitor.selectors?.remove || ["nav", "footer", "script", "style"]
    });
    output.text = extracted.text;
    if (kind === "listing") output.detailLinks = extracted.detailLinks;

    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const blockedReason = detectBlocked(output.text, defaults.blockedTextPatterns);
    if (blockedReason) output.status = blockedReason;
    if (response && response.status() >= 400) output.status = `http_${response.status()}`;
    if (!output.text || output.text.length < 60) output.status = output.status === "ok" ? "limited" : output.status;
    return output;
  } catch (error) {
    output.status = "error";
    output.error = error.message;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    return output;
  }
}

async function captureViaHttp({ competitor, url, screenshotPath, kind, browserLaunchError }) {
  const output = {
    finalUrl: url,
    status: "error",
    pageTitle: "",
    text: "",
    detailLinks: [],
    error: browserLaunchError ? `Browser unavailable: ${browserLaunchError.message}` : "Browser unavailable",
    screenshotPath: null
  };

  output.screenshotPath = await writePlaceholderScreenshot(screenshotPath, output.error);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": config.defaults.userAgent, "accept-language": config.defaults.locale || "en-US" }
    });
    output.finalUrl = response.url || url;
    const html = await response.text();
    const text = normalizeText(htmlToText(html));
    output.text = truncate(text, 9000);
    output.status = response.status >= 400 ? `http_${response.status}` : text.length < 80 ? "limited" : "ok";
    output.pageTitle = extractTitle(html);
    if (kind === "listing") {
      output.detailLinks = extractLinks(html, output.finalUrl)
        .filter((link) => isProbablyDetailLink(link.url, output.finalUrl))
        .slice(0, 80);
    }
  } catch (error) {
    output.status = "error";
    output.error = `HTTP fallback failed: ${error.message}`;
  }

  return output;
}

async function writePlaceholderScreenshot(targetPath, message) {
  const safe = normalizeText(message || "Unavailable").slice(0, 160);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
  <rect width="100%" height="100%" fill="#f5f6f2"/>
  <rect x="40" y="40" width="1360" height="820" rx="18" fill="#ffffff" stroke="#d8ddd4" stroke-width="2"/>
  <text x="80" y="140" font-family="Inter, Arial" font-size="40" font-weight="800" fill="#15201b">Capture unavailable</text>
  <text x="80" y="210" font-family="Inter, Arial" font-size="22" fill="#66736d">${escapeXml(safe)}</text>
  <text x="80" y="270" font-family="Inter, Arial" font-size="18" fill="#66736d">${escapeXml(targetPath)}</text>
</svg>`;
  const actualPath = targetPath.endsWith(".png") ? targetPath.replace(/\.png$/i, ".svg") : targetPath;
  await fs.mkdir(path.dirname(actualPath), { recursive: true });
  await fs.writeFile(actualPath, svg, "utf8");
  return actualPath;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function extractTitle(html) {
  const match = String(html || "").match(new RegExp("<title[^>]*>([^<]+)</title>", "i"));
  return normalizeText(match ? match[1] : "");
}

function extractLinks(html, baseUrl) {
  const anchors = String(html || "").matchAll(
    /<a\s+[^>]*href\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
  );
  const results = [];
  for (const match of anchors) {
    const href = match[2] || match[3] || match[4] || "";
    const label = htmlToText(match[5] || "").replace(/\s+/g, " ").trim();
    try {
      results.push({ url: new URL(href, baseUrl).toString(), linkText: label.slice(0, 140) });
    } catch {
      // ignore invalid urls
    }
  }
  return results;
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractVisible({ page, removeSelectors }) {
  const keywords = config.defaults.genericPromoKeywords || [];
  const { text, links } = await page.evaluate(
    ({ removeSelectors, keywords }) => {
      const clone = document.body.cloneNode(true);
      for (const selector of removeSelectors) {
        clone.querySelectorAll(selector).forEach((node) => node.remove());
      }

      const visibleText = (clone.innerText || clone.textContent || "").replace(/\u00a0/g, " ").trim();

      const anchors = Array.from(clone.querySelectorAll("a[href]"))
        .map((anchor) => ({
          linkText: (anchor.innerText || anchor.textContent || "").replace(/\s+/g, " ").trim(),
          url: anchor.href
        }))
        .filter((link) => link.url && link.url.startsWith("http"));

      const filtered = anchors.filter((link) => {
        const joined = `${link.linkText} ${link.url}`.toLowerCase();
        return keywords.some((keyword) => joined.includes(keyword.toLowerCase()));
      });

      return { text: visibleText, links: filtered };
    },
    { removeSelectors, keywords }
  );

  const finalText = normalizeText(text || "");
  const finalLinks = (links || [])
    .filter((link) => isProbablyDetailLink(link.url, page.url()))
    .slice(0, 120);

  return { text: finalText, detailLinks: finalLinks };
}

function detectBlocked(text, patterns) {
  const haystack = String(text || "").toLowerCase();
  for (const pattern of patterns || []) {
    if (!pattern) continue;
    if (haystack.includes(String(pattern).toLowerCase())) {
      if (String(pattern).toLowerCase().includes("javascript")) return "js_required_or_blocked";
      if (String(pattern).toLowerCase().includes("captcha") || String(pattern).toLowerCase().includes("human")) return "captcha_or_human_check";
      if (String(pattern).toLowerCase().includes("access denied") || String(pattern).toLowerCase().includes("cloudflare")) return "blocked";
      return "needs_review";
    }
  }
  return null;
}

async function dismissObviousPopups(page) {
  const selectors = [
    "button:has-text('Accept')",
    "button:has-text('I Agree')",
    "button:has-text('OK')",
    "button:has-text('Close')",
    "button[aria-label='close']",
    "button[aria-label='Close']",
    "[role='dialog'] button:has-text('Accept')"
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 900 }).catch(() => false)) {
      await loc.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

async function expandDetails(page, selectors) {
  for (const selector of selectors || []) {
    const loc = page.locator(selector);
    const count = Math.min(await loc.count().catch(() => 0), 25);
    for (let index = 0; index < count; index += 1) {
      const item = loc.nth(index);
      if (await item.isVisible({ timeout: 450 }).catch(() => false)) {
        await item.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(220);
      }
    }
  }
}

function isProbablyDetailLink(url, baseUrl) {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return false;
    if (parsed.hash && parsed.pathname === base.pathname) return false;
    return /promo|promoc|bonus|bônus|cashback|freebet|free-bet|free_spins|freespins|offer|oferta|torneio|mission|quest|reward/i.test(
      `${parsed.pathname} ${parsed.search}`
    );
  } catch {
    return false;
  }
}

function dedupeLinks(links) {
  const seen = new Set();
  const result = [];
  for (const link of links || []) {
    if (!link?.url) continue;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    result.push(link);
  }
  return result;
}
