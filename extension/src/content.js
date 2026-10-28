// Runs on www.youtube.com. Hides distractions by toggling classes on <html> (rules in content.css),
// and during a focus session fades off-topic video cards and gates off-topic watch pages.
// Everything here is DOM work on the page itself; nothing is sent anywhere.

(() => {
  const root = document.documentElement;

  const TOGGLE_CLASSES = {
    hideHomeFeed: 'intent-hide-home',
    hideShorts: 'intent-hide-shorts',
    hideSidebar: 'intent-hide-sidebar',
    hideEndScreen: 'intent-hide-endscreen',
  };

  // Innermost element of each kind of video card YouTube renders (search, grid, sidebar, Shorts).
  const CARD_SELECTOR = [
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-rich-grid-media',
    'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model',
  ].join(', ');

  let settings = { ...INTENT_DEFAULTS };
  let session = null;
  let keywords = [];
  const revealedTitles = new Set();
  const allowedVideos = new Set();

  // ---- settings & session -------------------------------------------------

  function applyClasses() {
    for (const [key, cls] of Object.entries(TOGGLE_CLASSES)) root.classList.toggle(cls, Boolean(settings[key]));
    root.classList.toggle('intent-session', Boolean(session));
  }

  function setSession(next) {
    const changed = JSON.stringify(next) !== JSON.stringify(session);
    session = next;
    keywords = session ? IntentMatch.parseIntent(session.intent, session.extra) : [];
    if (!changed) return;
    revealedTitles.clear();
    allowedVideos.clear();
    for (const card of document.querySelectorAll('[data-intent-title]')) {
      delete card.dataset.intentTitle;
      delete card.dataset.intentOff;
      setOffTopic(card, false);
    }
  }

  function refresh() {
    applyClasses();
    scanCards();
    lastUrl = '';
    onNavigate();
  }

  Promise.all([loadSettings(), loadSession()]).then(([loaded, stored]) => {
    settings = loaded;
    setSession(stored);
    refresh();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? INTENT_DEFAULTS[key];
    }
    if (area === 'local' && 'session' in changes) setSession(changes.session.newValue || null);
    refresh();
  });

  // ---- off-topic cards ----------------------------------------------------

  function filteringCards() {
    return Boolean(session && settings.blurOffTopic && keywords.length);
  }

  function cardTitle(card) {
    const legacy = card.querySelector('#video-title');
    if (legacy) return (legacy.getAttribute('title') || legacy.textContent).trim();
    const heading = card.querySelector('h3[title]');
    if (heading) return heading.getAttribute('title').trim();
    const link = card.querySelector('.ytLockupMetadataViewModelTitle, h3');
    return link ? link.textContent.trim() : '';
  }

  function cardChannel(card) {
    const el = card.querySelector('ytd-channel-name #text, .ytContentMetadataViewModelMetadataText');
    return el ? el.textContent.trim() : '';
  }

  function isAd(card) {
    return Boolean(
      card.closest('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer') ||
      card.querySelector('a[href*="googleadservices"]')
    );
  }

  function setOffTopic(card, off) {
    card.classList.toggle('intent-offtopic', off);
    const badge = card.querySelector(':scope > .intent-badge');
    if (off && !badge) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'intent-badge';
      button.textContent = 'Off-topic · show anyway';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        revealedTitles.add(card.dataset.intentTitle);
        card.dataset.intentOff = 'false';
        setOffTopic(card, false);
      });
      card.appendChild(button);
    } else if (!off && badge) {
      badge.remove();
    }
  }

  function scanCards() {
    if (!filteringCards()) {
      for (const card of document.querySelectorAll('.intent-offtopic')) setOffTopic(card, false);
      return;
    }
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      if (card.querySelector(CARD_SELECTOR) || isAd(card)) continue;
      const title = cardTitle(card);
      if (!title) continue;
      // YouTube recycles card elements, so re-evaluate whenever the title changes.
      if (card.dataset.intentTitle !== title) {
        card.dataset.intentTitle = title;
        const onTopic = revealedTitles.has(title) || IntentMatch.isOnTopic(keywords, `${title} ${cardChannel(card)}`);
        card.dataset.intentOff = String(!onTopic);
      }
      setOffTopic(card, card.dataset.intentOff === 'true');
    }
  }

  let scanTimer = 0;
  new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scanCards();
    }, 150);
  }).observe(root, { childList: true, subtree: true });

  // ---- navigation ---------------------------------------------------------

  let lastUrl = '';

  function onNavigate() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (redirectShorts()) return;
    checkWatchPage();
    turnOffAutoplay();
  }

  document.addEventListener('yt-navigate-finish', onNavigate);
  window.addEventListener('popstate', onNavigate);
  setInterval(onNavigate, 1000); // catches navigations YouTube doesn't announce

  // Shorts open as regular videos: no infinite swipe feed, and the friction screen still applies.
  function redirectShorts() {
    const match = location.pathname.match(/^\/shorts\/([\w-]+)/);
    if (!match || !(settings.hideShorts || session)) return false;
    location.replace(`/watch?v=${match[1]}`);
    return true;
  }

  function turnOffAutoplay() {
    if (!settings.disableAutoplay || location.pathname !== '/watch') return;
    let tries = 0;
    const timer = setInterval(() => {
      const on = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (on) {
        (on.closest('button') || on).click();
        clearInterval(timer);
      } else if (document.querySelector('.ytp-autonav-toggle-button') || ++tries > 20) {
        clearInterval(timer);
      }
    }, 500);
  }

  // ---- friction screen ----------------------------------------------------

  let gate = null; // { videoId, overlay, timer }
  let checkToken = 0;

  function currentVideoId() {
    return location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;
  }

  // After an in-page navigation the title still shows the previous video for a moment;
  // ytd-watch-metadata's video-id attribute flips in the same frame as its title.
  function readVideoInfo(videoId) {
    const meta = document.querySelector('ytd-watch-metadata');
    if (!meta || meta.getAttribute('video-id') !== videoId) return null;
    const title = meta.querySelector('h1')?.textContent.trim();
    if (!title) return null;
    const channel = meta.querySelector('ytd-channel-name a')?.textContent.trim() || '';
    return { videoId, title, channel };
  }

  function waitForVideoInfo(videoId) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const poll = () => {
        const info = readVideoInfo(videoId);
        if (info) resolve(info);
        else if (Date.now() - startedAt > 8000) resolve(null); // can't read the page: fail open
        else setTimeout(poll, 150);
      };
      poll();
    });
  }

  async function checkWatchPage() {
    const videoId = currentVideoId();
    if (gate && gate.videoId !== videoId) closeGate();
    if (!videoId || !session || !settings.frictionScreen || !keywords.length) {
      closeGate();
      return;
    }
    if (allowedVideos.has(videoId) || gate) return;
    const token = ++checkToken;
    const info = await waitForVideoInfo(videoId);
    if (token !== checkToken || !info || currentVideoId() !== videoId) return;
    if (!IntentMatch.isOnTopic(keywords, `${info.title} ${info.channel}`)) openGate(info);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function mainVideo() {
    return document.querySelector('#movie_player video') || document.querySelector('video');
  }

  function openGate(info) {
    const overlay = el('div', 'intent-gate');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'intent-gate-heading');

    const card = el('div', 'intent-gate__card');
    card.append(el('p', 'intent-gate__eyebrow', 'You came for'));
    const heading = el('h2', 'intent-gate__intent', session.intent);
    heading.id = 'intent-gate-heading';
    card.append(heading);
    card.append(el('p', 'intent-gate__lede', "This video doesn't look related:"));
    const quote = el('div', 'intent-gate__video');
    quote.append(el('div', 'intent-gate__title', info.title));
    if (info.channel) quote.append(el('div', 'intent-gate__channel', info.channel));
    card.append(quote);

    const actions = el('div', 'intent-gate__actions');
    const back = el('button', 'intent-gate__primary', `Search “${session.intent}” instead`);
    back.type = 'button';
    back.addEventListener('click', () => {
      location.assign(`/results?search_query=${encodeURIComponent(session.intent)}`);
    });
    const anyway = el('button', 'intent-gate__secondary');
    anyway.type = 'button';
    anyway.disabled = true;
    anyway.addEventListener('click', () => {
      allowedVideos.add(info.videoId);
      closeGate();
      mainVideo()?.play().catch(() => {});
    });
    actions.append(back, anyway);
    card.append(actions);
    overlay.append(card);
    (document.body || root).append(overlay);

    let remaining = Math.max(0, Number(settings.frictionSeconds) || 0);
    const tick = () => {
      anyway.textContent = remaining > 0 ? `Watch anyway (${remaining})` : 'Watch anyway';
      anyway.disabled = remaining > 0;
      if (remaining <= 0) clearInterval(gate.timer);
      remaining -= 1;
    };
    gate = { videoId: info.videoId, overlay, timer: setInterval(tick, 1000) };
    tick();
    mainVideo()?.pause();
    back.focus();
  }

  function closeGate() {
    if (!gate) return;
    clearInterval(gate.timer);
    gate.overlay.remove();
    gate = null;
  }

  // Media events don't bubble, but they do pass through capture listeners on the document.
  document.addEventListener('play', (event) => {
    if (gate && event.target instanceof HTMLVideoElement) event.target.pause();
  }, true);
})();
