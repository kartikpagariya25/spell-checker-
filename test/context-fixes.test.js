'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { contextFix, previousWord } = require('../src/context-fixes.js');

test('"of" after a modal verb becomes "have"', () => {
  for (const m of ['could', 'would', 'should', 'must', 'might', 'Could']) assert.equal(contextFix(m, 'of'), 'have', m);
  assert.equal(contextFix('some', 'of'), null);
  assert.equal(contextFix('out', 'of'), null);
});

test('accidentally doubled words are dropped', () => {
  assert.equal(contextFix('the', 'the'), '');
  assert.equal(contextFix('The', 'the'), '');
  assert.equal(contextFix('and', 'and'), '');
});

test('legitimate repeats are left alone', () => {
  for (const w of ['had', 'that', 'very', 'bye', 'no', 'is']) assert.equal(contextFix(w, w), null, w);
});

test('does nothing for different words, missing context or odd input', () => {
  assert.equal(contextFix('the', 'cat'), null);
  assert.equal(contextFix('', 'the'), null);
  assert.equal(contextFix('the', ''), null);
  assert.equal(contextFix('THE', 'THE'), null); // ALLCAPS is never touched
  assert.equal(contextFix('a', 'a'), null); // single letters can be legitimate
});

test('previousWord reads the word before the current one', () => {
  assert.equal(previousWord('could '), 'could');
  assert.equal(previousWord('I think we could  '), 'could');
  assert.equal(previousWord('hello, '), '');
  assert.equal(previousWord(''), '');
  assert.equal(previousWord('word'), '');
});
