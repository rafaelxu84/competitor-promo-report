import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";
import { findCompetitor, loadConfig } from "./config.mjs";
import { authPathFor, ensureDir, parseArgs } from "./utils.mjs";

const args = parseArgs();
const brand = args.brand;

if (!brand || brand === true) {
  console.error("Usage: npm run login -- --brand=<brand>");
  process.exit(1);
}

const config = await loadConfig();
const competitor = findCompetitor(config, brand);

if (!competitor) {
  console.error(`Unknown brand: ${brand}`);
  console.error(`Available brands: ${config.competitors.map((item) => item.brand).join(", ")}`);
  process.exit(1);
}

await ensureDir(".auth");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  locale: config.defaults.locale,
  timezoneId: config.defaults.timezone,
  viewport: config.defaults.viewport
});
const page = await context.newPage();

console.log(`Opening ${competitor.displayName}: ${competitor.loginUrl}`);
console.log("Log in manually. Do not enter credentials in this terminal.");
console.log("After the account is logged in and the promotions page is visible, return here and press Enter.");

await page.goto(competitor.loginUrl, {
  waitUntil: "domcontentloaded",
  timeout: config.defaults.timeoutMs
});

const rl = readline.createInterface({ input, output });
await rl.question("Press Enter to save this browser session...");
rl.close();

const authPath = authPathFor(brand);
await context.storageState({ path: authPath });
await browser.close();

console.log(`Saved session state to ${authPath}`);

