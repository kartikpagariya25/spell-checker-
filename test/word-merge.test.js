'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeWords, sameWords, wordFromSelection, MAX_WORDS } = require('../src/word-merge.js');

test('mergeWords unions lists without duplicates, keeping order', () => {
  assert.deepEqual(mergeWords(['teh', 'recieve'], ['recieve', 'wich']), ['teh', 'recieve', 'wich']);
  assert.deepEqual(mergeWords([], []), []);
});

test('mergeWords drops invalid entries and tolerates non-arrays', () => {
  assert.deepEqual(mergeWords(['ok', 'Bad', 'a', 5, null, '<x>', 'fine'], undefined, 'nope'), ['ok', 'fine']);
});

test('mergeWords caps the list, keeping the newest words', () => {
  // Distinct valid words: base-26 spelling of the index, padded to 3 letters.
  const word = (i) => {
    let s = '';
    for (let n = i; n > 0 || s.length < 3; n = Math.floor(n / 26)) s = String.fromCharCode(97 + (n % 26)) + s;
    return s;
  };
  const many = Array.from({ length: MAX_WORDS + 50 }, (_, i) => word(i));
  const merged = mergeWords(many);
  assert.equal(merged.length, MAX_WORDS);
  assert.equal(merged[merged.length - 1], many[many.length - 1]);
  assert.equal(merged.includes(many[0]), false);
});

test('sameWords ignores order but not content', () => {
  assert.equal(sameWords(['a1'.replace('1', 'b'), 'cd'], ['cd', 'ab']), true);
  assert.equal(sameWords(['ab'], ['ab', 'cd']), false);
  assert.equal(sameWords(['ab'], ['cd']), false);
});

test('wordFromSelection accepts one clean word only', () => {
  assert.equal(wordFromSelection('  Kartik '), 'kartik');
  assert.equal(wordFromSelection('two words'), null);
  assert.equal(wordFromSelection('abc123'), null);
  assert.equal(wordFromSelection(''), null);
  assert.equal(wordFromSelection(undefined), null);
  assert.equal(wordFromSelection('a'), null);
});
