'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toFirefoxManifest, GECKO_ID } = require('../scripts/firefox-manifest.js');
const chrome = require('../manifest.json');

test('background becomes an event page that loads word-merge first', () => {
  const ff = toFirefoxManifest(chrome);
  assert.equal(ff.background.service_worker, undefined);
  assert.deepEqual(ff.background.scripts, [
    'src/word-merge.js', 'src/page-support.js', 'src/smart-fix.js', 'src/smart-client.js', 'src/polish.js',
    'src/background.js',
  ]);
});

test('adds a gecko id and minimum version', () => {
  const ff = toFirefoxManifest(chrome);
  assert.equal(ff.browser_specific_settings.gecko.id, GECKO_ID);
  assert.match(ff.browser_specific_settings.gecko.strict_min_version, /^\d+\.0$/);
});

test('does not mutate the Chrome manifest and keeps everything else', () => {
  const before = JSON.stringify(chrome);
  const ff = toFirefoxManifest(chrome);
  assert.equal(JSON.stringify(chrome), before);
  assert.deepEqual(ff.content_scripts, chrome.content_scripts);
  assert.deepEqual(ff.permissions, chrome.permissions);
  assert.equal(ff.version, chrome.version);
});
