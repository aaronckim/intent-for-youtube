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

## Automation

| Workflow | When | What |
|---|---|---|
| `tests.yml` | every push; daily on `main` | Unit + live-YouTube tests. A failing daily run opens a `canary` issue; a passing one closes it. |
| `claude-fix.yml` | daily run fails; or a comment mentions `@claude` | Claude Code (on your Claude plan) diagnoses with `npm run inspect`, fixes selectors, and opens a `canary-fix` PR. It never merges. |
| `release.yml` | tag `vX.Y.Z` matching the manifest | Tests, packages, creates a GitHub release with the zip, submits to the Chrome Web Store. |

Users report breakage from **Something broken?** in the popup, which opens the `broken` issue form.

**CI blind spot:** YouTube answers GitHub's cloud machines with a "Sign in to confirm you're not a bot" wall on
video pages, so in CI the 8 video-page checks (pause screen, sidebar, autoplay) are skipped with a warning. Search
pages, Shorts, fading and the popup are still checked daily. The Mac check below covers the rest.

### Full daily check on a Mac

`scripts/local-canary.sh` runs the whole suite from a home connection every day at 09:30 (or on next wake), in its
own clone of `main` under `~/Library/Application Support/intent-canary/`. On failure it opens or updates a
`canary-local` issue and shows a notification; on success it closes that issue. It uses no Claude tokens.

```bash
zsh scripts/install-local-canary.sh                # install (re-run after switching Node versions)
launchctl kickstart gui/$(id -u)/com.github.aaronckim.intent-canary   # run it now
zsh scripts/install-local-canary.sh --uninstall    # remove
```

Logs are in `~/Library/Logs/intent-canary/`. To fix a video-page breakage, open Claude Code in a checkout and run
`npm run inspect` and `npm run e2e`.

### One-time setup

1. **Claude fix agent (Max plan):** install the [Claude GitHub app](https://github.com/apps/claude) on this repo,
   then store a subscription token (no API billing):
   ```bash
   claude setup-token
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo aaronckim/intent-for-youtube
   ```
   (`/install-github-app` inside an interactive `claude` session does both steps.)
2. **Store submission** (after the first version is uploaded by hand): in Google Cloud, enable the Chrome Web
   Store API, create a service account with a JSON key, and add its email under **Account** in the Developer
   Dashboard. Then set `CWS_SERVICE_ACCOUNT_KEY` (the key file), `CWS_PUBLISHER_ID`, and `CWS_EXTENSION_ID`:
   ```bash
   gh secret set CWS_SERVICE_ACCOUNT_KEY --repo aaronckim/intent-for-youtube < key.json
   ```
   Until these exist, releases still build and attach the zip; store submission is skipped.

### Releasing

Bump `version` in `extension/manifest.json`, merge to `main`, then push a matching tag: `git tag v0.1.1 && git push origin v0.1.1`.

## Known limits

- YouTube changes its markup often. Selectors were checked against live YouTube on 2026-10-27; `npm run e2e` is the canary.
- Keyword mode is literal: "React hooks" won't match a video titled "useEffect explained" unless you add
  `useEffect` under **Also allow**. Smarter matching (on-device AI) is the planned Pro tier.
- Ads are left alone. The extension can't stop someone from disabling or uninstalling it.

## Privacy and license

See [PRIVACY.md](PRIVACY.md): nothing leaves your device. Licensed under [GPL-3.0](LICENSE).
Intent is not affiliated with or endorsed by YouTube or Google.
