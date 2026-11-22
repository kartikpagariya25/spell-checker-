'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boundedDistance } = require('../src/corrector.js');

test('identical words are at distance 0', () => {
  assert.equal(boundedDistance('hello', 'hello', 2), 0);
});

test('single insert, delete, substitute and swap are distance 1', () => {
  assert.equal(boundedDistance('helo', 'hello', 2), 1);
  assert.equal(boundedDistance('helllo', 'hello', 2), 1);
  assert.equal(boundedDistance('hallo', 'hello', 2), 1);
  assert.equal(boundedDistance('hlelo', 'hello', 2), 1);
});

test('two edits are distance 2', () => {
  assert.equal(boundedDistance('comunicaton', 'communication', 2), 2);
  assert.equal(boundedDistance('beutifl', 'beautiful', 2), 2);
});

test('anything beyond the bound reports max + 1', () => {
  assert.equal(boundedDistance('abc', 'xyz', 2), 3);
  assert.equal(boundedDistance('a', 'abcdef', 2), 3);
  assert.equal(boundedDistance('kitten', 'sitting', 2), 3);
});

test('is symmetric', () => {
  for (const [a, b] of [['teh', 'the'], ['recieve', 'receive'], ['cat', 'dog']]) {
    assert.equal(boundedDistance(a, b, 3), boundedDistance(b, a, 3), a + '/' + b);
  }
});
