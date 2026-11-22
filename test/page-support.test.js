'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUrl, explainUnsupported } = require('../src/page-support.js');

test('normal websites are supported', () => {
  assert.deepEqual(classifyUrl('https://chatgpt.com/c/abc'), { kind: 'web', hostname: 'chatgpt.com' });
  assert.deepEqual(classifyUrl('http://localhost:5599/test/'), { kind: 'web', hostname: 'localhost' });
  assert.equal(classifyUrl('https://mail.google.com/mail/u/0/').kind, 'web');
});

test('browser-owned pages are blocked', () => {
  for (const u of ['chrome://newtab/', 'chrome://extensions', 'chrome-untrusted://new-tab-page/', 'about:blank',
    'edge://settings', 'view-source:https://example.com', 'devtools://devtools/bundled/x.html',
    'chrome-extension://abc/popup.html', '']) {
    assert.equal(classifyUrl(u).kind, 'browser', u);
  }
  assert.equal(classifyUrl(undefined).kind, 'browser');
});

test('extension stores are blocked', () => {
  assert.equal(classifyUrl('https://chromewebstore.google.com/detail/x').kind, 'store');
  assert.equal(classifyUrl('https://chrome.google.com/webstore/detail/x').kind, 'store');
  assert.equal(classifyUrl('https://addons.mozilla.org/en-US/firefox/').kind, 'store');
  // other chrome.google.com pages are ordinary
  assert.equal(classifyUrl('https://chrome.google.com/other').kind, 'web');
});

test('file URLs need a separate permission', () => {
  assert.equal(classifyUrl('file:///C:/notes.html').kind, 'file');
});

test('explanations exist for every blocked kind and not for web', () => {
  for (const k of ['browser', 'store', 'file']) assert.ok(explainUnsupported(k).length > 20, k);
  assert.equal(explainUnsupported('web'), '');
});
