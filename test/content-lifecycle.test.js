'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('../manifest.json');
const SCRIPTS = manifest.content_scripts[0].js;

// A page-like sandbox: just enough DOM to let the content script start.
function createPage() {
  const added = [];
  const removed = [];
  const messageListeners = [];
  const sandbox = {
    console,
    location: { hostname: 'example.com' },
    document: {
      addEventListener: (type, fn, capture) => added.push([type, fn, capture]),
      removeEventListener: (type, fn) => removed.push([type, fn]),
    },
    chrome: {
      runtime: { id: 'abc123', onMessage: { addListener: (fn) => messageListeners.push(fn) } },
      // Storage that never answers: models a slow storage call in a brand new tab.
      storage: { local: { get() {}, set() {} }, onChanged: { addListener() {} } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const run = (files) => {
    for (const file of files) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
    }
  };
  return { sandbox, added, removed, messageListeners, run };
}

test('listeners are attached immediately, before settings finish loading', () => {
  const page = createPage();
  page.run(SCRIPTS);
  const types = page.added.map((a) => a[0]).sort();
  assert.deepEqual(types, ['focusout', 'input', 'keydown', 'keyup', 'pointerdown']);
  assert.ok(page.added.every((a) => a[2] === true), 'all in the capture phase');
});

test('loading the scripts twice never double-attaches', () => {
  const page = createPage();
  page.run(SCRIPTS);
  page.run(['src/content.js']);
  assert.equal(page.added.length, 5);
});

test('answers a ping so the popup can tell the script is running', () => {
  const page = createPage();
  page.run(SCRIPTS);
  assert.equal(page.messageListeners.length, 1);
  let reply = null;
  page.messageListeners[0]({ type: 'spellfix-ping' }, {}, (r) => (reply = r));
  assert.equal(reply.ok, true);
  assert.equal(reply.host, 'example.com');
  let ignored = 'untouched';
  page.messageListeners[0]({ type: 'something-else' }, {}, () => (ignored = 'answered'));
  assert.equal(ignored, 'untouched');
});

test('stands down when the extension was reloaded under it, then a new copy can start', () => {
  const page = createPage();
  page.run(SCRIPTS);
  const keydown = page.added.find((a) => a[0] === 'keydown')[1];

  page.sandbox.chrome.runtime.id = undefined; // what an orphaned content script sees
  keydown({ key: 'a', isComposing: false });

  assert.equal(page.removed.length, 5, 'all listeners removed');
  assert.equal(page.sandbox.__spellFixLoaded, false);

  page.sandbox.chrome.runtime.id = 'new-instance';
  page.run(['src/content.js']);
  assert.equal(page.added.length, 10, 'a fresh copy attached its own listeners');
});

test('every script the content script needs is listed in the manifest before content.js', () => {
  for (const file of ['src/text-utils.js', 'src/corrector.js', 'src/settings.js', 'src/editors.js', 'src/feedback.js']) {
    assert.ok(SCRIPTS.indexOf(file) !== -1 && SCRIPTS.indexOf(file) < SCRIPTS.indexOf('src/content.js'), file);
  }
});
