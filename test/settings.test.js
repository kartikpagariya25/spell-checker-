'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Settings = require('../src/settings.js');

test('is active by default and respects the global switch', () => {
  assert.equal(Settings.isActiveOn('example.com'), true);
  Settings.save({ enabled: false });
  assert.equal(Settings.isActiveOn('example.com'), false);
  Settings.save({ enabled: true });
  assert.equal(Settings.isActiveOn('example.com'), true);
});

test('can be disabled for a single host', () => {
  Settings.save({ disabledHosts: ['mail.example.com'] });
  assert.equal(Settings.isActiveOn('mail.example.com'), false);
  assert.equal(Settings.isActiveOn('docs.example.com'), true);
  Settings.save({ disabledHosts: [] });
});

test('learnWord stores each word once', () => {
  Settings.save({ learned: [] });
  Settings.learnWord('teh');
  Settings.learnWord('teh');
  assert.deepEqual(Settings.get().learned, ['teh']);
});

test('has sensible preference defaults', () => {
  const d = Settings.DEFAULTS;
  assert.equal(d.sensitivity, 'balanced');
  assert.equal(d.fixOnEnter, true);
  assert.equal(d.showHighlight, true);
  assert.equal(d.includeSearchBoxes, true);
  assert.equal(d.fixCapitalizedAtSentenceStart, true);
});

test('recordRecent keeps only the 10 newest, newest first', () => {
  Settings.save({ recent: [] });
  for (let i = 0; i < 12; i++) Settings.recordRecent('w' + i, 'x' + i, 'example.com');
  const recent = Settings.get().recent;
  assert.equal(recent.length, 10);
  assert.equal(recent[0].from, 'w11');
  assert.equal(recent[9].from, 'w2');
});

test('export then import round-trips learned words and sites', () => {
  Settings.save({ learned: ['teh', 'recieve'], disabledHosts: ['a.com'], sensitivity: 'eager' });
  const dump = JSON.parse(JSON.stringify(Settings.exportData()));
  Settings.save({ learned: [], disabledHosts: [], sensitivity: 'balanced' });
  const result = Settings.importData(dump);
  assert.deepEqual(result, { words: 2, hosts: 1 });
  assert.deepEqual(Settings.get().learned, ['teh', 'recieve']);
  assert.deepEqual(Settings.get().disabledHosts, ['a.com']);
  assert.equal(Settings.get().sensitivity, 'eager');
});

test('import rejects foreign files and drops malformed entries', () => {
  assert.throws(() => Settings.importData({ app: 'other' }), /Not a SpellFix/);
  assert.throws(() => Settings.importData(null));
  Settings.save({ learned: [], disabledHosts: [] });
  const r = Settings.importData({ app: 'spellfix', learned: ['ok', 'Bad Word', 5, '<script>'], disabledHosts: ['good.com', 'bad host!'] });
  assert.deepEqual(r, { words: 1, hosts: 1 });
  assert.deepEqual(Settings.get().learned, ['ok']);
});

test('notifies listeners on change', () => {
  let calls = 0;
  Settings.onChange(() => calls++);
  Settings.save({ correctionCount: 3 });
  assert.equal(calls, 1);
  assert.equal(Settings.get().correctionCount, 3);
});
