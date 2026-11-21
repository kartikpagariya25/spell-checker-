/*
 * Pure text helpers: finding the word the user just finished typing,
 * deciding whether it is safe to touch, and re-applying its casing.
 * No DOM access here, so everything is unit-testable in Node.
 */
(function (root) {
  'use strict';

  // Characters that, when typed right after a word, mean "I finished the word".
  const DELIMITERS = new Set([' ', '\t', ' ', ',', '.', '!', '?', ';', ':', ')', ']', '}']);

  function isDelimiter(ch) {
    return typeof ch === 'string' && ch.length === 1 && DELIMITERS.has(ch);
  }

  // Opening punctuation that may legitimately sit in front of a word: ("hello
  const LEADING_PUNCT = /^[("'\[{“‘]+/;

  /**
   * Looks at the text that sits right before the caret (without the delimiter
   * that was just typed) and returns the plain word the user just finished,
   * or null when the last chunk isn't a simple alphabetic word.
   *
   * Anything with digits, dots, slashes, @, #, _, - or inner apostrophes is a
   * URL / email / id / code-ish token and is deliberately left alone.
   *
   * @returns {{word: string, start: number, end: number} | null}
   */
  function wordBeforeCaret(textBefore) {
    const chunk = /\S+$/.exec(textBefore);
    if (!chunk) return null;
    const chunkStart = chunk.index;
    const lead = LEADING_PUNCT.exec(chunk[0]);
    const offset = lead ? lead[0].length : 0;
    const word = chunk[0].slice(offset);
    if (!/^[A-Za-z]+$/.test(word)) return null;
    const start = chunkStart + offset;
    return { word, start, end: start + word.length };
  }

  /** True when the text before a word means the word starts a sentence. */
  function isSentenceStart(textBeforeWord) {
    const trimmed = textBeforeWord.replace(/[("'\[{“‘\s]+$/, '');
    if (trimmed.length === 0) return true;
    if (/[\r\n]\s*$/.test(textBeforeWord)) return true;
    return /[.!?]$/.test(trimmed);
  }

  const CASE = { LOWER: 'lower', CAPITALIZED: 'capitalized', OTHER: 'other' };

  function caseOf(word) {
    if (word === word.toLowerCase()) return CASE.LOWER;
    if (word.length > 1 && word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
      return CASE.CAPITALIZED;
    }
    return CASE.OTHER; // ALLCAPS, camelCase, sTrAnGe - never auto-fixed
  }

  /** Re-applies the original word's casing to the correction. */
  function applyCase(original, fix) {
    if (caseOf(original) === CASE.CAPITALIZED) return fix.charAt(0).toUpperCase() + fix.slice(1);
    return fix;
  }

  const api = { DELIMITERS, isDelimiter, wordBeforeCaret, isSentenceStart, caseOf, applyCase, CASE };
  root.SpellFixText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
