/*
 * Derives a Firefox (MV3) manifest from the Chrome one.
 * Differences: Firefox runs background code as an event page (`scripts`, not a
 * service worker) and wants an explicit add-on id.
 */
'use strict';

const GECKO_ID = 'spellfix@kartikpagariya25.github.io';

function toFirefoxManifest(manifest) {
  const out = JSON.parse(JSON.stringify(manifest));
  if (out.background && out.background.service_worker) {
    out.background = { scripts: ['src/word-merge.js', 'src/page-support.js', out.background.service_worker] };
  }
  out.browser_specific_settings = {
    gecko: { id: GECKO_ID, strict_min_version: '115.0' },
  };
  return out;
}

module.exports = { toFirefoxManifest, GECKO_ID };
