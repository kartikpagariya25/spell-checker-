# Changelog

## 0.4.2

### Added
- Groq (GroqCloud) as a fourth Smart mode provider (`api.groq.com`, default model
  `openai/gpt-oss-20b`).
- Settings warns when the saved key's prefix belongs to a different provider
  (for example a `gsk_` Groq key while xAI is selected).

### Changed
- Switching provider resets the model to that provider's default, since model
  names differ between providers.
- "Unknown provider" errors now explain that the extension needs a reload.

## 0.4.1

### Added
- xAI (Grok) as a third Smart mode provider (`api.x.ai`, default model `grok-4.7`,
  editable in Settings).

### Changed
- OpenAI-style providers now send `max_completion_tokens` (2000) so reasoning
  models have room to finish; this also works with newer OpenAI models.

## 0.4.0

### Added
- **Smart mode (AI, opt-in).** Bring your own Anthropic or OpenAI key. When you
  end a sentence, press Enter or pause, sentences that still contain a suspected
  typo are checked by the AI using the whole sentence for meaning and tone.
  - Private-looking tokens are replaced by placeholders before sending.
  - Only spelling-sized changes are accepted; rewording is rejected.
  - Applied as one edit, undone with a single Ctrl+Z; caret position is kept.
  - Rate limited, with timeouts and friendly error messages (the key is never
    shown). "Test connection" button in Settings.
- Privacy policy and store disclosure updated for the optional feature.

## 0.3.1

### Fixed
- SpellFix now works in tabs that were open before it was installed, updated
  or reloaded: it injects itself into them automatically.
- Listeners attach the instant a page loads instead of after settings are read,
  so the first words typed in a new tab are no longer missed.
- Old copies of the script left behind by an extension reload now stand down
  instead of fighting the new copy.
- Frames created from `about:blank`, `srcdoc` and `blob:` pages are covered.

### Added
- The popup tells you when SpellFix can't run on a page (new tab page, browser
  settings, built-in side panels such as Gemini, extension stores) and offers
  **Activate on this tab** when a normal page was missed.

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
