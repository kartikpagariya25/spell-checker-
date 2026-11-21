'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const words = require('../src/dictionary-data.js');
const { createCorrector } = require('../src/corrector.js');

const careful = createCorrector(words, { sensitivity: 'careful' });
const balanced = createCorrector(words, { sensitivity: 'balanced' });
const eager = createCorrector(words, { sensitivity: 'eager' });

test('defaults to balanced behaviour', () => {
  const plain = createCorrector(words);
  for (const w of ['wrold', 'helllo', 'exmaple', 'tommorrow']) assert.equal(plain.correct(w), balanced.correct(w), w);
});

test('careful never makes two-edit fixes', () => {
  // "comunicaton" needs more than one edit, so careful leaves it alone while eager fixes it.
  assert.equal(careful.correct('comunicaton'), null);
  assert.equal(eager.correct('comunicaton'), 'communication');
});

test('careful skips three-letter guesses but still fixes clear ones', () => {
  assert.equal(careful.correct('wrold'), 'world');
  assert.equal(careful.correct('adn'), 'and'); // explicit override, always safe
});

test('every profile still leaves correct words alone', () => {
  for (const c of [careful, balanced, eager]) {
    for (const w of ['hello', 'because', 'github', 'kya']) assert.equal(c.correct(w), null, w);
  }
});

test('eager fixes at least as many typos as balanced, balanced as careful', () => {
  const sample = ['wrold', 'exmaple', 'comptuer', 'langauge', 'pyhton', 'comunicaton', 'reciept', 'accomodation'];
  const count = (c) => sample.filter((w) => c.correct(w)).length;
  assert.ok(count(eager) >= count(balanced));
  assert.ok(count(balanced) >= count(careful));
});
