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

function showHint(text) {
  $('intent-hint').textContent = text;
  $('intent-hint').hidden = !text;
}

async function init() {
  const [settings, session] = await Promise.all([loadSettings(), loadSession()]);

  for (const box of document.querySelectorAll('[data-setting]')) {
    box.checked = Boolean(settings[box.dataset.setting]);
    box.addEventListener('change', () => chrome.storage.sync.set({ [box.dataset.setting]: box.checked }));
  }

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
