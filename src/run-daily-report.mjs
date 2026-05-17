import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, todayISO } from "./utils.mjs";
import { loadConfig } from "./config.mjs";

const args = parseArgs();
const config = await loadConfig();
const date = !args.date || args.date === "today" ? todayISO(config.defaults.timezone) : String(args.date);
const minOkPages = Number(args.minOkPages ?? 1);

const crawlArgs = ["run", "crawl:browser", "--", `--date=${date}`];
if (args.brand) crawlArgs.push(`--brand=${args.brand}`);
if (args.maxDetails) crawlArgs.push(`--maxDetails=${args.maxDetails}`);
if (args.channel) crawlArgs.push(`--channel=${args.channel}`);
if (args.headed) crawlArgs.push("--headed");

await run("npm", crawlArgs);
await assertMinimumCoverage(date, minOkPages);
await run("npm", ["run", "report:detailed", "--", `--date=${date}`]);
await run("npm", ["run", "report:index"]);
await run("npm", ["run", "build:pages", "--", `--date=${date}`]);

console.log(`Daily competitor report complete for ${date}`);

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function assertMinimumCoverage(reportDate, minimumOkPages) {
  if (minimumOkPages <= 0) return;

  const observationPath = path.join("reports", reportDate, "browser-observations.json");
  const observations = JSON.parse(await fs.readFile(observationPath, "utf8"));
  const okPages = (observations.results || []).filter((item) => item.status === "ok").length;

  if (okPages < minimumOkPages) {
    throw new Error(
      `Only ${okPages} listing pages opened successfully; expected at least ${minimumOkPages}. See ${observationPath}.`
    );
  }

  console.log(`Coverage check OK: ${okPages} listing pages opened successfully.`);
}
