# Competitor Promo Crawler

Daily crawler for competitor promotions, bonuses, cashback, free spins, freebets, odds boosts, VIP missions, and tournament pages in the Brazil betting/iGaming market.

The crawler is designed for compliance-friendly monitoring:

- It uses official public pages and your own logged-in browser sessions.
- It does not store account passwords.
- It does not bypass CAPTCHA, KYC, paywalls, or access controls.
- It saves screenshots and HTML snapshots so every extracted item can be audited.
- It marks blocked, login-only, or unclear pages as `needs_review`.

## Setup

Install dependencies:

```bash
npm install
```

If `npm` is not available in this Codex session, install/run this project from your normal terminal where Node and npm are available.

## One-Time Login

For competitors that require login, run:

```bash
npm run login -- --brand=betano
```

The browser will open. Log in manually, close any popups, then return to the terminal and press Enter. The crawler stores only browser session state in `.auth/betano.json`.

Repeat for each brand where you have a read-only monitoring account.

## Daily Crawl

```bash
npm run crawl
```

Outputs:

- `reports/YYYY-MM-DD/promo-report.md`
- `reports/YYYY-MM-DD/promotions.json`
- `snapshots/YYYY-MM-DD/*.html`
- `screenshots/YYYY-MM-DD/*.png`

## Configuration

Edit `config/competitors.json` to add pages, login URLs, or brand-specific selectors.

Important fields:

- `brand`: stable brand id.
- `displayName`: readable name in reports.
- `market`: market label, usually `BR`.
- `loginUrl`: used by `npm run login`.
- `pages`: pages to crawl.
- `requiresAuth`: whether the page should use `.auth/<brand>.json`.
- `selectors.promoCard`: optional selector for promo cards.
- `selectors.expandButtons`: optional selectors clicked before extraction.
- `selectors.remove`: selectors removed from extracted text.

## Daily Automation

On macOS/Linux, run via cron after sessions are saved:

```cron
15 9 * * * cd /path/to/competitor-promo-crawler && npm run crawl
```

Sessions may expire. When a report marks a brand as `auth_expired` or `needs_review`, rerun `npm run login -- --brand=<brand>`.

## Current Coverage

Seeded brands:

- Stake / Stake.bet.br
- AFUN / Afun.bet.br
- BC.Game
- 1xBet
- Betano
- Superbet
- bet365
- 7Games
- KTO
- Betnacional
- Sportingbet
- EstrelaBet

