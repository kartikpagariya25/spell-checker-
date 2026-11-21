'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/text-utils.js');

test('isDelimiter recognises word-ending characters', () => {
  for (const ch of [' ', ',', '.', '!', '?', ';', ':', ')']) assert.equal(T.isDelimiter(ch), true, ch);
  for (const ch of ['a', '1', '-', '@', '/', '']) assert.equal(T.isDelimiter(ch), false, ch);
  assert.equal(T.isDelimiter(undefined), false);
  assert.equal(T.isDelimiter('  '), false);
});

test('wordBeforeCaret finds the last plain word', () => {
  assert.deepEqual(T.wordBeforeCaret('hello teh'), { word: 'teh', start: 6, end: 9 });
  assert.deepEqual(T.wordBeforeCaret('teh'), { word: 'teh', start: 0, end: 3 });
  assert.deepEqual(T.wordBeforeCaret('say "teh'), { word: 'teh', start: 5, end: 8 });
  assert.deepEqual(T.wordBeforeCaret('(teh'), { word: 'teh', start: 1, end: 4 });
});

test('wordBeforeCaret ignores code-like and structured tokens', () => {
  for (const s of ['user@exmple', 'foo.bar', 'path/to', '#tag', '$var', 'snake_case', 'abc123', 'well-knwon', "dont'", 'a1b']) {
    assert.equal(T.wordBeforeCaret(s), null, s);
  }
  assert.equal(T.wordBeforeCaret(''), null);
  assert.equal(T.wordBeforeCaret('hello '), null);
});

test('isSentenceStart', () => {
  assert.equal(T.isSentenceStart(''), true);
  assert.equal(T.isSentenceStart('   '), true);
  assert.equal(T.isSentenceStart('Hello there. '), true);
  assert.equal(T.isSentenceStart('Really? '), true);
  assert.equal(T.isSentenceStart('line one\n'), true);
  assert.equal(T.isSentenceStart('"'), true);
  assert.equal(T.isSentenceStart('I met '), false);
  assert.equal(T.isSentenceStart('a, '), false);
});

test('caseOf classifies words', () => {
  assert.equal(T.caseOf('word'), T.CASE.LOWER);
  assert.equal(T.caseOf('Word'), T.CASE.CAPITALIZED);
  assert.equal(T.caseOf('WORD'), T.CASE.OTHER);
  assert.equal(T.caseOf('wOrd'), T.CASE.OTHER);
  assert.equal(T.caseOf('camelCase'), T.CASE.OTHER);
});

test('applyCase restores capitalisation', () => {
  assert.equal(T.applyCase('teh', 'the'), 'the');
  assert.equal(T.applyCase('Teh', 'the'), 'The');
});
