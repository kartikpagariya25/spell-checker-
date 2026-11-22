# Changelog

## 0.3.0

### Added
- Opt-in context fixes: "could of" -> "could have", doubled words, lone "i" -> "I".
- Optional hint bubble (`teh -> the`) after each fix.
- Ctrl+Z after a fix is treated like Backspace and the word is remembered.
- Right-click menu: "never fix this word" and "turn off / on for this site".
- Optional sync of kept words through the browser account.
- "Fixed this week" counter in the popup.
- Firefox build (`dist/spellfix-firefox`) and upload-ready zips (`npm run zip`).
- Store listing text with permission justifications.

### Improved
- 79-word second typo corpus, performance budgets, chat-syntax guard tests.
- Ten more frequent misspellings handled explicitly.

### Tooling
- Dependency-free ZIP writer; CI now builds both store packages.

## 0.2.0

### Added
- Preferences page: sensitivity (careful / balanced / eager), Enter-to-fix,
  highlight, search boxes, sentence-start capitals.
- Backup: export and import kept words, disabled sites and sensitivity.
- Popup now lists recently fixed words and links to settings.
- Keyboard shortcut `Alt+Shift+S` to toggle SpellFix, with an `OFF` toolbar badge.
- First-run welcome page.
- Skips name, address, phone, username, card and one-time-code fields.
- Table of ~150 frequent misspellings, protected tech terms, Hinglish words and
  British spellings.

### Improved
- Suggestions are ranked using QWERTY neighbour keys and swapped-letter slips.
- Corrector results are cached (LRU), repeated typos are instant.
- 98-word typo corpus guards against wrong fixes in tests.

### Tooling
- `npm run check` validates manifest, assets and script syntax.
- GitHub Actions workflow runs checks, tests and packs the extension.

## 0.1.0

- Initial release: silent offline auto-correct for inputs, textareas and rich
  editors; Backspace undo; per-site and global toggle.
