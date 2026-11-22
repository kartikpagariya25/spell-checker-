'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');

// Generous budgets: these exist to catch accidental 10x slowdowns, not to benchmark.
function time(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  return { ms: Number(process.hrtime.bigint() - start) / 1e6, result };
}

test('building the corrector from the full dictionary is quick', () => {
  const { ms } = time(() => createCorrector(words));
  assert.ok(ms < 400, `built in ${ms.toFixed(1)}ms`);
});

test('a typical typo is corrected in well under a frame', () => {
  const c = createCorrector(words);
  const { ms } = time(() => {
    for (const w of ['teh', 'wrold', 'exmaple', 'helllo', 'thnks']) c.correct(w);
  });
  assert.ok(ms < 50, `five typos took ${ms.toFixed(1)}ms`);
});

test('worst case two-edit search on a long word stays interactive', () => {
  const c = createCorrector(words, { sensitivity: 'eager' });
  const { ms } = time(() => c.correct('comunicatoin'));
  assert.ok(ms < 300, `took ${ms.toFixed(1)}ms`);
});

test('a mostly-correct sentence costs almost nothing', () => {
  const c = createCorrector(words);
  const sentence = 'the quick brown fox jumps over the lazy dog while everyone watches quietly'.split(' ');
  const { ms } = time(() => {
    for (let i = 0; i < 200; i++) for (const w of sentence) c.correct(w);
  });
  assert.ok(ms < 100, `${ms.toFixed(1)}ms`);
});

test('dictionary stays a sensible size for a content script', () => {
  const bytes = Buffer.byteLength(words.join(','));
  assert.ok(bytes < 600 * 1024, `${(bytes / 1024).toFixed(0)}KB`);
  assert.ok(words.length > 40000);
});
