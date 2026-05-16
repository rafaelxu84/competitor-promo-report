# Report Fields

`reports/YYYY-MM-DD/promotions.json` is the machine-readable output for downstream dashboards.

## Top-Level Fields

- `generatedAt`: ISO timestamp for the crawl run.
- `date`: report date in Brazil timezone.
- `competitors`: page-level crawl status by brand.
- `promotions`: extracted promotion candidates.

## Promotion Fields

- `id`: stable hash for deduplication.
- `date`: report date.
- `brand`: stable brand id.
- `displayName`: readable brand name.
- `market`: market label.
- `title`: inferred promotion title.
- `sourceUrl`: source page or detail page.
- `pageName`: configured page name.
- `pageUrl`: page crawled.
- `pageStatus`: `ok`, `auth_missing`, `captcha_or_human_check`, `blocked`, `js_required_or_blocked`, `http_*`, or `error`.
- `confidence`: extraction confidence.
- `extractedFields.rewardHints`: amount, percentage, free spin, freebet, or prize hints.
- `extractedFields.requirementHints`: deposit, wager, minimum odds, or participation hints.
- `extractedFields.validityHints`: date and validity hints.
- `extractedFields.rolloverHints`: rollover and wagering hints.
- `rawText`: extracted source text excerpt.
- `screenshot`: local screenshot path.
- `snapshot`: local HTML snapshot path.

## Recommended Human Review Rules

Review any item where:

- `pageStatus` is not `ok`.
- `confidence` starts with `medium` and the promotion affects pricing or bonus cost.
- `rawText` mentions login-only, personalized, invitation, VIP, or eligibility terms.
- A competitor has `auth_missing`, which means the session was not saved yet.

## Suggested Daily Workflow

1. Run `npm run crawl`.
2. Open `reports/YYYY-MM-DD/promo-report.md`.
3. Review brands marked `needs_review`.
4. For expired sessions, run `npm run login -- --brand=<brand>`.
5. Re-run `npm run crawl -- --brand=<brand>` for only the affected brand.

