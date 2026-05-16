import fs from "node:fs/promises";
import path from "node:path";

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    args[rawKey] = rawValue.length ? rawValue.join("=") : true;
  }
  return args;
}

export function todayISO(timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeText(input) {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncate(input, max = 3000) {
  const text = normalizeText(input);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20).trim()} ... [truncated]`;
}

export function authPathFor(brand) {
  return path.join(".auth", `${brand}.json`);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function scoreTextForPromotion(text, keywords) {
  const lower = normalizeText(text).toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) score += 1;
  }
  if (/[R$]\s?\d|%\s|x\b|freebet|cashback/i.test(text)) score += 2;
  if (/(termos|condicoes|condições|eleg[ií]vel|valid|expira|rollover|apostas?)/i.test(text)) {
    score += 1;
  }
  return score;
}

export function detectFields(text) {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => line.length > 4 && line.length < 140) || lines[0] || "Untitled promotion";

  return {
    title,
    rewardHints: extractMatches(normalized, [
      /R\$\s?\d[\d.,]*/gi,
      /\d+%\s?(?:de\s)?(?:cashback|bonus|bônus|extra|aumentad[ao]s?)/gi,
      /\d+\s?(?:rodadas|giros)\s?gr[aá]tis/gi,
      /\$[\d,.]+/g
    ]),
    requirementHints: extractMatches(normalized, [
      /(?:aposte|apostar|dep[oó]site|depositar|jogue|jogar|fa[çc]a)\s.{0,80}/gi,
      /(?:mínimo|minimo|m[ií]n\.)\s.{0,80}/gi,
      /(?:odds?|cota[cç][aã]o)\s.{0,80}/gi
    ]),
    validityHints: extractMatches(normalized, [
      /(?:v[aá]lid[ao]|expira|at[eé]|de\s\d{1,2}\/\d{1,2}).{0,100}/gi,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{4}-\d{2}-\d{2}/g
    ]),
    rolloverHints: extractMatches(normalized, [
      /(?:rollover|apostas?|apostar)\s(?:de\s)?\d+x/gi,
      /\d+x\s(?:rollover|apostas?|apostar)/gi
    ])
  };
}

function extractMatches(text, regexes) {
  const seen = new Set();
  const matches = [];
  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      const value = normalizeText(match[0]).slice(0, 160);
      if (value && !seen.has(value.toLowerCase())) {
        seen.add(value.toLowerCase());
        matches.push(value);
      }
    }
  }
  return matches.slice(0, 8);
}

