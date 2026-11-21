'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const COMMON = require('../src/common-typos.js');

const known = new Set(words);

test('no key in the common-typo table is itself a dictionary word', () => {
  const clash = Object.keys(COMMON).filter((k) => known.has(k));
  // Remove these keys from common-typos.js (they would hide a valid word).
  assert.deepEqual(clash, []);
});

test('every key is lowercase letters only', () => {
  for (const key of Object.keys(COMMON)) assert.match(key, /^[a-z]+$/, key);
});

test('values are never equal to their keys', () => {
  for (const [k, v] of Object.entries(COMMON)) assert.notEqual(k, v.toLowerCase(), k);
});
