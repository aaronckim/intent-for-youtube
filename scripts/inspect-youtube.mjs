// Prints the parts of YouTube's live markup that extension/src/content.js and content.css depend on,
// so a failing e2e run can be traced to what YouTube changed. No extension is loaded.
// Usage: npm run inspect [-- "search query"] [-- VIDEO_ID]

import { chromium } from 'playwright';

const query = process.argv[2] || 'react hooks';
const CARD_TAGS = [
  'ytd-video-renderer', 'ytd-compact-video-renderer', 'ytd-rich-grid-media', 'ytd-rich-item-renderer',
  'yt-lockup-view-model', 'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
  'grid-shelf-view-model', 'ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer', 'ytd-ad-slot-renderer',
];

function describeCards(tags) {
  const counts = Object.fromEntries(tags.map((t) => [t, document.querySelectorAll(t).length]).filter(([, n]) => n));
  const sample = (selector) => {
    const card = document.querySelector(selector);
    if (!card) return null;
    return {
      '#video-title': card.querySelector('#video-title')?.getAttribute('title') ?? null,
      'h3[title]': card.querySelector('h3[title]')?.getAttribute('title') ?? null,
      '.ytLockupMetadataViewModelTitle': card.querySelector('.ytLockupMetadataViewModelTitle')?.textContent.trim() ?? null,
      channel: card.querySelector('ytd-channel-name #text, .ytContentMetadataViewModelMetadataText')?.textContent.trim() ?? null,
      href: card.querySelector('a[href*="/watch"], a[href*="/shorts/"]')?.getAttribute('href') ?? null,
    };
  };
  return {
    counts,
    'ytd-video-renderer sample': sample('ytd-video-renderer'),
    'yt-lockup-view-model sample': sample('yt-lockup-view-model:not(:has(a[href*="googleadservices"]))'),
    shortsLinks: document.querySelectorAll('a[href^="/shorts/"]').length,
  };
}

// The left menu and top bar, matched in content.css by link (the wide menu's Shorts entry only by title).
function describeChrome() {
  const display = (el) => (el ? getComputedStyle(el).display : 'missing');
  return {
    'wide menu (#guide)': display(document.querySelector('tp-yt-app-drawer#guide')),
    'wide menu entries (title -> href)': [...document.querySelectorAll('#guide ytd-guide-entry-renderer a')]
      .map((a) => `${a.getAttribute('title')} -> ${a.getAttribute('href')}`),
    'wide menu sections': [...document.querySelectorAll('#guide ytd-guide-section-renderer')]
      .map((s) => s.querySelector('#guide-section-title')?.textContent.trim() || '(untitled)'),
    'ytd-guide-renderer > #footer': Boolean(document.querySelector('ytd-guide-renderer > #footer')),
    'narrow menu entries (href)': [...document.querySelectorAll('ytd-mini-guide-entry-renderer a')].map((a) => a.getAttribute('href')),
    'ytd-page-manager margin-left': getComputedStyle(document.querySelector('ytd-page-manager')).marginLeft,
    'top bar': {
      '#guide-button': document.querySelectorAll('ytd-app #guide-button').length,
      'ytd-topbar-logo-renderer': document.querySelectorAll('ytd-app ytd-topbar-logo-renderer').length,
      '#voice-search-button': document.querySelectorAll('ytd-masthead #voice-search-button').length,
      '#buttons children': [...document.querySelectorAll('ytd-masthead #buttons > *')].map((b) => b.tagName.toLowerCase()),
    },
  };
}

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 }, locale: 'en-US',
});
const page = context.pages()[0];

try {
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('\n== Left menu and top bar (home page, 1400px wide)');
  console.log(JSON.stringify(await page.evaluate(describeChrome), null, 2));
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(2000);
  console.log('\n== Narrow menu (1100px wide)');
  console.log(JSON.stringify(await page.evaluate(() => ({
    'narrow menu entries (href)': [...document.querySelectorAll('ytd-mini-guide-entry-renderer a')].map((a) => a.getAttribute('href')),
    'ytd-page-manager margin-left': getComputedStyle(document.querySelector('ytd-page-manager')).marginLeft,
  })), null, 2));
  await page.setViewportSize({ width: 1400, height: 900 });

  await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log(`\n== Search: ${query}`);
  console.log(JSON.stringify(await page.evaluate(describeCards, CARD_TAGS), null, 2));

  const videoId = process.argv[3] || await page.evaluate(() =>
    new URLSearchParams(document.querySelector('a[href^="/watch?v="]')?.getAttribute('href')?.split('?')[1]).get('v'));
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  console.log(`\n== Watch page: ${videoId}`);
  console.log(JSON.stringify(await page.evaluate((tags) => {
    const meta = document.querySelector('ytd-watch-metadata');
    return {
      'ytd-watch-flexy[video-id]': document.querySelector('ytd-watch-flexy')?.getAttribute('video-id') ?? null,
      'ytd-watch-metadata[video-id]': meta?.getAttribute('video-id') ?? null,
      'ytd-watch-metadata h1': meta?.querySelector('h1')?.textContent.trim() ?? null,
      'ytd-watch-metadata ytd-channel-name a': meta?.querySelector('ytd-channel-name a')?.textContent.trim() ?? null,
      '#related exists': Boolean(document.querySelector('ytd-watch-flexy #related')),
      'autoplay toggle aria-checked': document.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-checked') ?? null,
      'end-screen classes': [...new Set([...document.querySelectorAll('.html5-video-player [class*="endscreen"], .html5-video-player [class*="ytp-ce"]')]
        .map((e) => e.className.split(' ')[0]))].slice(0, 10),
      sidebar: (() => {
        const related = document.querySelector('#related');
        if (!related) return null;
        return Object.fromEntries(tags.map((t) => [t, related.querySelectorAll(t).length]).filter(([, n]) => n));
      })(),
    };
  }, CARD_TAGS), null, 2));
} finally {
  await context.close();
}
