/*
 * Opt-in fixes that need the previous word. Both are slips that a plain
 * dictionary can't see because every word involved is spelled correctly:
 *   "could of"  -> "could have"
 *   "the the"   -> "the"
 */
(function (root) {
  'use strict';

  const MODALS = new Set(['could', 'would', 'should', 'must', 'might', 'may']);
  // Words that are legitimately repeated.
  const REPEAT_OK = new Set([
    'had', 'that', 'very', 'so', 'no', 'bye', 'ha', 'yeah', 'really', 'well', 'there', 'now', 'knock',
    'is', 'do', 'can', 'go', 'goes', 'blah', 'oh', 'hey', 'yes', 'sorry', 'please', 'more', 'many',
  ]);

  /**
   * @param {string} previous word typed just before (any case)
   * @param {string} word the word just finished
   * @returns {string | null} replacement text for `word` ('' means delete it), or null
   */
  function contextFix(previous, word) {
    if (!previous || !word || word !== word.toLowerCase() || !/^[a-z]+$/.test(word)) return null;
    const prev = previous.toLowerCase();
    if (word === 'of' && MODALS.has(prev)) return 'have';
    if (prev === word && word.length >= 2 && !REPEAT_OK.has(word)) return '';
    return null;
  }

  /** Last alphabetic word in `text` (which ends right before the current word), or ''. */
  function previousWord(text) {
    const m = /([A-Za-z]+)[ \t ]+$/.exec(text);
    return m ? m[1] : '';
  }

  const api = { contextFix, previousWord };
  root.SpellFixContextFixes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
