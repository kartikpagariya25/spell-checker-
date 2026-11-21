'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { areNeighbors } = require('../src/keyboard.js');

test('horizontal neighbours', () => {
  assert.equal(areNeighbors('a', 's'), true);
  assert.equal(areNeighbors('o', 'p'), true);
  assert.equal(areNeighbors('n', 'm'), true);
});

test('vertical and diagonal neighbours', () => {
  assert.equal(areNeighbors('e', 'd'), true);
  assert.equal(areNeighbors('o', 'l'), true);
  assert.equal(areNeighbors('b', 'h'), true);
  assert.equal(areNeighbors('t', 'f'), true);
});

test('distant keys are not neighbours', () => {
  assert.equal(areNeighbors('q', 'p'), false);
  assert.equal(areNeighbors('a', 'l'), false);
  assert.equal(areNeighbors('z', 'p'), false);
});

test('same key, unknown characters and symmetry', () => {
  assert.equal(areNeighbors('a', 'a'), false);
  assert.equal(areNeighbors('a', '1'), false);
  assert.equal(areNeighbors('s', 'a'), areNeighbors('a', 's'));
});
