#!/usr/bin/env node
/*
 * Copies only the files the extension needs into dist/spellfix/, ready to be
 * loaded via chrome://extensions -> "Load unpacked" or zipped for the store.
 *   node scripts/pack.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'spellfix');
const INCLUDE = ['manifest.json', 'src', 'popup', 'icons'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of INCLUDE) {
  fs.cpSync(path.join(ROOT, item), path.join(OUT, item), { recursive: true });
}
console.log('Packed extension to ' + OUT);
