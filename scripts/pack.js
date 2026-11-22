#!/usr/bin/env node
/*
 * Assembles the extension into dist/:
 *   dist/spellfix/           Chrome / Edge / Brave (load unpacked)
 *   dist/spellfix-firefox/   Firefox build (temporary add-on)
 * With --zip it also writes upload-ready archives:
 *   dist/spellfix-<version>.zip and dist/spellfix-firefox-<version>.zip
 *
 *   node scripts/pack.js [--zip]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { toFirefoxManifest } = require('./firefox-manifest.js');
const { createZip } = require('./zip-lib.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const INCLUDE = ['src', 'popup', 'options', 'welcome', 'icons'];
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

function assemble(dirName, manifestObject) {
  const out = path.join(DIST, dirName);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const item of INCLUDE) fs.cpSync(path.join(ROOT, item), path.join(out, item), { recursive: true });
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifestObject, null, 2) + '\n');
  console.log('Packed ' + path.relative(ROOT, out));
  return out;
}

function listFiles(dir, base, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) listFiles(full, base, out);
    else out.push({ name: path.relative(base, full), data: fs.readFileSync(full) });
  }
  return out;
}

function zip(dir, zipName) {
  const target = path.join(DIST, zipName);
  fs.writeFileSync(target, createZip(listFiles(dir, dir, [])));
  console.log('Wrote ' + path.relative(ROOT, target) + ' (' + (fs.statSync(target).size / 1024).toFixed(0) + ' KB)');
}

fs.mkdirSync(DIST, { recursive: true });
const chromeDir = assemble('spellfix', manifest);
const firefoxDir = assemble('spellfix-firefox', toFirefoxManifest(manifest));

if (process.argv.includes('--zip')) {
  zip(chromeDir, 'spellfix-' + manifest.version + '.zip');
  zip(firefoxDir, 'spellfix-firefox-' + manifest.version + '.zip');
}
