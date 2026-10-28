# Intent for YouTube

MV3 Chrome extension; loadable code lives in `extension/`, tests in `tests/`. No build step.

Verify before calling anything done:

```bash
npm test && npm run e2e
```

`npm run e2e` drives live YouTube in Playwright's Chromium and writes screenshots to `test-results/`.
If it fails on a selector, YouTube changed its markup: run `npm run inspect` to print the live markup the
selectors depend on, then edit `content.js`/`content.css`. Keep the promises in PRIVACY.md: no network
requests, no new permissions.

CI lives in `.github/workflows/`: `tests.yml` (every push + daily canary), `claude-fix.yml` (fix PRs on
canary failure, `@claude` mentions), `release.yml` (tag `vX.Y.Z` = manifest version → GitHub release + store).
CI can't load YouTube video pages (bot wall), so `scripts/local-canary.sh` runs the full suite daily on the owner's
Mac via launchd and reports through `canary-local` issues.
