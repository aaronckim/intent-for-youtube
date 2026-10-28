// Shared by the content script and the popup.
// Toggles live in chrome.storage.sync; the active focus session lives in chrome.storage.local.

const INTENT_DEFAULTS = Object.freeze({
  hideHomeFeed: true,
  hideShorts: true,
  hideSidebar: true,
  hideEndScreen: true,
  disableAutoplay: true,
  blurOffTopic: true,
  frictionScreen: true,
  frictionSeconds: 10,
});

function loadSettings() {
  return chrome.storage.sync.get(INTENT_DEFAULTS);
}

async function loadSession() {
  const { session } = await chrome.storage.local.get('session');
  return session || null;
}
