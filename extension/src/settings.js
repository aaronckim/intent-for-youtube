// Shared by the content script and the popup.
// Toggles live in chrome.storage.sync; the active focus session lives in chrome.storage.local.

const INTENT_DEFAULTS = Object.freeze({
  enabled: true, // master switch: off leaves YouTube untouched without losing the choices below

  // Feeds
  hideHomeFeed: true,
  hideShorts: true,
  // Video page
  hideSidebar: true,
  hideEndScreen: true,
  disableAutoplay: true,
  // Left menu ("guide")
  hideGuide: false,
  hideGuideHome: false,
  hideGuideShorts: true,
  hideGuideSubscriptions: false,
  hideGuideYou: false,
  hideGuideHistory: false,
  hideGuideExplore: false,
  hideGuideMoreFromYouTube: false,
  hideGuideSettings: false,
  hideGuideFooter: false,
  // Top bar ("masthead")
  hideTopMenuButton: false,
  hideTopLogo: false,
  hideTopVoiceSearch: false,
  hideTopCreate: false,
  hideTopNotifications: false,

  // During a focus session
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
