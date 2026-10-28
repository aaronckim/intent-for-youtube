// End-to-end check against live YouTube: loads the unpacked extension into Playwright's Chromium,
// drives the popup, and verifies hiding, card fading, the friction screen and the Shorts redirect.
// Screenshots land in test-results/. Run headed with HEADED=1.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Real path: Chrome derives the extension ID from it, and macOS temp dirs sit behind a /var symlink.
const extensionDir = realpathSync(path.resolve(process.env.EXTENSION_DIR || path.join(here, '../extension')));
const outDir = path.resolve(here, '../test-results');
mkdirSync(outDir, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? `  (${detail})` : ''}`);
}

// Chrome derives an unpacked extension's ID from its absolute path.
function unpackedExtensionId(dir) {
  const hex = createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

async function cardStats(page) {
  return page.evaluate(() => ({
    evaluated: document.querySelectorAll('[data-intent-title]').length,
    off: document.querySelectorAll('.intent-offtopic').length,
  }));
}

async function search(page, query) {
  await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('ytd-video-renderer', { timeout: 20000 });
  await page.waitForTimeout(2500);
}

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'intent-e2e-')), {
  channel: 'chromium',
  headless: !process.env.HEADED,
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
  args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
});

try {
  const extensionId = unpackedExtensionId(extensionDir);
  const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;

  // ---- popup: start a session -------------------------------------------
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 600 });
  await popup.goto(popupUrl);
  await popup.waitForSelector('#intent-input');
  await popup.screenshot({ path: `${outDir}/01-popup-idle.png`, fullPage: true });
  await popup.fill('#intent-input', 'React hooks');
  await popup.click('button[type="submit"]');
  await popup.waitForSelector('#session-active:not([hidden])');
  const stored = await popup.evaluate(() => chrome.storage.local.get('session'));
  check('popup starts a session', stored.session?.intent === 'React hooks');
  check('popup shows parsed keywords', (await popup.textContent('#active-keywords')).includes('react, hook'));
  await popup.screenshot({ path: `${outDir}/02-popup-active.png`, fullPage: true });

  // ---- on-topic search ---------------------------------------------------
  const yt = context.pages()[0];
  await yt.bringToFront();
  await search(yt, 'react hooks');
  const htmlClasses = await yt.evaluate(() => document.documentElement.className);
  check('hide classes applied to <html>', ['intent-hide-shorts', 'intent-hide-sidebar', 'intent-session'].every((c) => htmlClasses.includes(c)), htmlClasses);
  const onTopic = await cardStats(yt);
  check('on-topic search mostly unfaded', onTopic.evaluated >= 5 && onTopic.off / onTopic.evaluated <= 0.3, `${onTopic.off}/${onTopic.evaluated} faded`);
  const shorts = await yt.evaluate(() => [...document.querySelectorAll('grid-shelf-view-model, ytd-reel-shelf-renderer')]
    .map((s) => getComputedStyle(s).display));
  check('Shorts shelves hidden', shorts.every((d) => d === 'none'), `${shorts.length} shelves`);
  const shortHref = await yt.evaluate(() => document.querySelector('a[href^="/shorts/"]')?.getAttribute('href'));
  const onTopicHref = await yt.evaluate(() => document.querySelector('ytd-video-renderer:not(.intent-offtopic) a#video-title')?.getAttribute('href'));
  await yt.screenshot({ path: `${outDir}/03-search-on-topic.png` });

  // ---- off-topic search --------------------------------------------------
  await search(yt, 'funny cat videos');
  const offTopic = await cardStats(yt);
  check('off-topic search mostly faded', offTopic.evaluated >= 5 && offTopic.off / offTopic.evaluated >= 0.7, `${offTopic.off}/${offTopic.evaluated} faded`);
  await yt.screenshot({ path: `${outDir}/04-search-off-topic.png` });

  // ---- reveal a card, then open it (SPA navigation) -> friction screen ---
  // A handle, not a locator: once revealed, the card no longer matches .intent-offtopic.
  const firstOff = await yt.locator('ytd-video-renderer.intent-offtopic').first().elementHandle();
  await (await firstOff.$('.intent-badge')).click();
  check('"show anyway" reveals the card', !(await firstOff.evaluate((c) => c.classList.contains('intent-offtopic'))));
  await (await firstOff.$('a#video-title')).click();
  const gate = yt.locator('.intent-gate');
  await gate.waitFor({ timeout: 15000 }).catch(() => {});
  check('friction screen appears on off-topic video', await gate.isVisible());
  await yt.waitForTimeout(1500);
  const paused = await yt.evaluate(() => document.querySelector('#movie_player video')?.paused ?? null);
  check('video held paused behind the screen', paused !== false, `paused=${paused}`);
  const anyway = gate.locator('.intent-gate__secondary');
  check('"Watch anyway" starts disabled', await anyway.isDisabled(), await anyway.textContent());
  await yt.screenshot({ path: `${outDir}/05-friction-screen.png` });
  await anyway.waitFor({ state: 'visible' });
  await yt.waitForFunction(() => !document.querySelector('.intent-gate__secondary')?.disabled, null, { timeout: 15000 });
  await anyway.click();
  check('"Watch anyway" dismisses the screen', (await gate.count()) === 0);

  // ---- video -> video in-page navigation names the new video, not the old one ----
  await popup.uncheck('[data-setting="hideSidebar"]');
  await yt.waitForSelector('#related yt-lockup-view-model.intent-offtopic', { timeout: 15000 });
  const sideCard = await yt.locator('#related yt-lockup-view-model.intent-offtopic').first().elementHandle();
  const sideTitle = await sideCard.evaluate((c) => c.querySelector('h3[title]')?.getAttribute('title'));
  await (await sideCard.$('.intent-badge')).click();
  await (await sideCard.$('a.ytLockupMetadataViewModelTitle')).click();
  await gate.waitFor({ timeout: 15000 }).catch(() => {});
  const gateTitle = (await gate.locator('.intent-gate__title').textContent().catch(() => '')) || '';
  const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();
  check('gate names the newly opened video', squash(gateTitle) === squash(sideTitle), squash(gateTitle).slice(0, 50));
  await popup.check('[data-setting="hideSidebar"]');

  // ---- on-topic watch page -----------------------------------------------
  await yt.goto(`https://www.youtube.com${onTopicHref}`, { waitUntil: 'domcontentloaded' });
  await yt.waitForSelector('ytd-watch-metadata h1', { timeout: 20000 });
  await yt.waitForTimeout(5000);
  check('no friction screen on on-topic video', (await yt.locator('.intent-gate').count()) === 0);
  const relatedDisplay = await yt.evaluate(() => {
    const el = document.querySelector('ytd-watch-flexy #related');
    return el ? getComputedStyle(el).display : 'missing';
  });
  check('sidebar recommendations hidden', relatedDisplay === 'none' || relatedDisplay === 'missing', relatedDisplay);
  const autoplay = await yt.evaluate(() => document.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-checked'));
  check('autoplay turned off', autoplay === 'false' || autoplay == null, `aria-checked=${autoplay}`);
  await yt.screenshot({ path: `${outDir}/06-watch-on-topic.png` });

  // ---- Shorts redirect ---------------------------------------------------
  if (shortHref) {
    await yt.goto(`https://www.youtube.com${shortHref}`, { waitUntil: 'domcontentloaded' });
    await yt.waitForURL(/\/watch\?v=/, { timeout: 15000 }).catch(() => {});
    check('Shorts open as a regular video', yt.url().includes(`/watch?v=${shortHref.split('/').pop()}`), yt.url());
  } else {
    check('Shorts open as a regular video', true, 'skipped: no Shorts link on the page');
  }

  // ---- live updates from the popup ---------------------------------------
  await search(yt, 'funny cat videos');
  await popup.click('#end-button');
  await yt.waitForTimeout(800);
  check('ending the session unfades cards live', (await cardStats(yt)).off === 0);
  await popup.uncheck('[data-setting="hideShorts"]');
  await yt.waitForTimeout(500);
  check('toggling Shorts off applies live', !(await yt.evaluate(() => document.documentElement.classList.contains('intent-hide-shorts'))));
  await popup.check('[data-setting="hideShorts"]');
} catch (error) {
  check('run completed without errors', false, error.message.split('\n')[0]);
} finally {
  await context.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${outDir}`);
process.exit(failed ? 1 : 0);
