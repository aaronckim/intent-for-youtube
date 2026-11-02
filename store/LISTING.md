# Chrome Web Store submission kit

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for v0.1.0.
All links point at the public repo.

## Package

Upload `dist/intent-0.1.0.zip` (rebuild with `npm run package`).

## Store listing tab

**Name** (comes from the manifest): Intent: Focus Mode for YouTube

**Summary** (comes from the manifest, 128/132 chars):
Use YouTube for what you came for. Hide Shorts and recommendations, and fade out off-topic videos. Runs entirely on your device.

**Description** (plain text, paste as is):

```
Use YouTube for what you came for.

YouTube is where you learn, and where an hour disappears. Intent keeps the learning and drops the rabbit hole.

TELL IT WHAT YOU CAME FOR
Type a topic ("React hooks", "calculus", "guitar chords") and start a focus session. Videos that match stay sharp. Everything else fades out, with a "show anyway" button for when you really need it.

A PAUSE BEFORE THE RABBIT HOLE
Open an off-topic video and Intent pauses it behind a short screen that reminds you what you came for and offers to search for that instead. Still want to watch? "Watch anyway" unlocks after 10 seconds.

ALWAYS HIDE (each one optional)
• Home feed
• Shorts (Shorts links open as regular videos)
• Sidebar recommendations
• End-screen suggestions
• Autoplay
• The left menu, whole or button by button: Home, Shorts, Subscriptions, You, History, Explore and more
• Top-bar buttons: the ☰ menu, the YouTube logo, voice search, Create, notifications
• One switch turns Intent off and back on without losing your choices

PRIVATE BY DESIGN
• Runs entirely in your browser. Nothing you watch is sent anywhere: no accounts, no analytics, no tracking.
• Two permissions only: storage for your settings, and access to youtube.com.
• Open source: https://github.com/aaronckim/intent-for-youtube

HOW MATCHING WORKS
Intent compares video titles and channel names with the keywords in your topic. Add extra words under "Also allow" (like "useEffect" or a channel name) to widen a session.

Intent is not affiliated with or endorsed by YouTube or Google.
```

**Category:** Productivity › Workflow & Planning
**Language:** English

**Graphics** (all in `store/`, regenerate with `npm run store-assets`):

| Field | File |
|---|---|
| Store icon (128×128) | `extension/icons/icon128.png` |
| Screenshots (1280×800), in this order | `screenshot-2-pause.png`, `screenshot-1-fade.png`, `screenshot-3-clean.png`, `screenshot-4-popup.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |

**Homepage URL:** https://github.com/aaronckim/intent-for-youtube
**Support URL:** https://github.com/aaronckim/intent-for-youtube/issues

## Privacy tab

**Single purpose:**
Helps people stay focused on YouTube. It hides distracting page elements (home feed, Shorts, recommendations, autoplay) and, during a focus session the user starts, fades or pauses videos that don't match the topic they typed.

**Permission justifications:**
- `storage`: Saves the user's on/off settings and current focus topic on their device with chrome.storage. Nothing is sent to a server.
- Host permission (`https://www.youtube.com/*`): The content script has to run on YouTube pages to hide Shorts, recommendations, end screens and autoplay, and to compare video titles on the page with the user's focus topic. It runs on www.youtube.com only.

**Remote code:** No, I am not using remote code.

**Data usage:** Leave every data type unchecked: titles are read in memory on the page and nothing leaves the device.
If a reviewer disagrees, tick "Website content" and point to the privacy policy. Tick all three certifications.

**Privacy policy URL:** https://github.com/aaronckim/intent-for-youtube/blob/main/PRIVACY.md

## Distribution tab

- Payments: Free
- Visibility: Public
- Regions: All regions

## Submit

Choose **defer publishing** in the submit dialog, so approval doesn't publish it automatically and you pick launch day
(lined up with the Reddit and Show HN posts in the launch plan).
