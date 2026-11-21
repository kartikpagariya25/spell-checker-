'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');
const corpus = require('./fixtures/typos.json');

const c = createCorrector(words);

test('corrects the typo corpus with high accuracy and no wrong fixes', () => {
  let right = 0;
  let quiet = 0;
  const wrong = [];
  for (const [typo, fix] of Object.entries(corpus.fix)) {
    const got = c.correct(typo);
    if (got === fix) right++;
    else if (got === null) quiet++;
    else wrong.push(`${typo} -> ${got} (wanted ${fix})`);
  }
  const total = Object.keys(corpus.fix).length;
  assert.deepEqual(wrong, [], 'wrong corrections: ' + wrong.join('; '));
  assert.ok(right / total >= 0.95, `only ${right}/${total} fixed (${quiet} left alone)`);
});

test('leaves correct and unknown-but-plausible words alone', () => {
  for (const w of corpus.leave) assert.equal(c.correct(w), null, w);
});
