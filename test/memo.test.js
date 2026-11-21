'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');

test('repeated lookups return the same answer and are cached', () => {
  const c = createCorrector(words);
  assert.equal(c.memoSize(), 0);
  assert.equal(c.correct('unfortunatley'), c.correct('unfortunatley'));
  assert.equal(c.memoSize(), 1);
});

test('null results are cached too', () => {
  const c = createCorrector(words);
  c.correct('zzzzzzzz');
  c.correct('zzzzzzzz');
  assert.equal(c.memoSize(), 1);
});

test('cache never grows past its limit', () => {
  const c = createCorrector(words);
  for (let i = 0; i < 700; i++) c.correct('qq' + i.toString(36).replace(/[0-9]/g, 'x') + 'zz');
  assert.ok(c.memoSize() <= 500, String(c.memoSize()));
});

test('ignored words bypass the cache immediately', () => {
  const ignore = new Set();
  const c = createCorrector(words, { ignore });
  assert.equal(c.correct('recieve'), 'receive');
  ignore.add('recieve');
  assert.equal(c.correct('recieve'), null);
});
