# Changelog

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
