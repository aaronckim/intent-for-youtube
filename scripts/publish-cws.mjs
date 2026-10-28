// Uploads a zip to an existing Chrome Web Store item and submits it for review (Chrome Web Store API v2).
// Auth: a service account linked in the Developer Dashboard. Its JSON key signs a JWT that is exchanged
// for an access token, so no gcloud or extra IAM roles are needed.
//
// Env: CWS_SERVICE_ACCOUNT_KEY (the key file's JSON), CWS_PUBLISHER_ID, CWS_EXTENSION_ID.
// Usage: node scripts/publish-cws.mjs dist/intent-0.1.1.zip

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;
const zipPath = process.argv[2];

if (!CWS_SERVICE_ACCOUNT_KEY || !CWS_PUBLISHER_ID || !CWS_EXTENSION_ID) {
  console.log('::notice::Chrome Web Store secrets are not set; skipping store submission.');
  process.exit(0);
}

const API = 'https://chromewebstore.googleapis.com';
const item = `publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`;
const base64url = (value) => Buffer.from(value).toString('base64url');

async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(method, url, token, body) {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

const uploadState = (response) => response.uploadState || response.lastAsyncUploadState || '';

const token = await accessToken(JSON.parse(CWS_SERVICE_ACCOUNT_KEY));

let upload = await call('POST', `${API}/upload/v2/${item}:upload`, token, readFileSync(zipPath));
console.log('Upload:', JSON.stringify(upload));
for (let i = 0; i < 20 && /IN_PROGRESS/.test(uploadState(upload)); i++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  upload = await call('GET', `${API}/v2/${item}:fetchStatus`, token);
  console.log('Upload status:', JSON.stringify(upload));
}
if (/FAIL|IN_PROGRESS/.test(uploadState(upload))) {
  throw new Error(`Upload did not succeed: ${JSON.stringify(upload)}`);
}

const published = await call('POST', `${API}/v2/${item}:publish`, token);
console.log('Submitted for review:', JSON.stringify(published));
