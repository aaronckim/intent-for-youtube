# Intent for YouTube

MV3 Chrome extension; loadable code lives in `extension/`, tests in `tests/`. No build step.

Verify before calling anything done:

```bash
npm test && npm run e2e
```

`npm run e2e` drives live YouTube in Playwright's Chromium and writes screenshots to `test-results/`.
If it fails on a selector, YouTube changed its markup; re-inspect the live DOM before editing `content.js`/`content.css`.
