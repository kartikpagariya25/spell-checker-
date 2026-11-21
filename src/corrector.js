/*
 * Offline spelling corrector.
 *
 * Given a dictionary ordered by frequency (index = rank, lower = more common),
 * it proposes a single replacement for a misspelled word, or nothing when it
 * is not confident. Being quiet is always better than a wrong "fix", so:
 *   - known words are never touched,
 *   - ambiguous cases (several equally likely candidates) are skipped,
 *   - two-edit fixes are only tried on longer words.
 */
(function (root) {
  'use strict';

  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Fixes that plain edit distance either gets wrong or finds ambiguous.
  // Values are used verbatim (so contractions keep their apostrophe).
  const OVERRIDES = {
    teh: 'the', hte: 'the', adn: 'and', nad: 'and', taht: 'that', tht: 'that', waht: 'what',
    wich: 'which', whcih: 'which', thier: 'their', jsut: 'just', ot: 'to', yuo: 'you', wierd: 'weird',
    dont: "don't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't",
    wasnt: "wasn't", werent: "weren't", doesnt: "doesn't", didnt: "didn't",
    couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", hasnt: "hasn't",
    havent: "haven't", hadnt: "hadn't", im: "I'm", ive: "I've", youre: "you're",
    theyre: "they're", thats: "that's", whats: "what's", lets: "let's",
  };

  function edits1(word) {
    const out = new Set();
    const n = word.length;
    for (let i = 0; i < n; i++) out.add(word.slice(0, i) + word.slice(i + 1)); // deletion
    for (let i = 0; i < n - 1; i++) {
      out.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)); // transposition
    }
    for (let i = 0; i < n; i++) {
      for (const c of ALPHABET) {
        if (c !== word[i]) out.add(word.slice(0, i) + c + word.slice(i + 1)); // substitution
      }
    }
    for (let i = 0; i <= n; i++) {
      for (const c of ALPHABET) out.add(word.slice(0, i) + c + word.slice(i)); // insertion
    }
    out.delete(word);
    return out;
  }

  /**
   * @param {string[]} words dictionary, most frequent first
   * @param {{ignore?: Set<string>}} [options]
   */
  function createCorrector(words, options) {
    const ignore = (options && options.ignore) || new Set();
    const rank = new Map();
    for (let i = 0; i < words.length; i++) rank.set(words[i], i);

    function isKnown(word) {
      return rank.has(word);
    }

    // Lower score = better. A wrong first letter is a much rarer typo.
    function score(candidate, word) {
      return rank.get(candidate) * (candidate[0] === word[0] ? 1 : 4);
    }

    // Returns the single winning candidate, or null when it's ambiguous.
    function pickBest(candidates, word, dominance) {
      if (candidates.length === 0) return null;
      const scored = candidates.map((c) => ({ c, s: score(c, word) })).sort((a, b) => a.s - b.s);
      if (scored.length === 1) return scored[0].c;
      // Zipf-ish: rank ratio approximates frequency ratio. Require a clear winner.
      return scored[1].s >= scored[0].s * dominance + 20 ? scored[0].c : null;
    }

    /**
     * @param {string} word lowercase alphabetic word
     * @returns {string | null} replacement, or null to leave the word alone
     */
    function correct(word) {
      if (ignore.has(word)) return null;
      if (Object.prototype.hasOwnProperty.call(OVERRIDES, word)) return OVERRIDES[word];
      if (word.length < 3 || rank.has(word)) return null;

      const e1 = edits1(word);
      const known1 = [];
      for (const c of e1) if (rank.has(c)) known1.push(c);
      if (known1.length > 0) return pickBest(known1, word, 3);

      if (word.length < 6 || word.length > 12) return null;
      const known2 = new Set();
      for (const a of e1) {
        for (const b of edits1(a)) {
          if (b[0] === word[0] && rank.has(b)) known2.add(b);
        }
      }
      return pickBest([...known2], word, 5);
    }

    return { correct, isKnown, edits1 };
  }

  const api = { createCorrector, edits1, OVERRIDES };
  root.SpellFixCorrector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
