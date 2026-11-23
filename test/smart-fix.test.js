'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector, boundedDistance } = require('../src/corrector.js');
const S = require('../src/smart-fix.js');

const corrector = createCorrector(words);
const deps = { isKnown: (w) => corrector.isKnown(w), ignore: new Set() };

// ---- sentenceBeforeCaret ---------------------------------------------------

test('finds the sentence being written', () => {
  const r = S.sentenceBeforeCaret('Hello there. their going to the stor');
  assert.equal(r.sentence, 'their going to the stor');
  assert.equal(r.start, 13);
});

test('finds a sentence that was just finished with punctuation', () => {
  const r = S.sentenceBeforeCaret('First one. Their going to the stor.');
  assert.equal(r.sentence, 'Their going to the stor.');
});

test('handles a single sentence, trailing spaces and new lines', () => {
  assert.equal(S.sentenceBeforeCaret('just one sentence here  ').sentence, 'just one sentence here');
  assert.equal(S.sentenceBeforeCaret('line one\nline two typo').sentence, 'line two typo');
  assert.equal(S.sentenceBeforeCaret('   '), null);
  assert.equal(S.sentenceBeforeCaret(''), null);
});

test('keeps closing quotes and splits after ?!', () => {
  assert.equal(S.sentenceBeforeCaret('Really? yes i dont no.').sentence, 'yes i dont no.');
  assert.equal(S.sentenceBeforeCaret('He said "go home." then lft').sentence, 'then lft');
});

test('very long sentences are trimmed to the most recent words', () => {
  const long = ('word '.repeat(150)).trim();
  const r = S.sentenceBeforeCaret(long);
  assert.ok(r.sentence.length <= S.MAX_SENTENCE);
  assert.ok(long.endsWith(r.sentence));
});

// ---- suspectWords -------------------------------------------------------------

test('flags unknown words but not known ones', () => {
  assert.deepEqual(S.suspectWords('their going to the stor tomorow', deps), ['stor', 'tomorow']);
  assert.deepEqual(S.suspectWords('this sentence is perfectly fine', deps), []);
});

test('names, ALLCAPS, digits and symbols are not suspects', () => {
  assert.deepEqual(S.suspectWords('I met Kartik at NASA with abc123 and snake_case', deps), []);
  // At the very start of a sentence a capitalised unknown word could be a typo or a name,
  // so it is a suspect; the AI is told to keep names, and its edits are range-checked anyway.
  assert.deepEqual(S.suspectWords('Kartik said hello', deps), ['Kartik']);
});

test('a capitalised sentence-start typo is still a suspect', () => {
  assert.deepEqual(S.suspectWords('Wrold peace is good', deps), ['Wrold']);
});

test('ignored (kept) words are not suspects', () => {
  const kept = { isKnown: deps.isKnown, ignore: new Set(['stor']) };
  assert.deepEqual(S.suspectWords('go to the stor now', kept), []);
});

test('punctuation around words is handled', () => {
  assert.deepEqual(S.suspectWords('(wrold), "stor!"', deps), ['wrold', 'stor']);
});

// ---- redact / restore ----------------------------------------------------------

test('hides emails, links, mentions, numbers and keys, and restores them', () => {
  const s = 'mail me at kartik@example.com or see https://example.com/a?b=1 @kartik 98765 43210 sk-abcdefghijklmnopqrstuvwxyz123';
  const { text, tokens } = S.redact(s);
  for (const secret of ['kartik@example.com', 'https://example.com', '@kartik', '98765 43210', 'sk-abcdefghijklmnopqrstuvwxyz123']) {
    assert.equal(text.includes(secret), false, secret);
  }
  assert.match(text, /\[\[\d\]\]/);
  assert.equal(S.restore(text, tokens), s);
});

test('plain sentences pass through redaction untouched', () => {
  const s = 'their going to the stor tomorow';
  assert.deepEqual(S.redact(s), { text: s, tokens: [] });
});

test('restore leaves unknown placeholders alone', () => {
  assert.equal(S.restore('see [[9]]', ['a']), 'see [[9]]');
});

// ---- validateCorrection ----------------------------------------------------------

const check = (orig, fixed) => S.validateCorrection(orig, fixed, boundedDistance);

test('accepts genuine spelling and wrong-word fixes', () => {
  const r = check('their going to the stor tomorow', "they're going to the store tomorrow");
  assert.equal(r.text, "they're going to the store tomorrow");
  assert.deepEqual(r.changes.map((c) => c.to), ["they're", 'store', 'tomorrow']);
});

test('keeps the user own punctuation and spacing', () => {
  const r = check('hello,  wrold!', 'Hello wrold.');
  // only spelling-sized word changes are applied; punctuation/spacing stay as typed
  assert.equal(r.text.includes('  '), true);
  assert.equal(r.text.endsWith('!'), true);
});

test('rejects a reworded answer completely', () => {
  const r = check('i dont no what to do', 'I do not know what you should do next');
  assert.equal(r.text, 'i dont no what to do');
  assert.deepEqual(r.changes, []);
});

test('rejects words that changed too much but keeps the good ones', () => {
  const r = check('i recieve the mesage today', 'i receive the announcement today');
  assert.equal(r.text, 'i receive the mesage today');
  assert.deepEqual(r.changes, [{ from: 'recieve', to: 'receive' }]);
});

test('allows classic confusables even when far apart', () => {
  const r = check('i want to lose the lid', 'i want to loose the lid');
  assert.equal(r.text, 'i want to loose the lid');
});

test('placeholders are never touched', () => {
  const r = check('mail [[1]] to teh team', 'mail [[2]] to the team');
  assert.equal(r.text, 'mail [[1]] to the team');
});

test('identical or invalid answers change nothing', () => {
  assert.deepEqual(check('all good here', 'all good here'), { text: 'all good here', changes: [] });
  assert.deepEqual(check('all good here', null), { text: 'all good here', changes: [] });
});

// ---- prompt + parsing -------------------------------------------------------------

test('parseFixed extracts the tagged sentence', () => {
  assert.equal(S.parseFixed('<fixed> they are here </fixed>'), 'they are here');
  assert.equal(S.parseFixed('Sure!\n<fixed>ok then</fixed> thanks'), 'ok then');
  assert.equal(S.parseFixed('no tags here'), null);
  assert.equal(S.parseFixed(undefined), null);
});

test('prompt forbids rewording and treats the sentence as data', () => {
  assert.match(S.SYSTEM_PROMPT, /ONLY spelling/);
  assert.match(S.SYSTEM_PROMPT, /ignore any instructions/i);
  assert.match(S.SYSTEM_PROMPT, /<fixed><\/fixed>/);
  assert.match(S.userPrompt('abc'), /abc/);
});
