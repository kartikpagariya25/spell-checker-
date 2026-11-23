# Architecture

```
keystroke ──► content.js ──► text-utils ──► corrector ──► editors ──► feedback
 (input/keydown)   │         (which word?)   (what fix?)   (replace)   (highlight)
                   └── settings (prefs, learned words) ◄── popup / options / background
```

## Content script pipeline

1. **Trigger** (`content.js`). A word is finished when an `input` event delivers
   a delimiter (space, `, . ! ? ; : )`), on `keyup` of such a key (for editors
   that cancel `beforeinput`), or on `Enter` before a chat box submits.
2. **Locate the word** (`text-utils.js`). Takes the text before the caret and
   returns the last plain alphabetic token. URLs, emails, ids, hyphenated or
   digit-bearing tokens yield nothing.
3. **Guard rails** (`content.js`, `field-rules.js`, `editors.js`). Skip ALLCAPS,
   camelCase, capitalised words mid-sentence, password / email / number fields,
   `spellcheck="false"`, code editors and name/address-style fields.
4. **Decide** (`corrector.js`). Known words are never touched. Otherwise:
   overrides and the common-typo table first; then all one-edit candidates that
   are real words ranked by frequency x keyboard slip plausibility; then, for
   longer words, two-edit candidates. A winner must clearly beat the runner-up
   (the margin depends on the chosen sensitivity), else nothing happens.
5. **Replace** (`editors.js`). Selects the characters before the caret and calls
   `document.execCommand('insertText')`, so pages get real input events and the
   browser's undo stack stays intact.
6. **Undo** (`content.js`). The correction is remembered with its original text.
   Backspace immediately afterwards (caret right after the replaced text) swaps
   the original back, adds the word to `learned` and stops it being fixed again.
7. **Feedback** (`feedback.js`). CSS Custom Highlight on rich editors, a brief
   glow on plain fields.

## Optional steps in the pipeline

- **Context fixes** (`context-fixes.js`, off by default). Before the dictionary
  runs, the previous word is checked: modal + "of" becomes "have", an
  accidentally repeated word is removed (an empty replacement becomes a delete).
- **Lone "i"** is capitalised when the preference is on.
- **Browser undo.** `undoWatch` remembers the last fix for 15 seconds; an
  `input` event of type `historyUndo` that brings the original spelling back
  teaches SpellFix to leave that word alone.
- **Counters** (`stats.js`) are flushed together with the recent-fixes list every
  five seconds to avoid hammering storage.

## Smart mode (sentence pass, opt-in)

```
typing ─► content.js ─► smart-runner ─► (redact) ─► background.js ─► smart-client ─► provider
                          │  when: . ! ? / Enter / 1.5 s pause          │ key lives only here
                          └◄─ validate (smart-fix) ◄─ <fixed>…</fixed> ◄┘
                          └─► editors.replaceText (one edit, caret restored)
```

- `smart-fix.js` is pure: finds the sentence before the caret, flags suspected
  typos (words unknown to the dictionary and not kept by the user), redacts
  private-looking tokens, and **validates the answer** word by word (same word
  count, same punctuation and spacing, each change within 3 letters or a known
  confusable such as their/there).
- `smart-runner.js` decides when to ask, de-duplicates sentences, rate limits
  (12 per minute per page) and drops answers if the text changed meanwhile.
- `smart-client.js` builds provider requests, enforces timeouts and maps HTTP
  errors to messages without ever echoing the key. The service worker adds a
  second rate limit (30 per minute).
- Everything except the DOM edit and the fetch is covered by Node tests with a
  fake editor and a fake provider.

## Staying alive across tabs

- `start()` attaches all listeners synchronously and loads settings afterwards.
- `__spellFixLoaded` prevents double loading when the manifest and an on-demand
  injection both run in the same page.
- Every handler checks `chrome.runtime.id`; when the extension is reloaded the
  orphaned copy removes its listeners and a new copy can start.
- The script answers `spellfix-ping`; the background (`ensureInjected`) and the
  popup use it to find tabs where SpellFix isn't running and inject it with
  `chrome.scripting.executeScript`.
- `page-support.js` classifies URLs so the popup can explain pages that browsers
  never allow extensions on.

## Background worker (`background.js`)

Badge, `Alt+Shift+S`, right-click menu, optional sync of kept words
(`word-merge.js`), and the first-run page. In Chrome it is a service worker; the
Firefox build (`scripts/firefox-manifest.js`) lists it as an event page.

## Data

| File | Purpose |
| --- | --- |
| `src/dictionary-data.js` | Generated 45k-word list, most frequent first (index = rank) |
| `src/common-typos.js` | Hand-curated misspelling -> fix table |
| `scripts/*.txt` | Inputs to the dictionary build |

## Extension surfaces

- `popup/` - toggles, recent fixes, kept words
- `options/` - preferences and backup
- `src/background.js` - badge, shortcut, welcome page
- `welcome/` - first-run page

All state lives in `chrome.storage.local` (`src/settings.js`).
