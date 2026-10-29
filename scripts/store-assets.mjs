// Generates Chrome Web Store images into store/: four 1280x800 screenshots framed with a headline,
// and the 440x280 small promo tile. Captures live YouTube with the extension loaded.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(here, '../extension');
const outDir = path.resolve(here, '../store');
mkdirSync(outDir, { recursive: true });

const INTENT = 'React hooks';
const BG = '#17191a';
const TEAL = '#7cc4bd';

function unpackedExtensionId(dir) {
  const hex = createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

const dataUrl = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;
const iconUrl = dataUrl(readFileSync(path.join(extensionDir, 'icons/icon128.png')));

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 800px; overflow: hidden; background: ${BG}; color: #eef1f0;
         font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif; }
  h1 { font-size: 40px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
  h1 em { font-style: normal; color: ${TEAL}; }
  .shot { border-radius: 14px; box-shadow: 0 30px 80px rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.08); }
`;

function framedHtml(headline, shot) {
  return `<style>${BASE_CSS}
    body { display: flex; flex-direction: column; align-items: center; padding-top: 44px; }
    h1 { margin-bottom: 36px; text-align: center; }
    .shot { width: 1040px; height: 650px; object-fit: cover; object-position: top; }
  </style><h1>${headline}</h1><img class="shot" src="${shot}">`;
}

function popupHtml(headline, sub, shot) {
  return `<style>${BASE_CSS}
    body { display: flex; align-items: center; justify-content: center; gap: 96px; }
    .copy { width: 480px; }
    h1 { font-size: 52px; margin-bottom: 20px; }
    p { font-size: 22px; line-height: 1.45; color: #aab3b2; }
    .shot { width: 340px; }
  </style><div class="copy"><h1>${headline}</h1><p>${sub}</p></div><img class="shot" src="${shot}">`;
}

const tileHtml = `<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 440px; height: 280px; overflow: hidden; background: ${BG}; color: #eef1f0;
         font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 0 40px; }
  .row { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  img { width: 56px; height: 56px; }
  .name { font-size: 40px; font-weight: 700; letter-spacing: -0.02em; }
  p { font-size: 22px; line-height: 1.3; color: #aab3b2; }
  em { font-style: normal; color: ${TEAL}; }
</style><div class="row"><img src="${iconUrl}"><span class="name">Intent</span></div>
<p>Use YouTube for <em>what you came for.</em></p>`;

async function render(context, html, file, size = { width: 1280, height: 800 }) {
  const page = await context.newPage();
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: 'load' });
  // Captures are 2x for sharpness; the store wants exact CSS-pixel sizes.
  await page.screenshot({ path: path.join(outDir, file), scale: 'css' });
  await page.close();
  console.log(`store/${file}`);
}

const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'intent-assets-')), {
  channel: 'chromium',
  headless: !process.env.HEADED,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: 'en-US',
  args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
});

try {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 600 }); // Chrome caps popups at 600px tall
  await popup.goto(`chrome-extension://${unpackedExtensionId(extensionDir)}/popup/popup.html`);
  await popup.fill('#intent-input', INTENT);
  await popup.click('button[type="submit"]');
  await popup.waitForSelector('#session-active:not([hidden])');
  const popupShot = await popup.screenshot();

  const yt = context.pages()[0];
  await yt.bringToFront();

  // Mixed results: search pages come back all on- or all off-topic, but a watch page's sidebar mixes both.
  // The sidebar is hidden by default, so show it just for this shot.
  await popup.uncheck('[data-setting="hideSidebar"]');
  await yt.goto('https://www.youtube.com/watch?v=xfKYYRE6-TQ', { waitUntil: 'domcontentloaded' });
  await yt.waitForSelector('#related yt-lockup-view-model.intent-offtopic', { timeout: 20000 });
  await yt.waitForTimeout(3000);
  const searchShot = await yt.screenshot();
  await popup.check('[data-setting="hideSidebar"]');

  // Friction screen on an off-topic video, opened in-page from search results.
  await yt.goto('https://www.youtube.com/results?search_query=funny+cat+videos', { waitUntil: 'domcontentloaded' });
  await yt.waitForSelector('ytd-video-renderer.intent-offtopic', { timeout: 20000 });
  const card = await yt.locator('ytd-video-renderer.intent-offtopic').first().elementHandle();
  await (await card.$('.intent-badge')).click();
  await (await card.$('a#video-title')).click();
  await yt.waitForSelector('.intent-gate', { timeout: 15000 });
  await yt.waitForTimeout(1500);
  const gateShot = await yt.screenshot();

  // A clean on-topic watch page: no sidebar, no Shorts, no autoplay.
  await yt.goto('https://www.youtube.com/watch?v=LOH1l-MP_9k', { waitUntil: 'domcontentloaded' });
  await yt.waitForSelector('ytd-watch-metadata h1', { timeout: 20000 });
  await yt.waitForTimeout(5000);
  const watchShot = await yt.screenshot();

  await render(context, framedHtml('Tell it what you came for. <em>Everything else fades.</em>', dataUrl(searchShot)), 'screenshot-1-fade.png');
  await render(context, framedHtml('A pause <em>before</em> the rabbit hole.', dataUrl(gateShot)), 'screenshot-2-pause.png');
  await render(context, framedHtml('No Shorts. No sidebar. <em>No autoplay.</em>', dataUrl(watchShot)), 'screenshot-3-clean.png');
  await render(context, popupHtml('Set your focus <em>in two seconds.</em>',
    'Type a topic, start a session, and YouTube stays on track. Open source, runs on your device, sends nothing anywhere.',
    dataUrl(popupShot)), 'screenshot-4-popup.png');
  await render(context, tileHtml, 'promo-small-440x280.png', { width: 440, height: 280 });
} finally {
  await context.close();
}
