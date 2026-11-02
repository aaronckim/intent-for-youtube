const $ = (id) => document.getElementById(id);

function renderSession(session) {
  $('session-idle').hidden = Boolean(session);
  $('session-active').hidden = !session;
  if (!session) return;
  $('active-intent').textContent = session.intent;
  const keywords = IntentMatch.parseIntent(session.intent, session.extra);
  $('active-keywords').textContent = `Matching: ${keywords.join(', ')}`;
  const since = new Date(session.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('active-since').textContent = `Since ${since}`;
}

// Opens the repo's "Something broken" issue form with the versions filled in. Nothing is sent
// unless the user submits the form, and the URL carries no browsing data.
function reportUrl() {
  const manifest = chrome.runtime.getManifest();
  const params = new URLSearchParams({
    template: 'broken.yml',
    'extension-version': manifest.version,
    'chrome-version': navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown',
  });
  return `${manifest.homepage_url}/issues/new?${params}`;
}

const switchFor = (setting) => document.querySelector(`[data-setting="${setting}"]`);

// Reflects the switches back into the page: the master switch, per-group counts, and
// greying out single left-menu entries while the whole menu is hidden.
function syncState() {
  const enabled = switchFor('enabled').checked;
  $('power-text').textContent = enabled ? 'On' : 'Off';
  $('paused').hidden = enabled;
  $('controls').inert = !enabled;
  document.body.classList.toggle('is-off', !enabled);

  for (const group of document.querySelectorAll('.group')) {
    const boxes = [...group.querySelectorAll('[data-setting]')];
    const on = boxes.filter((box) => box.checked).length;
    group.querySelector('.count').textContent = on ? `${on} of ${boxes.length}` : '';
  }
  for (const sub of document.querySelectorAll('[data-under]')) {
    const parentOn = switchFor(sub.dataset.under).checked;
    sub.classList.toggle('is-covered', parentOn);
    for (const box of sub.querySelectorAll('[data-setting]')) box.disabled = parentOn;
  }
}

function showHint(text) {
  $('intent-hint').textContent = text;
  $('intent-hint').hidden = !text;
}

async function init() {
  const [settings, session] = await Promise.all([loadSettings(), loadSession()]);
  $('report-link').href = reportUrl();

  for (const box of document.querySelectorAll('[data-setting]')) {
    box.checked = Boolean(settings[box.dataset.setting]);
    box.addEventListener('change', () => {
      chrome.storage.sync.set({ [box.dataset.setting]: box.checked });
      syncState();
    });
  }
  syncState();

  renderSession(session);
  if (!session) $('intent-input').focus();

  $('start-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const intent = $('intent-input').value.trim();
    const extra = $('extra-input').value.trim();
    if (!intent) return showHint('Type a topic first.');
    if (IntentMatch.parseIntent(intent, extra).length === 0) {
      return showHint('Add a specific topic word, like “calculus” or “React”.');
    }
    showHint('');
    const next = { intent, extra, startedAt: Date.now() };
    await chrome.storage.local.set({ session: next });
    renderSession(next);
  });

  $('end-button').addEventListener('click', async () => {
    await chrome.storage.local.remove('session');
    renderSession(null);
    $('intent-input').focus();
  });
}

init();
