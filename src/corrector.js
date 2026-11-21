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

  const Keyboard = root.SpellFixKeyboard || require('./keyboard.js');
  const CommonTypos = root.SpellFixCommonTypos || require('./common-typos.js');
  const MEMO_LIMIT = 500;

  // How bold the corrector is. "dominance" is how much more likely the best
  // candidate must be than the runner-up; minTwoEditLength gates two-edit fixes.
  const PROFILES = {
    careful: { minLength: 4, dominance1: 6, dominance2: 10, minTwoEditLength: 99 },
    balanced: { minLength: 3, dominance1: 3, dominance2: 5, minTwoEditLength: 6 },
    eager: { minLength: 3, dominance1: 2, dominance2: 3, minTwoEditLength: 5 },
  };
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
    const profile = PROFILES[(options && options.sensitivity) || 'balanced'] || PROFILES.balanced;
    const rank = new Map();
    for (let i = 0; i < words.length; i++) rank.set(words[i], i);

    function isKnown(word) {
      return rank.has(word);
    }

    // How likely a finger slip is to turn `candidate` into `word` (lower = likelier).
    function slip(word, candidate) {
      if (word.length !== candidate.length) return 1;
      const diffs = [];
      for (let i = 0; i < word.length && diffs.length < 3; i++) {
        if (word[i] !== candidate[i]) diffs.push(i);
      }
      if (diffs.length === 1) {
        return Keyboard.areNeighbors(word[diffs[0]], candidate[diffs[0]]) ? 0.4 : 1;
      }
      // Two letters typed in the wrong order ("teh", "recieve") is the classic slip.
      if (diffs.length === 2 && diffs[1] === diffs[0] + 1 &&
          word[diffs[0]] === candidate[diffs[1]] && word[diffs[1]] === candidate[diffs[0]]) {
        return 0.3;
      }
      return 1;
    }

    // Lower score = better. A wrong first letter is a much rarer typo.
    function score(candidate, word) {
      return rank.get(candidate) * (candidate[0] === word[0] ? 1 : 4) * slip(word, candidate);
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
    function compute(word) {
      if (ignore.has(word)) return null;
      if (Object.prototype.hasOwnProperty.call(OVERRIDES, word)) return OVERRIDES[word];
      if (Object.prototype.hasOwnProperty.call(CommonTypos, word)) return CommonTypos[word];
      if (word.length < profile.minLength || rank.has(word)) return null;

      const e1 = edits1(word);
      const known1 = [];
      for (const c of e1) if (rank.has(c)) known1.push(c);
      if (known1.length > 0) return pickBest(known1, word, profile.dominance1);

      if (word.length < profile.minTwoEditLength || word.length > 12) return null;
      const known2 = new Set();
      for (const a of e1) {
        for (const b of edits1(a)) {
          if (b[0] === word[0] && rank.has(b)) known2.add(b);
        }
      }
      return pickBest([...known2], word, profile.dominance2);
    }

    // Two-edit searches are the slow path; people repeat their typos, so remember answers.
    const memo = new Map();
    function correct(word) {
      if (ignore.has(word)) return null; // the ignore set may change at any time
      if (memo.has(word)) {
        const hit = memo.get(word);
        memo.delete(word); // refresh recency
        memo.set(word, hit);
        return hit;
      }
      const result = compute(word);
      memo.set(word, result);
      if (memo.size > MEMO_LIMIT) memo.delete(memo.keys().next().value);
      return result;
    }

    return { correct, isKnown, edits1, memoSize: () => memo.size };
  }

  const api = { createCorrector, edits1, OVERRIDES };
  root.SpellFixCorrector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
