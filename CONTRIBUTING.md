# Contributing

Thanks for helping make typos disappear.

## Setup

No dependencies to install; you only need Node 18+.

```
npm test        # unit tests
npm run check   # manifest / asset / syntax consistency
node scripts/dev-server.js   # manual test page: http://localhost:5599/test/manual/
```

Load the extension with `npm run pack`, then **Load unpacked** on `dist/spellfix`
from `chrome://extensions`.

## Ground rules

- **Be quiet rather than wrong.** A missed typo is a shrug; a wrong "fix" erodes
  trust. When in doubt, don't correct.
- **Spelling only.** No grammar, tone or rewriting.
- **Private.** No network calls, no analytics, no remote code.
- **Small commits** with clear messages (`feat:`, `fix:`, `test:`, `docs:` ...).

## Adding a misspelling that gets fixed wrongly

1. Add it to `test/fixtures/typos.json` (`fix` for typo -> right word, `leave`
   for words that must not be touched).
2. Run `npm test`. If it fails, either add the pair to `src/common-typos.js` or
   improve the scoring in `src/corrector.js`.

## Rebuilding the dictionary

```
npm run build:dict -- path/to/en-80k.txt
```

Protected extras (tech terms, Hinglish, UK spellings) live in
`scripts/extra-words.txt`; short words are curated in `scripts/short-words.txt`.
