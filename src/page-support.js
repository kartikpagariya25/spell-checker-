/*
 * Which pages can a browser extension actually run on? Chrome and Firefox
 * block content scripts on browser-owned pages (new tab page, settings,
 * built-in side panels such as Gemini, PDF viewer) and on the extension
 * stores. Knowing this lets the popup explain *why* SpellFix is idle there
 * instead of just looking broken.
 */
(function (root) {
  'use strict';

  const STORE_HOSTS = new Set([
    'chromewebstore.google.com',
    'microsoftedge.microsoft.com',
    'addons.mozilla.org',
  ]);

  /**
   * @param {string | undefined} url
   * @returns {{kind: 'web' | 'file' | 'store' | 'browser', hostname: string | null}}
   *   web     - normal http(s) page, SpellFix can run
   *   file    - file:// page, needs "Allow access to file URLs" on the extension card
   *   store   - extension store, blocked by the browser
   *   browser - chrome://, about:, edge://, view-source:, new tab page, ... blocked
   */
  function classifyUrl(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return { kind: 'browser', hostname: null };
    }
    if (parsed.protocol === 'file:') return { kind: 'file', hostname: null };
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { kind: 'browser', hostname: null };
    const host = parsed.hostname;
    if (STORE_HOSTS.has(host) || (host === 'chrome.google.com' && parsed.pathname.indexOf('/webstore') === 0)) {
      return { kind: 'store', hostname: host };
    }
    return { kind: 'web', hostname: host };
  }

  /** Human explanation for pages where SpellFix cannot run, or '' when it can. */
  function explainUnsupported(kind) {
    switch (kind) {
      case 'browser':
        return "Your browser doesn't allow extensions on its own pages (new tab page, settings, built-in side panels like Gemini). Use a normal website tab instead.";
      case 'store':
        return "Extension stores block all extensions. SpellFix works on every other website.";
      case 'file':
        return 'To use SpellFix on local files, turn on "Allow access to file URLs" on its card in chrome://extensions.';
      default:
        return '';
    }
  }

  const api = { classifyUrl, explainUnsupported };
  root.SpellFixPageSupport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
