import fs from "node:fs/promises";
import path from "node:path";

const date = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1] || latestReportDate();
if (!date) {
  throw new Error("No report date found. Run report generation first.");
}

const sourceRoot = path.join("reports", date);
const sourceSite = path.join(sourceRoot, "site");
const sourceScreenshots = path.join(sourceRoot, "browser-screenshots");
const publishRoot = "docs";
const publishReportRoot = path.join(publishRoot, "reports", date);

await assertDir(sourceSite);
await assertDir(sourceScreenshots);

await fs.rm(path.join(publishRoot, "reports"), { recursive: true, force: true });
await fs.mkdir(publishReportRoot, { recursive: true });
await copyDir(sourceSite, path.join(publishReportRoot, "site"));
await copyDir(sourceScreenshots, path.join(publishReportRoot, "browser-screenshots"));

await fs.writeFile(
  path.join(publishRoot, "index.html"),
  redirectHtml(`reports/${date}/site/index.html`, "竞品活动日报"),
  "utf8"
);

await fs.writeFile(
  path.join(publishRoot, "latest-site.html"),
  redirectHtml(`reports/${date}/site/index.html`, "Latest Report"),
  "utf8"
);

await fs.writeFile(
  path.join(publishReportRoot, "index.html"),
  redirectHtml("site/index.html", `${date} Report`),
  "utf8"
);

console.log(`Built GitHub Pages site for ${date} in ${publishRoot}/`);

function latestReportDate() {
  return null;
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(source, target);
    } else if (entry.isFile()) {
      await fs.copyFile(source, target);
    }
  }
}

async function assertDir(dir) {
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Missing directory: ${dir}`);
}

function redirectHtml(target, title) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <p><a href="${escapeHtml(target)}">打开报告 / Open report</a></p>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
