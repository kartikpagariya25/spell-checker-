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

test('notifies listeners on change', () => {
  let calls = 0;
  Settings.onChange(() => calls++);
  Settings.save({ correctionCount: 3 });
  assert.equal(calls, 1);
  assert.equal(Settings.get().correctionCount, 3);
});
