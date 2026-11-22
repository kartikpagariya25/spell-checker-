'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');
const corpus = require('./fixtures/typos-extra.json');

const c = createCorrector(words);

test('second typo corpus: every entry is fixed correctly', () => {
  const failures = [];
  for (const [typo, fix] of Object.entries(corpus.fix)) {
    const got = c.correct(typo);
    if (got !== fix) failures.push(`${typo} -> ${got} (wanted ${fix})`);
  }
  assert.deepEqual(failures, []);
});

test('second corpus has no typo that is secretly a dictionary word', () => {
  const known = new Set(words);
  assert.deepEqual(Object.keys(corpus.fix).filter((t) => known.has(t)), []);
});
