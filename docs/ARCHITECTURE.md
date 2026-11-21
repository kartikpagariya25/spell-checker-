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
