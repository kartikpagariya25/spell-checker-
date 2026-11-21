/*
 * QWERTY geometry. Fast typists most often hit a key *next to* the one they
 * meant ("wprld" for "world"), so substitutions between neighbouring keys are
 * far more plausible than between distant ones.
 */
(function (root) {
  'use strict';

  // [row string, horizontal offset of the row's first key]
  const ROWS = [
    ['qwertyuiop', 0],
    ['asdfghjkl', 0.25],
    ['zxcvbnm', 0.75],
  ];

  const position = {};
  ROWS.forEach(([keys, offset], row) => {
    keys.split('').forEach((key, i) => {
      position[key] = { x: i + offset, y: row };
    });
  });

  /** True when two different letters sit next to each other on a QWERTY keyboard. */
  function areNeighbors(a, b) {
    const p = position[a];
    const q = position[b];
    if (!p || !q || a === b) return false;
    return Math.hypot(p.x - q.x, p.y - q.y) < 1.5;
  }

  const api = { areNeighbors, position };
  root.SpellFixKeyboard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
