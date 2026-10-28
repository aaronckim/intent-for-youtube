// Keyword matching for intent mode (the free tier; the Pro tier swaps in on-device AI).
// Lenient on purpose: letting a related video through is cheaper than gating one the user needs.
// Loaded as a plain script in the extension and as a CommonJS module in tests.

(function (root) {
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'about', 'from',
    'by', 'into', 'is', 'are', 'be', 'do', 'does', 'how', 'what', 'why', 'when', 'which', 'who',
    'i', 'im', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that', 'some', 'more',
    'want', 'wanna', 'need', 'here', 'get', 'better', 'just', 'only', 'really',
    'learn', 'learning', 'study', 'studying', 'watch', 'watching', 'video', 'videos',
    'tutorial', 'tutorials', 'guide', 'guides', 'course', 'courses', 'lesson', 'lessons',
    'intro', 'introduction', 'beginner', 'beginners', 'basics', 'explained', 'tips',
  ]);

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '');
  }

  // Keeps + and # so "c++" and "c#" survive as tokens.
  function tokenize(text) {
    return normalize(text).split(/[^\p{L}\p{N}+#]+/u).filter(Boolean);
  }

  // Crude suffix stripping so "hooks"/"hook" and "coding"/"code" meet in the middle.
  function stem(word) {
    if (word.length <= 3) return word;
    let w = word;
    if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
    else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
    else if (/(s|x|z|ch|sh)es$/.test(w) && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
    return w;
  }

  function isMeaningful(token) {
    return token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token);
  }

  // Returns the unique keyword stems for an intent plus optional comma-separated extras.
  function parseIntent(intent, extra) {
    const tokens = [...tokenize(intent), ...tokenize(extra)].filter(isMeaningful);
    return [...new Set(tokens.map(stem))];
  }

  function stemsMatch(a, b) {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 4 && long.startsWith(short);
  }

  // True when any keyword appears in the text. No keywords means no filter (fail open).
  // Adjacent tokens are also tried joined, so "Node.js" and "React JS" meet "nodejs" and "reactjs".
  function isOnTopic(keywords, text) {
    if (!keywords || keywords.length === 0) return true;
    const tokens = tokenize(text);
    const joined = tokens.slice(1).map((token, i) => tokens[i] + token);
    const stems = [...tokens, ...joined].map(stem);
    return keywords.some((k) => stems.some((s) => stemsMatch(k, s)));
  }

  const api = { tokenize, stem, parseIntent, isOnTopic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntentMatch = api;
})(globalThis);
