# SpellFix - silent spelling auto-correct for every website

Type fast, make typos, and let them fix themselves. SpellFix watches what you
type in any text box on any website (email, chat, prompts, forms) and corrects
a misspelled word the moment you finish it - no popups, no clicking.

```
you type:   i saw teh cat and recieve the mesage
you get:    i saw the cat and receive the message
```

**Want to keep the original spelling?** Press `Backspace` right after a fix.
The word goes back to what you typed and SpellFix will never "fix" that word
again.

## What it does (and doesn't)

- Fixes **spelling only**. It never rewrites sentences, changes grammar or tone.
- Corrects when you press space or type `, . ! ? ; : )`, and also when you press
  `Enter` (so chat messages and prompts are fixed before they are sent).
- Works in `<input>`, `<textarea>` and rich editors (`contenteditable`) such as
  Gmail, Slack, Notion, ChatGPT-style prompt boxes.
- Fully **offline and private**: a bundled 45,000-word English dictionary is
  used locally. Nothing you type ever leaves your browser.
- Shows a soft green highlight/glow for about a second on the word it fixed.
- Prefers staying quiet to guessing: ambiguous typos are left alone.
- Ranks fixes by how fingers actually slip (neighbouring keys, swapped letters).
- Settings page: sensitivity (careful / balanced / eager), Enter-to-fix,
  highlight, backup/restore of kept words. `Alt+Shift+S` toggles SpellFix.
- The popup lists your recent fixes so nothing changes behind your back.

### Never touched

Passwords, email/URL/number fields, code editors (Monaco, CodeMirror, Ace),
name / address / phone / username fields, fields with `spellcheck="false"`, words with digits or symbols (`user@x.com`,
`snake_case`, `v2`), `ALLCAPS`, `camelCase`, and capitalised words in the
middle of a sentence (probably names).

## Install (developer mode)

1. `npm run pack` (copies the extension into `dist/spellfix`)
2. Open `chrome://extensions` (also works in Edge / Brave), enable **Developer mode**
3. **Load unpacked** and pick `dist/spellfix` (or just pick this folder)

Click the toolbar icon to switch SpellFix on/off globally or for the current
site, and to review or forget the words you chose to keep.

## How it works

| Piece | File |
| --- | --- |
| Word + case helpers (pure, tested) | `src/text-utils.js` |
| Frequency-ranked offline corrector | `src/corrector.js` |
| Bundled dictionary (generated) | `src/dictionary-data.js` |
| `<input>`/`<textarea>`/`contenteditable` adapters | `src/editors.js` |
| Highlight cue | `src/feedback.js`, `src/content.css` |
| Typing watcher, undo logic | `src/content.js` |
| Frequent-misspelling table | `src/common-typos.js` |
| Keyboard neighbours | `src/keyboard.js` |
| Skip rules for personal-data fields | `src/field-rules.js` |
| Settings store | `src/settings.js` |
| Popup / settings / welcome pages | `popup/`, `options/`, `welcome/` |
| Badge, shortcut, first run | `src/background.js` |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full pipeline,
[PRIVACY.md](PRIVACY.md) for what is stored, and [CONTRIBUTING.md](CONTRIBUTING.md)
to help out.

The corrector generates all one-letter edits (delete, swap, replace, insert) of
an unknown word, keeps those that are real words, and picks the clear winner by
word frequency. Longer words may also be fixed with two edits. If no candidate
clearly beats the others, nothing happens. Replacements use
`document.execCommand('insertText')`, so pages see normal input events and
`Ctrl+Z` keeps working.

## Develop

```
npm test                 # unit tests (node:test, no dependencies)
node scripts/dev-server.js   # manual test page at http://localhost:5599/test/manual/
npm run build:dict -- path/to/en-80k.txt   # rebuild the dictionary
npm run build:icons      # regenerate icons
```

The dictionary is derived from the public word-frequency list in
[SymSpell](https://github.com/wolfgarbe/SymSpell) (`en-80k.txt`), filtered to
plain lowercase words with a curated list of short words.

## Known limitations

- English (US) only for now.
- Some rich editors that fully control their own DOM may ignore programmatic
  edits; if a site misbehaves, disable SpellFix for it from the popup.
- It can't judge context (`their` vs `there`) - that's grammar, not spelling.

## License

MIT
