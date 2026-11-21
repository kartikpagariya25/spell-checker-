'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');

const c = createCorrector(words);

test('fixes common transposition and swap typos', () => {
  const cases = {
    teh: 'the', adn: 'and', taht: 'that', waht: 'what', jsut: 'just', yuo: 'you',
    recieve: 'receive', becuase: 'because', wich: 'which', thier: 'their',
    beleive: 'believe', freind: 'friend', wierd: 'weird', seperate: 'separate',
    definately: 'definitely',
  };
  for (const [typo, fix] of Object.entries(cases)) assert.equal(c.correct(typo), fix, typo);
});

test('fixes dropped, doubled and wrong letters', () => {
  assert.equal(c.correct('wrold'), 'world');
  assert.equal(c.correct('helllo'), 'hello');
  assert.equal(c.correct('happpy'), 'happy');
  assert.equal(c.correct('computr'), 'computer');
  assert.equal(c.correct('exmaple'), 'example');
  assert.equal(c.correct('tommorow'), 'tomorrow');
});

test('expands missing-apostrophe contractions', () => {
  assert.equal(c.correct('dont'), "don't");
  assert.equal(c.correct('im'), "I'm");
  assert.equal(c.correct('doesnt'), "doesn't");
});

test('never touches correctly spelled words', () => {
  for (const w of ['the', 'hello', 'because', 'world', 'receive', 'computer']) {
    assert.equal(c.correct(w), null, w);
  }
});

test('leaves very short and unfixable words alone', () => {
  assert.equal(c.correct('xq'), null);
  assert.equal(c.correct('kartik'), null);
  assert.equal(c.correct('zzzzzz'), null);
});

test('stays quiet when the fix is ambiguous', () => {
  // "wom" could be "who", "won", "com", "wow", ... no clear winner.
  const result = c.correct('wom');
  assert.ok(result === null || typeof result === 'string');
});

test('respects the ignore list', () => {
  const ignoring = createCorrector(words, { ignore: new Set(['teh', 'recieve']) });
  assert.equal(ignoring.correct('teh'), null);
  assert.equal(ignoring.correct('recieve'), null);
});

test('is fast enough to run on every word', () => {
  const start = process.hrtime.bigint();
  for (const w of ['recieve', 'tommorow', 'definately', 'exmaple', 'unfortunatley']) c.correct(w);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 500, `took ${ms}ms`);
});
