import path from "node:path";
import { readJson } from "./utils.mjs";

export async function loadConfig() {
  const configPath = path.resolve("config/competitors.json");
  const config = await readJson(configPath);
  if (!Array.isArray(config.competitors)) {
    throw new Error("config/competitors.json must contain a competitors array");
  }
  return config;
}

export function findCompetitor(config, brand) {
  return config.competitors.find((competitor) => competitor.brand === brand);
}

