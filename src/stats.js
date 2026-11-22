/*
 * Per-day correction counters, kept for roughly a month, so the popup can
 * show "N fixed this week". Pure functions; the caller supplies `now`.
 */
(function (root) {
  'use strict';

  const KEEP_DAYS = 35;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** Local-time calendar day as YYYY-MM-DD. */
  function dayKey(time) {
    const d = new Date(time);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Returns a new counts object with `n` added to today and old days dropped. */
  function addCount(counts, n, now) {
    const out = {};
    const oldest = dayKey(now - KEEP_DAYS * DAY_MS);
    for (const key of Object.keys(counts || {})) {
      if (key >= oldest) out[key] = counts[key];
    }
    const today = dayKey(now);
    out[today] = (out[today] || 0) + n;
    return out;
  }

  /** Total for today and the six days before it. */
  function weekTotal(counts, now) {
    let total = 0;
    for (let i = 0; i < 7; i++) total += (counts && counts[dayKey(now - i * DAY_MS)]) || 0;
    return total;
  }

  const api = { dayKey, addCount, weekTotal };
  root.SpellFixStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
