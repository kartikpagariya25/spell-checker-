#!/usr/bin/env node
/*
 * Sanity-checks the extension before packing:
 *  - manifest.json parses and has the required fields
 *  - every file the manifest references exists
 *  - every HTML page's local scripts/styles/images exist
 *  - every JavaScript file is syntactically valid
 *    node scripts/check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function referencedByManifest(manifest) {
  const files = [];
  for (const cs of manifest.content_scripts || []) files.push(...(cs.js || []), ...(cs.css || []));
  if (manifest.background && manifest.background.service_worker) files.push(manifest.background.service_worker);
  if (manifest.action && manifest.action.default_popup) files.push(manifest.action.default_popup);
  if (manifest.options_ui && manifest.options_ui.page) files.push(manifest.options_ui.page);
  for (const icons of [manifest.icons, manifest.action && manifest.action.default_icon]) {
    if (icons) files.push(...Object.values(icons));
  }
  return Array.from(new Set(files));
}

function localAssetsOfHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const refs = [];
  const re = /(?:src|href)="([^"#?]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (!/^(https?:|data:|chrome:|\/\/)/.test(m[1])) refs.push(path.resolve(path.dirname(htmlPath), m[1]));
  }
  return refs;
}

/** @returns {string[]} list of problems; empty means all good */
function check(root) {
  const problems = [];
  const manifestPath = path.join(root, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return ['manifest.json is not valid JSON: ' + e.message];
  }

  if (manifest.manifest_version !== 3) problems.push('manifest_version must be 3');
  for (const key of ['name', 'version', 'description']) {
    if (!manifest[key]) problems.push('manifest is missing "' + key + '"');
  }

  const referenced = referencedByManifest(manifest);
  for (const rel of referenced) {
    if (!fs.existsSync(path.join(root, rel))) problems.push('manifest references missing file: ' + rel);
  }

  for (const rel of referenced.filter((f) => f.endsWith('.html'))) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    for (const asset of localAssetsOfHtml(abs)) {
      if (!fs.existsSync(asset)) problems.push(rel + ' references missing file: ' + path.relative(root, asset));
    }
  }

  const welcome = path.join(root, 'welcome', 'welcome.html');
  if (fs.existsSync(welcome)) {
    for (const asset of localAssetsOfHtml(welcome)) {
      if (!fs.existsSync(asset)) problems.push('welcome/welcome.html references missing file: ' + path.relative(root, asset));
    }
  }

  for (const dir of ['src', 'popup', 'options', 'welcome']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs, []).filter((f) => f.endsWith('.js'))) {
      try {
        new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
      } catch (e) {
        problems.push('syntax error in ' + path.relative(root, file) + ': ' + e.message);
      }
    }
  }

  return problems;
}

module.exports = { check, referencedByManifest };

if (require.main === module) {
  const problems = check(ROOT);
  if (problems.length) {
    console.error(problems.map((p) => 'x ' + p).join('\n'));
    process.exit(1);
  }
  console.log('ok - extension files look consistent');
}
