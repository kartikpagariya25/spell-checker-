/*
 * Merging lists of kept words coming from different places (this browser,
 * the synced copy, an import file). Pure helpers shared by the service worker
 * and the tests.
 */
(function (root) {
  'use strict';

  const MAX_WORDS = 1000;
  const VALID_WORD = /^[a-z]{2,40}$/;

  /** Union of any number of word lists: valid words only, no duplicates, newest kept if over the cap. */
  function mergeWords() {
    const seen = new Set();
    const out = [];
    for (const list of arguments) {
      for (const word of Array.isArray(list) ? list : []) {
        if (typeof word === 'string' && VALID_WORD.test(word) && !seen.has(word)) {
          seen.add(word);
          out.push(word);
        }
      }
    }
    return out.slice(-MAX_WORDS);
  }

  /** Same words, ignoring order? */
  function sameWords(a, b) {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((w) => set.has(w));
  }

  /** Normalises a user-selected string into a word we may remember, or null. */
  function wordFromSelection(text) {
    const word = String(text || '').trim().toLowerCase();
    return VALID_WORD.test(word) ? word : null;
  }

  const api = { mergeWords, sameWords, wordFromSelection, MAX_WORDS };
  root.SpellFixWordMerge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
