# Store listing (Chrome Web Store / Firefox Add-ons)

Copy-paste material for publishing. Build the upload packages with:

```
npm run zip      # dist/spellfix-<version>.zip and dist/spellfix-firefox-<version>.zip
```

## Name
SpellFix - Silent Auto-Correct

## Short description (132 chars max)
Fixes spelling mistakes as you type on any website. Press Backspace to keep your own spelling. Private, offline, no account.

## Detailed description
Type fast, make typos, and let them fix themselves.

SpellFix watches what you type in text boxes on any website - email, chat, forms,
AI prompts - and silently corrects a misspelled word the moment you finish it.
No popups, no clicking.

- Fixes spelling only: it never rewrites sentences or changes your tone
- Backspace right after a fix keeps your original spelling and remembers it
- Works in inputs, text areas and rich editors
- Private: runs entirely on your device with a bundled dictionary; nothing you
  type is ever sent anywhere
- Leaves passwords, emails, numbers, names, addresses, code editors and
  ALLCAPS / camelCase words alone
- Settings: careful / balanced / eager, Enter-to-fix, optional extras
  ("could of" -> "could have", lone "i" -> "I"), backup and sync of kept words
- Shortcut: Alt+Shift+S turns it on or off

## Category
Productivity

## Permission justifications
| Permission | Why |
| --- | --- |
| Content script on all sites | Typos can happen in any text box, so the script must run wherever you type. It only reads the word you just finished and only inside editable fields. |
| `storage` | Saves your settings, kept words and counters on your device (and, if you opt in, in your browser's own sync storage). |
| `activeTab` | Lets the popup read the current site's hostname for the per-site on/off switch. |
| `contextMenus` | Adds "never fix this word" and "turn off for this site" to the right-click menu. |

## Single purpose statement
Automatically correct spelling mistakes in the text the user types.

## Data handling disclosure
- No data is collected, transmitted, sold or shared.
- No remote code. No analytics.
- Privacy policy: see `PRIVACY.md` in the repository.

## Screenshots to prepare (1280x800)
1. A chat box mid-sentence with a fix and the green highlight
2. The popup showing "fixed this week" and recent fixes
3. The settings page
4. Before / after of an email draft
