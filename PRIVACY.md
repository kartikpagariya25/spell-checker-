# Privacy

SpellFix is built to be boring about your data.

- **Nothing you type leaves your browser.** Spelling is checked entirely on your
  device against a dictionary bundled with the extension. There are no servers,
  no analytics, no tracking and no network requests.
- **What is stored** (in `chrome.storage.local`, on your device only):
  your on/off setting, sites you turned it off for, the words you chose to keep
  by pressing Backspace after a fix, your preferences, a count of fixes, and the
  last ten corrections shown in the popup (the misspelt word, its fix and the
  site's hostname).
- **Where it runs.** The content script runs on all pages so it can fix typos
  anywhere you type. It never reads password, email, number, URL, name or address
  fields, and ignores code editors.
- **Permissions.** `storage` keeps your settings; `activeTab` lets the popup
  read the current tab's hostname so you can disable SpellFix for that site.
- **Your control.** Clear the learned words and recent fixes from the popup, or
  remove the extension to delete everything it stored.

If this ever changes, this file and the changelog will say so.
