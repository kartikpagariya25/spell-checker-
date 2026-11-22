'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { dayKey, addCount, weekTotal } = require('../src/stats.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 22, 12, 0, 0).getTime(); // local noon, 22 Nov 2026

test('dayKey formats local dates with zero padding', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 9).getTime()), '2026-01-05');
  assert.equal(dayKey(NOW), '2026-11-22');
});

test('addCount accumulates within a day without mutating input', () => {
  const start = { '2026-11-22': 2 };
  const next = addCount(start, 3, NOW);
  assert.deepEqual(next, { '2026-11-22': 5 });
  assert.deepEqual(start, { '2026-11-22': 2 });
});

test('addCount drops days older than about a month', () => {
  const old = dayKey(NOW - 40 * DAY);
  const recent = dayKey(NOW - 10 * DAY);
  const next = addCount({ [old]: 9, [recent]: 4 }, 1, NOW);
  assert.equal(next[old], undefined);
  assert.equal(next[recent], 4);
  assert.equal(next[dayKey(NOW)], 1);
});

test('weekTotal sums today and the previous six days only', () => {
  const counts = {
    [dayKey(NOW)]: 5,
    [dayKey(NOW - 6 * DAY)]: 3,
    [dayKey(NOW - 7 * DAY)]: 100, // outside the window
  };
  assert.equal(weekTotal(counts, NOW), 8);
  assert.equal(weekTotal({}, NOW), 0);
  assert.equal(weekTotal(undefined, NOW), 0);
});
