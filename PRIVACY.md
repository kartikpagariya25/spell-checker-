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
  read the current tab's hostname so you can disable SpellFix for that site;
  `scripting` with all-sites access lets SpellFix start in tabs that were
  already open (it injects only its own bundled scripts, never remote code);
  `contextMenus` adds the right-click entries "never fix this word" and
  "turn off for this site".
- **Optional sync.** If you switch on "Sync kept words", only the list of words
  you chose to keep is stored in your browser's own sync storage (Chrome /
  Firefox account sync). It is off by default and never includes what you type.
- **Daily counts.** The popup's "fixed this week" uses a per-day counter kept
  for about a month; it holds numbers only, no text.
- **Your control.** Clear the learned words and recent fixes from the popup, or
  remove the extension to delete everything it stored.

If this ever changes, this file and the changelog will say so.
