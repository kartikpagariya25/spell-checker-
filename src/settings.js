/*
 * Tiny settings store shared by the content script and the popup.
 * Backed by chrome.storage.local; falls back to memory when the extension
 * APIs aren't there (unit tests, the manual test page).
 */
(function (root) {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    disabledHosts: [],
    learned: [],
    correctionCount: 0,
    // Preferences (options page)
    sensitivity: 'balanced', // 'careful' | 'balanced' | 'eager'
    fixOnEnter: true, // also fix the last word when Enter is pressed
    showHighlight: true, // brief cue on corrected words
    includeSearchBoxes: true,
    fixCapitalizedAtSentenceStart: true,
    recent: [], // last few corrections: { from, to, host, at }
  };
  const MAX_RECENT = 10;
  const MAX_LEARNED = 1000;

  const area =
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;

  let state = Object.assign({}, DEFAULTS);
  const listeners = [];

  function emit() {
    for (const fn of listeners) {
      try {
        fn(state);
      } catch (e) {
        /* a bad listener must not break the others */
      }
    }
  }

  function load(cb) {
    if (!area) return cb(state);
    try {
      area.get(DEFAULTS, (items) => {
        state = Object.assign({}, DEFAULTS, items);
        cb(state);
      });
    } catch (e) {
      cb(state); // extension was reloaded under us; keep defaults
    }
  }

  function save(patch) {
    state = Object.assign({}, state, patch);
    if (area) {
      try {
        area.set(patch);
      } catch (e) {
        /* extension context invalidated after a reload - ignore */
      }
    }
    emit();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  if (area && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const patch = {};
      for (const key of Object.keys(changes)) patch[key] = changes[key].newValue;
      state = Object.assign({}, state, patch);
      emit();
    });
  }

  function isActiveOn(hostname) {
    return state.enabled && state.disabledHosts.indexOf(hostname) === -1;
  }

  function learnWord(word) {
    if (state.learned.indexOf(word) !== -1) return;
    const learned = state.learned.concat(word).slice(-MAX_LEARNED);
    save({ learned });
  }

  function get() {
    return state;
  }

  /** Remembers the latest corrections so the popup can show what changed. */
  function recordRecent(from, to, host) {
    const recent = [{ from, to, host, at: Date.now() }].concat(state.recent).slice(0, MAX_RECENT);
    save({ recent });
  }

  const SENSITIVITIES = ['careful', 'balanced', 'eager'];

  /** Data the user may want to back up or move to another browser. */
  function exportData() {
    return {
      app: 'spellfix',
      version: 1,
      learned: state.learned.slice(),
      disabledHosts: state.disabledHosts.slice(),
      sensitivity: state.sensitivity,
    };
  }

  /**
   * Merges exported data into the current settings. Anything malformed is
   * ignored rather than trusted. Returns what was imported.
   */
  function importData(data) {
    if (!data || typeof data !== 'object' || data.app !== 'spellfix') {
      throw new Error('Not a SpellFix export file');
    }
    const words = Array.isArray(data.learned) ? data.learned : [];
    const hosts = Array.isArray(data.disabledHosts) ? data.disabledHosts : [];
    const cleanWords = words.filter((w) => typeof w === 'string' && /^[a-z]{2,40}$/.test(w));
    const cleanHosts = hosts.filter((h) => typeof h === 'string' && /^[a-z0-9.-]{1,253}$/i.test(h));
    const patch = {
      learned: Array.from(new Set(state.learned.concat(cleanWords))).slice(-MAX_LEARNED),
      disabledHosts: Array.from(new Set(state.disabledHosts.concat(cleanHosts))),
    };
    if (SENSITIVITIES.indexOf(data.sensitivity) !== -1) patch.sensitivity = data.sensitivity;
    save(patch);
    return { words: cleanWords.length, hosts: cleanHosts.length };
  }

  const api = {
    DEFAULTS, SENSITIVITIES, load, save, get, onChange, isActiveOn, learnWord, recordRecent, exportData, importData,
  };
  root.SpellFixSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
