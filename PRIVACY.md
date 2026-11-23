# Privacy

SpellFix is built to be boring about your data.

- **By default, nothing you type leaves your browser.** Spelling is checked
  entirely on your device against a dictionary bundled with the extension. There
  are no SpellFix servers, no analytics, no tracking and no network requests.
  The one exception is **Smart mode**, which is off until you turn it on (see
  below).
- **Smart mode (optional, off by default).** If you add your own API key for
  Anthropic, OpenAI, xAI (Grok) or Groq and switch Smart mode on, SpellFix sends the *sentence you
  just wrote* directly from your browser to **that provider** so an AI can fix
  spelling using the whole sentence. SpellFix has no servers and never sees it.
  - Only sentences that still contain a word SpellFix does not recognise are sent.
    Sentences with nothing suspicious stay on your device.
  - Before sending, emails, links, @mentions, #tags, phone / card / id-like
    numbers and long key-like strings are replaced by placeholders and put back
    afterwards.
  - Passwords, email / number / URL fields, name / address / phone / username
    fields, code editors and `spellcheck="false"` fields are never read.
  - The AI's answer is checked: any rewording is discarded; only spelling-sized
    word changes are applied.
  - The provider handles the text under its own terms and privacy policy.
    Usage is billed to your own account with them.
  - Your API key is stored in `chrome.storage.local` on this device, is used only
    by the extension's background worker, is never put in the backup file, never
    shown in error messages, and is sent only to the provider you selected.
    Removing the key in Settings deletes it and turns Smart mode off.
- **What is stored** (in `chrome.storage.local`, on your device only):
  your on/off setting, sites you turned it off for, the words you chose to keep
  by pressing Backspace after a fix, your preferences, a count of fixes, and the
  last ten corrections shown in the popup (the misspelt word, its fix and the
  site's hostname).
- **Ctrl+Space "polish" (optional, needs your own API key).** When you press
  Ctrl+Space, SpellFix sends **only the text you selected, or the paragraph / box
  you are in (up to 4000 characters)** to the AI provider you chose, to fix
  grammar and sentence structure. It happens only on that key press, the same
  redaction of emails, links, numbers and key-like strings applies, password /
  name / address / code fields are excluded, and the answer is checked before it
  replaces anything. It can be switched off in Settings.
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
