# Intent: Focus Mode for YouTube

Use YouTube for what you came for. A Manifest V3 Chrome extension (free tier MVP).

- **Always hide:** home feed, Shorts, sidebar recommendations, end-screen suggestions, autoplay.
- **Focus session:** type what you're here for ("React hooks"). Off-topic videos in search, the
  sidebar, and grids fade out with a "show anyway" button.
- **Friction screen:** opening an off-topic video pauses it behind a screen that names your intent,
  offers to search for it instead, and unlocks "Watch anyway" after 10 seconds.
- During a session, Shorts links open as regular videos so the screen still applies.

Permissions are `storage` plus content-script access to `www.youtube.com`. No network requests, no analytics.

## Try it

1. `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the `extension/` folder.
2. Click the Intent icon, type a topic, **Start focus session**, then use YouTube.

## Develop

```bash
npm install
npm test        # keyword-matching unit tests
npm run e2e     # live YouTube end-to-end test, screenshots in test-results/ (HEADED=1 to watch)
```

To release: `npm run package` builds the upload zip in `dist/`, `npm run store-assets` regenerates the store
images in `store/`, and [store/LISTING.md](store/LISTING.md) has the listing copy and Privacy-tab answers.
To test the packaged build, unzip it and run `EXTENSION_DIR=<unzipped folder> npm run e2e`.

| Path | What it is |
|---|---|
| `extension/src/intent.js` | Keyword matcher (stopwords, light stemming, prefix and joined-token matching) |
| `extension/src/content.js` | Hiding classes, card fading, friction screen, Shorts redirect, autoplay |
| `extension/src/content.css` | All hiding rules and the injected UI |
| `extension/popup/` | Toolbar popup: session controls and toggles |
| `scripts/make-icons.py` | Regenerates `extension/icons/` |

## Known limits

- YouTube changes its markup often. Selectors were checked against live YouTube on 2026-10-27; `npm run e2e` is the canary.
- Keyword mode is literal: "React hooks" won't match a video titled "useEffect explained" unless you add
  `useEffect` under **Also allow**. Smarter matching (on-device AI) is the planned Pro tier.
- Ads are left alone. The extension can't stop someone from disabling or uninstalling it.

## Privacy and license

See [PRIVACY.md](PRIVACY.md): nothing leaves your device. Licensed under [GPL-3.0](LICENSE).
Intent is not affiliated with or endorsed by YouTube or Google.
