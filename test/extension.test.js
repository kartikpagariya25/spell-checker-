'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { check, referencedByManifest } = require('../scripts/check.js');

const ROOT = path.resolve(__dirname, '..');

test('extension files are consistent (manifest, assets, JS syntax)', () => {
  assert.deepEqual(check(ROOT), []);
});

test('manifest references every content script in dependency order', () => {
  const manifest = require('../manifest.json');
  const js = manifest.content_scripts[0].js;
  const order = (name) => js.indexOf('src/' + name);
  // corrector needs keyboard + common typos; content.js needs everything else.
  assert.ok(order('keyboard.js') < order('corrector.js'));
  assert.ok(order('common-typos.js') < order('corrector.js'));
  assert.ok(order('dictionary-data.js') < order('content.js'));
  assert.equal(js[js.length - 1], 'src/content.js');
});

test('referencedByManifest lists icons and pages', () => {
  const files = referencedByManifest(require('../manifest.json'));
  assert.ok(files.includes('popup/popup.html'));
  assert.ok(files.includes('options/options.html'));
  assert.ok(files.includes('icons/icon128.png'));
  assert.ok(files.includes('src/background.js'));
});

test('background importScripts only names files that exist', () => {
  const fs = require('fs');
  const source = fs.readFileSync(path.join(ROOT, 'src', 'background.js'), 'utf8');
  const call = /importScripts\(([^)]*)\)/.exec(source);
  assert.ok(call, 'background.js calls importScripts');
  const files = call[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
  assert.ok(files.includes('smart-client.js') && files.includes('smart-fix.js'));
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, 'src', f)), f);
});

test('smart-mode scripts are loaded by the content script, runner after the logic it uses', () => {
  const js = require('../manifest.json').content_scripts[0].js;
  assert.ok(js.indexOf('src/smart-fix.js') !== -1 && js.indexOf('src/smart-runner.js') !== -1);
  assert.ok(js.indexOf('src/smart-fix.js') < js.indexOf('src/content.js'));
  assert.ok(js.indexOf('src/smart-runner.js') < js.indexOf('src/content.js'));
});

test('manifest can reach every page and repair already-open tabs', () => {
  const manifest = require('../manifest.json');
  assert.ok(manifest.permissions.includes('scripting'));
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
  const cs = manifest.content_scripts[0];
  assert.deepEqual(cs.matches, ['<all_urls>']);
  assert.equal(cs.all_frames, true);
  assert.equal(cs.match_about_blank, true);
  assert.equal(cs.match_origin_as_fallback, true);
});

test('check reports problems for a broken manifest', () => {
  const fs = require('fs');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spellfix-'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ manifest_version: 2, content_scripts: [{ js: ['nope.js'] }] }));
  const problems = check(dir);
  assert.ok(problems.some((p) => /manifest_version/.test(p)));
  assert.ok(problems.some((p) => /nope\.js/.test(p)));
  fs.rmSync(dir, { recursive: true, force: true });
});
