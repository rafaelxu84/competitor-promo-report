import { loadConfig } from "./config.mjs";

const config = await loadConfig();
const brands = new Set();
const errors = [];

for (const competitor of config.competitors) {
  if (!competitor.brand) errors.push("A competitor is missing brand");
  if (brands.has(competitor.brand)) errors.push(`Duplicate brand: ${competitor.brand}`);
  brands.add(competitor.brand);

  if (!competitor.displayName) errors.push(`${competitor.brand} is missing displayName`);
  if (!competitor.loginUrl) errors.push(`${competitor.brand} is missing loginUrl`);
  if (!Array.isArray(competitor.pages) || competitor.pages.length === 0) {
    errors.push(`${competitor.brand} must define at least one page`);
  }

  for (const page of competitor.pages || []) {
    try {
      new URL(page.url);
    } catch {
      errors.push(`${competitor.brand}/${page.name || "unnamed"} has invalid URL: ${page.url}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Config OK: ${config.competitors.length} competitors`);

