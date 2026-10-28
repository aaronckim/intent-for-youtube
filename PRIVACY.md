# Privacy Policy: Intent: Focus Mode for YouTube

_Last updated: October 27, 2026_

Intent does not collect, sell, or share personal data. It has no accounts, no analytics, no tracking,
and makes no network requests of its own.

## What the extension handles, and where it stays

- **Your settings** (which elements to hide) are saved with `chrome.storage.sync`. If you are signed in
  to Chrome with sync turned on, Chrome copies them between your own devices; Google handles that sync
  under its own privacy policy. Intent's developer never receives them.
- **Your focus topic** is saved with `chrome.storage.local` on your device only.
- **Video titles and channel names** on YouTube pages are read inside your browser to compare them with
  your topic. This happens in memory, on your device, and is never stored or sent anywhere.

## Permissions

- `storage`: saves the settings and topic described above.
- Access to `www.youtube.com`: lets the extension hide page elements and compare titles on YouTube. It
  does not run on any other site.

## Changes

If this ever changes (for example, a paid tier that needs to check a license), this policy will be
updated before that version ships, and the change will be described in the release notes.

## Contact

Questions or concerns: open an issue at https://github.com/aaronckim/intent-for-youtube/issues.
The source code is public there, so anyone can check these claims.
